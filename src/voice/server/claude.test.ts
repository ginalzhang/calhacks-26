/**
 * Exercises the real SDK path against a local fake of POST /v1/messages, so the exact request
 * shape (model, thinking, output_config, timeouts) and the error mapping are verified without a key.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { __resetSchemaFallbackForTests, claudeCleanup, claudeCommand, COMMAND_SYSTEM, strictOutputFormat } from "./claude";
import { ActionsSchema, type CleanupRequest } from "../apiTypes";
import { ACTIONS } from "@/actions";

type Handler = (body: Record<string, unknown>, res: http.ServerResponse) => void;
let handler: Handler;
let lastBody: Record<string, unknown> | null = null;
let server: http.Server;

const message = (text: string, stop_reason = "end_turn") => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "test",
  content: [{ type: "text", text }],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});
const reply = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      lastBody = JSON.parse(data || "{}");
      handler(lastBody!, res);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "sk-test";
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
});
beforeEach(() => {
  lastBody = null;
});

const ctx = { lastActions: ["pen.toggle"], selected: null, canvas: { w: 1200, h: 800 } };

describe("strictOutputFormat", () => {
  it("restores action-id enums the SDK transform moved into descriptions", () => {
    const s = JSON.stringify(strictOutputFormat(ActionsSchema).schema);
    expect(s).toContain('"enum":["pen.toggle"');
    expect(s).toContain('"enum":["clarify"]');
    expect(s).not.toContain("{enum:");
  });
});

describe("claudeCommand", () => {
  it("sends the spec'd request and returns parsed actions", async () => {
    handler = (_b, res) => reply(res, 200, message(JSON.stringify({ kind: "actions", actions: ["shape.circle"] })));
    const r = await claudeCommand("make the last thing look like a ball", ctx);
    expect(r).toMatchObject({ ok: true, value: { kind: "actions", actions: ["shape.circle"] } });
    expect(lastBody).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
    expect(lastBody).not.toHaveProperty("tool_choice");
    expect(String((lastBody as { messages: { content: string }[] }).messages[0].content)).toContain("look like a ball");
  });

  it("system prompt lists every action id and label", () => {
    for (const a of ACTIONS) {
      expect(COMMAND_SYSTEM).toContain(`- ${a.id}: "${a.label}"`);
    }
  });

  it("maps schema-violating output to invalid", async () => {
    handler = (_b, res) => reply(res, 200, message(JSON.stringify({ kind: "actions", actions: ["paint.room"] })));
    expect(await claudeCommand("paint the room", ctx)).toMatchObject({ ok: false, reason: "invalid" });
    handler = (_b, res) => reply(res, 200, message("not json at all"));
    expect(await claudeCommand("x", ctx)).toMatchObject({ ok: false, reason: "invalid" });
    handler = (_b, res) => reply(res, 200, { ...message(""), content: [] });
    expect(await claudeCommand("x", ctx)).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("maps 401 to key-missing and 500 to upstream", async () => {
    handler = (_b, res) => reply(res, 401, { type: "error", error: { type: "authentication_error", message: "bad key" } });
    expect(await claudeCommand("x", ctx)).toMatchObject({ ok: false, reason: "key-missing" });
    handler = (_b, res) => reply(res, 500, { type: "error", error: { type: "api_error", message: "boom" } });
    expect(await claudeCommand("x", ctx)).toMatchObject({ ok: false, reason: "upstream" });
  });

  it("retries once with the SDK's default schema if the strict schema gets a 400", async () => {
    __resetSchemaFallbackForTests();
    const schemas: string[] = [];
    handler = (b, res) => {
      const sch = JSON.stringify((b.output_config as { format: { schema: unknown } }).format.schema);
      schemas.push(sch);
      if (sch.includes('"enum"')) reply(res, 400, { type: "error", error: { type: "invalid_request_error", message: "schema" } });
      else reply(res, 200, message(JSON.stringify({ kind: "actions", actions: ["undo"] })));
    };
    expect(await claudeCommand("take it back", ctx)).toMatchObject({ ok: true, value: { actions: ["undo"] } });
    expect(schemas).toHaveLength(2);
    __resetSchemaFallbackForTests();
  });

  it("times out at 2.5 s with no retry", async () => {
    let calls = 0;
    handler = (_b, res) => {
      calls++;
      setTimeout(() => reply(res, 200, message(JSON.stringify({ kind: "none" }))), 3500);
    };
    const r = await claudeCommand("x", ctx);
    expect(r).toMatchObject({ ok: false, reason: "timeout" });
    expect(r.latencyMs).toBeGreaterThanOrEqual(2400);
    expect(r.latencyMs).toBeLessThan(3400);
    expect(calls).toBe(1);
  }, 8000);
});

describe("claudeCleanup", () => {
  const req: CleanupRequest = {
    mode: "handwriting",
    imagePng: "iVBORw0KGgo=",
    bbox: { x: 120, y: 80, w: 400, h: 160 },
    strokes: [{ id: "s_1", kind: "free", colour: "black", width: 6, points: Array.from({ length: 300 }, (_, i) => ({ x: 130 + i * 0.5, y: 90.25 })) }],
  };
  it("sends image + stroke JSON to Sonnet with low effort for handwriting", async () => {
    handler = (_b, res) => reply(res, 200, message(JSON.stringify({ text: "buy milk", confidence: 0.8, replaces: ["s_1"] })));
    const r = await claudeCleanup("handwriting", req);
    expect(r).toMatchObject({ ok: true, value: { text: "buy milk" } });
    expect(lastBody).toMatchObject({ model: "claude-sonnet-5-5", max_tokens: 8192, output_config: { effort: "low" } });
    expect(lastBody).not.toHaveProperty("thinking");
    const content = (lastBody as { messages: { content: { type: string; text?: string; source?: unknown }[] }[] }).messages[0].content;
    expect(content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } });
    expect(content[1].type).toBe("text");
    expect(content[1].text).toContain('"id":"s_1"');
  });
  it("uses medium effort for cleanup / label", async () => {
    handler = (_b, res) => reply(res, 200, message(JSON.stringify({ labels: [{ text: "Box", x: 1, y: 2, size: 22 }] })));
    await claudeCleanup("label", { ...req, mode: "label" });
    expect(lastBody).toMatchObject({ output_config: { effort: "medium" } });
  });
});
