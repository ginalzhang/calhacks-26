/**
 * Shared helpers for the Steady Playwright suite.
 *
 * ASSUMPTIONS (contract: src/tracking/LandmarkSource.ts, src/actions.ts, PROMPT.md §0/§3/§9):
 *  - URL params `source=replay`, `fixture=<FixtureName>`, `autoplay=0`, `skipIntro=1`, `demo=1`.
 *  - `window.__steady` (SteadyTestHooks) is installed on every page load: `getState()`,
 *    `command(text)` (runs exactly as if typed into the box), `replay` (ReplayControls).
 *  - Tiles are `<button>`s whose accessible name is `ACTIONS[].label`; B also tags them with
 *    `data-tile="<action id>"`. When the toolbar is grouped, a category tile whose name contains
 *    the category ("Colours", "Tools", "View", "Pages", ...) opens a sub-panel.
 *  - The typed-command box is a visible text input whose accessible name (label) contains
 *    "command" (e.g. "Type a command").
 *  - The drawing canvas is `role="img"` with an aria-label starting "Drawing canvas".
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { ACTION_BY_ID, type ActionCategory, type ActionId } from "../src/actions";
import type { FixtureName, SteadyTestHooks } from "../src/tracking/LandmarkSource";

export type SteadyState = ReturnType<SteadyTestHooks["getState"]>;

export interface OpenOpts {
  fixture?: FixtureName;
  /** Default false: tests start replay themselves so timing is deterministic. */
  autoplay?: boolean;
  /** Default true. */
  skipIntro?: boolean;
  demo?: boolean;
}

export async function openApp(page: Page, o: OpenOpts = {}): Promise<void> {
  const q = new URLSearchParams();
  q.set("source", "replay");
  if (o.fixture) q.set("fixture", o.fixture);
  if (!(o.autoplay ?? false)) q.set("autoplay", "0");
  if (o.skipIntro ?? true) q.set("skipIntro", "1");
  if (o.demo) q.set("demo", "1");
  await page.goto(`/?${q.toString()}`);
  try {
    await page.waitForFunction(() => typeof (window as unknown as { __steady?: unknown }).__steady === "object", null, {
      timeout: 45_000,
    });
  } catch {
    throw new Error(`window.__steady was never installed on /?${q.toString()} (the app's test hooks have not landed or the page crashed)`);
  }
  if (o.fixture) {
    // Fixture must be loaded before tests drive it.
    await page.waitForFunction(() => !!(window as unknown as { __steady: SteadyTestHooks }).__steady.replay, null, { timeout: 20_000 });
  }
}

export function getState(page: Page): Promise<SteadyState> {
  return withNodeTimeout(page.evaluate(() => (window as unknown as { __steady: SteadyTestHooks }).__steady.getState()), 5_000, "getState()");
}

/** Wait until `pred(state)` holds. `pred` is serialised into the page, so keep it self-contained. */
export async function waitForState(
  page: Page,
  pred: (s: SteadyState, arg: unknown) => boolean,
  opts: { timeout?: number; arg?: unknown; message?: string } = {},
): Promise<SteadyState> {
  const src = pred.toString();
  try {
    await page.waitForFunction(
      ([fnSrc, arg]) => {
        const fn = new Function(`return (${fnSrc})`)() as (s: unknown, a: unknown) => boolean;
        return fn((window as unknown as { __steady: SteadyTestHooks }).__steady.getState(), arg);
      },
      [src, opts.arg ?? null] as const,
      { timeout: opts.timeout ?? 15_000, polling: 50 },
    );
  } catch (e) {
    const s = await getState(page).catch(() => null);
    throw new Error(`${opts.message ?? "state condition not met"}: ${src}\nlast state: ${JSON.stringify(s)}\n${String(e)}`);
  }
  return getState(page);
}

export async function pause(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __steady: SteadyTestHooks }).__steady.replay!.pause());
}

export async function play(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __steady: SteadyTestHooks }).__steady.replay!.play());
}

