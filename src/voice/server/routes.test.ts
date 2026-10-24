/** Calls the route handlers directly (mock mode: no keys), independent of the dev server. */
import { beforeAll, describe, expect, it } from "vitest";
import * as command from "@/app/api/command/route";
import * as cleanup from "@/app/api/cleanup/route";
import * as token from "@/app/api/cartesia-token/route";
import { CartesiaTokenResponseSchema, CleanupResponseSchema, CommandResponseSchema } from "../apiTypes";

beforeAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.CARTESIA_API_KEY;
});

const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) });
const ctx = { lastActions: [], selected: null, canvas: { w: 1200, h: 800 } };

describe("route handlers (mock mode)", () => {
  it("POST /api/cartesia-token returns the documented mock", async () => {
    const res = await token.POST();
    const body = await res.json();
    expect(body).toEqual({ token: null, expiresAt: null, mock: true });
    expect(CartesiaTokenResponseSchema.safeParse(body).success).toBe(true);
  });

  it("POST /api/command returns schema-valid mock actions with latency", async () => {
    const res = await command.POST(post({ transcript: "make the last thing look like a ball", context: ctx }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ kind: "actions", actions: ["shape.circle"], mock: true });
    expect(body.latencyMs).toBeGreaterThanOrEqual(300);
    expect(CommandResponseSchema.safeParse(body).success).toBe(true);
  });

  it("POST /api/command rejects bad bodies with the error shape", async () => {
    const res = await command.POST(post({ transcript: "" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "bad-request", mock: true });
  });

  it("POST /api/cleanup returns schema-valid mock results per mode", async () => {
    const strokes = [{ id: "s_1", kind: "free", colour: "black", width: 6, points: [{ x: 130, y: 90 }, { x: 330, y: 100 }] }];
    for (const mode of ["handwriting", "cleanup", "label"] as const) {
      const res = await cleanup.POST(post({ mode, imagePng: "", bbox: { x: 120, y: 80, w: 400, h: 60 }, strokes }));
      const body = await res.json();
      expect(res.status, mode).toBe(200);
      expect(body.mode).toBe(mode);
      expect(CleanupResponseSchema.safeParse(body).success, mode).toBe(true);
    }
    const bad = await cleanup.POST(post({ mode: "handwriting", imagePng: "data:image/png;base64,xx", bbox: { x: 0, y: 0, w: 1, h: 1 }, strokes }));
    expect(bad.status).toBe(400);
  }, 10_000);
});
