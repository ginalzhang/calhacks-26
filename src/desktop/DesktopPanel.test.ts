import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DesktopPanel from "./DesktopPanel";

describe("DesktopPanel (server render, off state)", () => {
  const html = renderToStaticMarkup(createElement(DesktopPanel, { camera: createElement("div", { id: "cam" }, "camera") }));

  it("renders the camera slot and the required controls as real buttons with visible labels", () => {
    expect(html).toContain('id="cam"');
    for (const label of ["Pen", "Mic", "Pause", "Undo", "Exit Desktop mode", "Brush", "Eraser", "Bigger", "Smaller", "Save", "Set drawing area", "Dwell click"]) {
      expect(html, label).toMatch(new RegExp(`<button[^>]*>(?:(?!</button>).)*${label}`));
    }
  });

  it("toggles expose aria-pressed; status uses live regions", () => {
    expect(html).toMatch(/data-tile="pen.toggle"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*data-tile="pen.toggle"/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>).)*Dwell click|data-tile="desktop.dwellclick"[^>]*aria-pressed="true"/);
    expect(html).toContain('role="status"');
    expect(html).toContain('role="alert"');
  });
});
