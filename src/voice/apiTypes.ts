/**
 * Zod schemas + TS types for every request/response body in docs/API.md.
 * Shared by the route handlers (src/app/api/**) and the browser clients.
 * Must stay isomorphic: never import @anthropic-ai/sdk or anything server-only here.
 */
import { z } from "zod";
import { ACTION_IDS, COLOURS } from "@/actions";

// ---------------------------------------------------------------- primitives

export const ActionIdSchema = z.enum(ACTION_IDS);
export const ColourNameSchema = z.enum(COLOURS);
export const StrokeKindSchema = z.enum(["free", "line", "circle", "rect", "triangle", "dot"]);

const Vec2Schema = z.object({ x: z.number(), y: z.number() });
const RectSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const SizeSchema = z.object({ w: z.number(), h: z.number() });

/** Every route: `GET` probe. */
export const KeyProbeSchema = z.object({ keyPresent: z.boolean(), mock: z.boolean() });
export type KeyProbe = z.infer<typeof KeyProbeSchema>;

export const ApiErrorCodeSchema = z.enum(["timeout", "invalid", "key-missing", "bad-request", "upstream"]);
export const ApiErrorSchema = z.object({
  error: ApiErrorCodeSchema,
  message: z.string(),
  mock: z.boolean(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ---------------------------------------------------------------- /api/cartesia-token

export const CartesiaTokenResponseSchema = z.union([
  z.object({ token: z.string().min(1), expiresAt: z.number(), mock: z.literal(false) }),
  z.object({ token: z.null(), expiresAt: z.null(), mock: z.literal(true) }),
]);
export type CartesiaTokenResponse = z.infer<typeof CartesiaTokenResponseSchema>;

// ---------------------------------------------------------------- /api/command

export const CommandContextSchema = z.object({
  lastActions: z.array(ActionIdSchema).max(3),
  selected: z
    .object({ id: z.string(), kind: StrokeKindSchema, colour: ColourNameSchema, width: z.number() })
    .nullable(),
  canvas: SizeSchema,
});

export const CommandRequestSchema = z.object({
  transcript: z.string().trim().min(1).max(500),
  context: CommandContextSchema,
  dialogOpen: z.boolean().default(false),
});
export type CommandRequest = z.input<typeof CommandRequestSchema>;

export const ClarifyOptionSchema = z.object({
  label: z.string().min(1).max(60),
  actions: z.array(ActionIdSchema).min(1).max(4),
});

/**
 * What Claude must return from /api/command (passed to zodOutputFormat).
 * Unsupported JSON-schema constraints (minItems > 1, maxItems, string lengths) are stripped
 * from the schema the API sees by the SDK and re-checked here client-side by zod.
 */
export const ActionsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("actions"),
    /** One or more action ids from the action table, executed in order. */
    actions: z.array(ActionIdSchema).min(1).max(4),
  }),
  z.object({
    kind: z.literal("clarify"),
    question: z.string().min(1).max(120),
    /** 2-3 options, shown as numbered tiles 1-3. */
    options: z.array(ClarifyOptionSchema).min(2).max(3),
  }),
  z.object({
    kind: z.literal("none"),
  }),
]);
export type ClaudeActionsOutput = z.infer<typeof ActionsSchema>;

export const CommandNoneReasonSchema = z.enum(["timeout", "invalid", "no-match", "key-missing"]);

const Meta = { mock: z.boolean(), latencyMs: z.number().nonnegative() };

export const CommandResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("actions"), actions: z.array(ActionIdSchema).min(1).max(4), ...Meta }),
  z.object({
    kind: z.literal("clarify"),
    question: z.string().min(1),
    options: z.array(ClarifyOptionSchema).min(2).max(3),
    ...Meta,
  }),
  z.object({ kind: z.literal("none"), reason: CommandNoneReasonSchema, ...Meta }),
]);
export type CommandResponse = z.infer<typeof CommandResponseSchema>;

// ---------------------------------------------------------------- /api/cleanup

export const CleanupModeSchema = z.enum(["handwriting", "cleanup", "label"]);
export type CleanupMode = z.infer<typeof CleanupModeSchema>;

export const CleanupStrokeSchema = z.object({
  id: z.string(),
  kind: StrokeKindSchema,
  colour: ColourNameSchema,
  width: z.number(),
  points: z.array(Vec2Schema).max(5000),
});

export const CleanupRequestSchema = z.object({
  mode: CleanupModeSchema,
  /** Base64 PNG of the selection crop, no `data:` prefix. Empty string allowed (strokes only). */
  imagePng: z.string().max(8_000_000),
  bbox: RectSchema,
  strokes: z.array(CleanupStrokeSchema).min(1).max(500),
});
export type CleanupRequest = z.infer<typeof CleanupRequestSchema>;

export const CleanShapeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rect"), x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  z.object({ kind: z.literal("circle"), cx: z.number(), cy: z.number(), r: z.number() }),
  z.object({ kind: z.literal("line"), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }),
  z.object({ kind: z.literal("triangle"), points: z.array(Vec2Schema).length(3) }),
  z.object({ kind: z.literal("text"), x: z.number(), y: z.number(), text: z.string(), size: z.number() }),
]);
export type CleanShape = z.infer<typeof CleanShapeSchema>;

export const LabelSchema = z.object({ text: z.string().min(1).max(80), x: z.number(), y: z.number(), size: z.number() });

/** What Claude must return from /api/cleanup, per mode (each passed to zodOutputFormat). */
export const CleanupSchema = {
  handwriting: z.object({
    /** The recognised text; lines separated by "\n". Empty if nothing legible. */
    text: z.string().max(2000),
    /** 0..1 self-reported confidence (range re-checked client-side). */
    confidence: z.number().min(0).max(1),
    /** Ids of the strokes that are part of the writing (subset of the request's ids). */
    replaces: z.array(z.string()),
  }),
  cleanup: z.object({
    shapes: z.array(CleanShapeSchema).max(60),
    replaces: z.array(z.string()),
  }),
  label: z.object({
    labels: z.array(LabelSchema).min(1).max(10),
  }),
} as const;

export const CleanupResponseSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("handwriting"),
    text: z.string(),
    confidence: z.number().min(0).max(1),
    replaces: z.array(z.string()),
    at: Vec2Schema,
    size: z.number().positive(),
    ...Meta,
  }),
  z.object({ mode: z.literal("cleanup"), shapes: z.array(CleanShapeSchema), replaces: z.array(z.string()), ...Meta }),
  z.object({ mode: z.literal("label"), labels: z.array(LabelSchema), ...Meta }),
]);
export type CleanupResponse = z.infer<typeof CleanupResponseSchema>;