/** Reject after `ms` on the Node side too, so a blocked page main thread can't hang the suite. */
async function withNodeTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`${what} did not finish within ${ms} ms (page main thread blocked or replay stalled)`)), ms + 2_000);
  });
  try {
    return await Promise.race([p, t]);
  } finally {
    clearTimeout(timer);
  }
}

/** Play the loaded fixture to the end. */
export async function playToEnd(page: Page, timeout = 30_000): Promise<void> {
  await withNodeTimeout(
    page.evaluate(
      (ms) =>
        Promise.race([
          (async () => {
            const r = (window as unknown as { __steady: SteadyTestHooks }).__steady.replay!;
            const done = r.finished();
            r.play();
            await done;
          })(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("replay did not finish")), ms)),
        ]),
      timeout,
    ),
    timeout,
    "replay",
  );
}

/** Wait for replay.finished() (replay already playing). */
export async function finished(page: Page, timeout = 30_000): Promise<void> {
  await withNodeTimeout(
    page.evaluate(
      (ms) =>
        Promise.race([
          (window as unknown as { __steady: SteadyTestHooks }).__steady.replay!.finished(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("replay did not finish")), ms)),
        ]),
      timeout,
    ),
    timeout,
    "replay",
  );
}

export async function command(page: Page, text: string): Promise<void> {
  await withNodeTimeout(page.evaluate((t) => (window as unknown as { __steady: SteadyTestHooks }).__steady.command(t), text), 10_000, `command("${text}")`);
}

/** Records every pen state change (polled every animation frame) into window.__penLog. */
export async function recordPen(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __steady: SteadyTestHooks; __penLog: string[] };
    w.__penLog = [w.__steady.getState().pen];
    const loop = () => {
      const p = w.__steady.getState().pen;
      if (p !== w.__penLog[w.__penLog.length - 1]) w.__penLog.push(p);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
export function penLog(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __penLog: string[] }).__penLog);
}

/** Draw one stroke with the dwell-stroke fixture and wait for it to be committed. */
export async function drawOneStroke(page: Page, fixtureAlreadyOpen = true): Promise<SteadyState> {
  if (!fixtureAlreadyOpen) await openApp(page, { fixture: "dwell-stroke" });
  await playToEnd(page);
  return waitForState(page, (s) => s.strokeCount >= 1 && s.pen === "HOVER", { timeout: 5_000, message: "dwell-stroke should leave one stroke" });
}

export function canvas(page: Page): Locator {
  return page.getByRole("img", { name: /drawing canvas/i });
}

export function typedBox(page: Page): Locator {
  return page.getByRole("textbox", { name: /command/i });
}

const CATEGORY_NAMES: Record<ActionCategory, RegExp> = {
  pen: /^pen$/i,
  colours: /colou?rs/i,
  tools: /tools/i,
  view: /view/i,
  pages: /pages/i,
  voice: /voice/i,
  ai: /\bai\b|claude/i,
  setup: /setup|settings/i,
  dialog: /dialog/i,
  demo: /^demo$/i,
};

/**
 * The tile for an action: the button named exactly `ACTIONS[].label`. If it is not visible
 * (toolbar grouped behind category tiles), open its category tile first.
 */
export async function tile(page: Page, id: ActionId): Promise<Locator> {
  const def = ACTION_BY_ID[id];
  const btn = page.getByRole("button", { name: def.label, exact: true });
  if (await btn.first().isVisible().catch(() => false)) return btn.first();
  const cat = page.getByRole("button", { name: CATEGORY_NAMES[def.category] });
  if (await cat.first().isVisible().catch(() => false)) {
    await cat.first().click();
    await expect(btn.first(), `tile "${def.label}" should appear after opening its category`).toBeVisible();
    return btn.first();
  }
  await expect(btn.first(), `tile "${def.label}" (${id}) should be visible`).toBeVisible();
  return btn.first();
}

/** Focus the drawing canvas (where global keys are handled). */
export async function focusCanvas(page: Page): Promise<void> {
  const c = canvas(page);
  await expect(c).toBeVisible();
  await c.focus();
}

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
