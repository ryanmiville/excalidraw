import { isArrowElement, isElbowArrow } from "@excalidraw/element";

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

/** a quarter-ish arc from (cx - r, cy) over the top to (cx + r, cy) */
const arcPath = (
  cx: number,
  cy: number,
  r: number,
  from = Math.PI,
  to = Math.PI * 1.6,
): [number, number][] => {
  const points: [number, number][] = [];
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return points;
};

/** V arrowhead at `tip`, pointing along (dx, dy) */
const headAt = (
  tip: [number, number],
  dx: number,
  dy: number,
  size = 25,
): [number, number][] => {
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const arm = (sign: number): [number, number] => [
    tip[0] - size * (ux * 0.87 - sign * uy * 0.5),
    tip[1] - size * (uy * 0.87 + sign * ux * 0.5),
  ];
  return [...seg(arm(1), tip, 6), ...seg(tip, arm(-1), 6).slice(1)];
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

  it("recognizes a curved arrow drawn in one stroke", () => {
    const arc = arcPath(200, 200, 150, Math.PI, Math.PI * 1.75);
    const tip = arc[arc.length - 1];
    const before = arc[arc.length - 2];
    const dx = tip[0] - before[0];
    const dy = tip[1] - before[1];
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const arm1: [number, number] = [
      tip[0] - 30 * (ux * 0.87 - uy * 0.5),
      tip[1] - 30 * (uy * 0.87 + ux * 0.5),
    ];
    const arm2: [number, number] = [
      tip[0] - 30 * (ux * 0.87 + uy * 0.5),
      tip[1] - 30 * (uy * 0.87 - ux * 0.5),
    ];
    stroke([
      ...arc,
      ...seg(tip, arm1, 5).slice(1),
      ...seg(arm1, tip, 5).slice(1),
      ...seg(tip, arm2, 5).slice(1),
    ]);

    const elements = visible();
    expect(elements.map((e) => e.type)).toEqual(["arrow"]);
    const arrow = elements[0];
    expect(isArrowElement(arrow) && arrow.points.length).toBe(3);
    expect(arrow.roundness).not.toBe(null);
    expect(isArrowElement(arrow) && arrow.endArrowhead).toBe("arrow");
  });

  it("turns a curve into an arrow when its head is a separate stroke", () => {
    const arc = arcPath(200, 200, 150, Math.PI, Math.PI * 1.75);
    stroke(arc);
    expect(visible().map((e) => e.type)).toEqual(["freedraw"]);
    const tip = arc[arc.length - 1];
    const before = arc[arc.length - 3];
    stroke(headAt(tip, tip[0] - before[0], tip[1] - before[1]));

    const elements = visible();
    expect(elements.map((e) => e.type)).toEqual(["arrow"]);
    expect(elements[0].roundness).not.toBe(null);
  });

  it("recognizes an elbow arrow between two boxes", () => {
    stroke(rectanglePath(0, 0, 200, 120));
    stroke(rectanglePath(400, 300, 200, 120));
    // right from box A, then down into box B
    stroke([
      ...seg([205, 60], [500, 62], 20),
      ...seg([500, 62], [502, 295], 20),
    ]);

    const elements = visible();
    expect(elements.map((e) => e.type).sort()).toEqual([
      "arrow",
      "rectangle",
      "rectangle",
    ]);
    const arrow = elements.find(isArrowElement)!;
    expect(isElbowArrow(arrow)).toBe(true);
    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding).not.toBe(null);
  });

  it("recognizes a free-standing elbow arrow with a drawn head", () => {
    stroke([
      ...seg([0, 0], [300, 0], 20),
      ...seg([300, 0], [300, 200], 15).slice(1),
      ...headAt([300, 200], 0, 1, 30).slice(0),
    ]);
    const elements = visible();
    expect(elements.map((e) => e.type)).toEqual(["arrow"]);
    expect(isElbowArrow(elements[0])).toBe(true);
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
