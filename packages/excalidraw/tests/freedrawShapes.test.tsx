import { isArrowElement } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { Keyboard, Pointer } from "./helpers/ui";
import { act, render } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const stroke = (points: [number, number][]) => {
  const [startX, startY] = points[0];
  mouse.downAt(startX, startY);
  for (const [x, y] of points.slice(1)) {
    mouse.moveTo(x, y);
  }
  const [endX, endY] = points[points.length - 1];
  mouse.upAt(endX, endY);
};

/** a closed, roughly rectangular path */
const rectanglePath = (
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number][] => {
  const points: [number, number][] = [];
  const step = 10;
  for (let i = x; i <= x + width; i += step) {
    points.push([i, y]);
  }
  for (let i = y; i <= y + height; i += step) {
    points.push([x + width, i]);
  }
  for (let i = x + width; i >= x; i -= step) {
    points.push([i, y + height]);
  }
  for (let i = y + height; i >= y; i -= step) {
    points.push([x, i]);
  }
  points.push([x, y]);
  return points;
};

const seg = (
  from: [number, number],
  to: [number, number],
  steps: number,
): [number, number][] => {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    points.push([
      from[0] + ((to[0] - from[0]) * i) / steps,
      from[1] + ((to[1] - from[1]) * i) / steps,
    ]);
  }
  return points;
};

const visible = () => h.elements.filter((element) => !element.isDeleted);

describe("freedraw shape recognition", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    act(() => {
      h.app.setActiveTool({ type: "freedraw" });
    });
  });

  it("morphs two boxes and a connector into bound shapes", () => {
    stroke(rectanglePath(0, 0, 200, 120));
    stroke(rectanglePath(500, 0, 200, 120));
    stroke(seg([210, 60], [490, 60], 30));

    const elements = visible();
    expect(elements.map((element) => element.type).sort()).toEqual([
      "arrow",
      "rectangle",
      "rectangle",
    ]);
    const [rectA, rectB] = elements.filter((e) => e.type === "rectangle");
    expect(rectA.x).toBeCloseTo(0, -1);
    expect(rectA.width).toBeCloseTo(200, -1);
    expect(rectB.x).toBeCloseTo(500, -1);

    const arrow = elements.find(isArrowElement)!;
    expect(arrow.startBinding?.elementId).toBe(rectA.id);
    expect(arrow.endBinding?.elementId).toBe(rectB.id);
    expect(arrow.endArrowhead).not.toBe(null);
    expect(h.state.activeTool.type).toBe("freedraw");
  });

  it("uses the current stroke color", () => {
    act(() => {
      h.setState({ currentItemStrokeColor: "#e03131" });
    });
    stroke(rectanglePath(0, 0, 200, 120));
    expect(visible()[0].type).toBe("rectangle");
    expect(visible()[0].strokeColor).toBe("#e03131");
  });

  it("absorbs an arrowhead drawn as a separate stroke", () => {
    stroke(seg([0, 0], [300, 0], 30));
    expect(visible().map((e) => e.type)).toEqual(["line"]);

    // a "V" head at the right end
    stroke([...seg([270, -25], [300, 0], 6), ...seg([300, 0], [270, 25], 6)]);

    const elements = visible();
    expect(elements.map((e) => e.type)).toEqual(["arrow"]);
    const arrow = elements[0];
    expect(isArrowElement(arrow) && arrow.endArrowhead).toBe("arrow");
    expect(isArrowElement(arrow) && arrow.startArrowhead).toBe(null);
  });

  it("moves an automatic connector head to the end the user drew it at", () => {
    stroke(rectanglePath(0, 0, 200, 120));
    stroke(rectanglePath(500, 0, 200, 120));
    stroke(seg([490, 60], [210, 60], 30));
    // head drawn at the start (right) end instead
    stroke([...seg([440, 35], [470, 60], 6), ...seg([470, 60], [440, 85], 6)]);

    const arrow = visible().find(isArrowElement)!;
    expect(arrow.startArrowhead).toBe("arrow");
    expect(arrow.endArrowhead).toBe(null);
  });

  it("undoes a morphed shape in one step without leaving the ink", () => {
    stroke(rectanglePath(0, 0, 200, 120));
    expect(visible().map((e) => e.type)).toEqual(["rectangle"]);
    Keyboard.undo();
    expect(visible()).toEqual([]);
    Keyboard.redo();
    expect(visible().map((e) => e.type)).toEqual(["rectangle"]);
  });

  it("keeps unrecognized strokes and small handwriting as ink", () => {
    stroke([
      [0, 0],
      [40, 80],
      [80, 0],
      [120, 80],
      [160, 0],
      [200, 80],
    ]);
    stroke(rectanglePath(400, 0, 20, 20));
    expect(visible().map((e) => e.type)).toEqual(["freedraw", "freedraw"]);
  });
});
