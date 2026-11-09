import {
  convertToShape,
  getBoundsFromPoints,
  isArrowElement,
  isLinearElement,
  isLineElement,
  LinearElementEditor,
  newArrowElement,
  recognizeShape,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type {
  Arrowhead,
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "@excalidraw/element/types";
import type { GlobalPoint } from "@excalidraw/math";

import type App from "./App";

// Minimum on-screen size (px) of a freedraw stroke before it may morph into a
// shape. Higher than the dedicated "draw to shape" tool's gate so handwriting
// (an "o", an "l") stays ink.
const MIN_CLOSED_SHAPE_SCREEN_SIZE = 48;
const MIN_LINEAR_SCREEN_SIZE = 64;

// A follow-up stroke drawn within this long after a recognized line/arrow, near
// one of its ends, may be an arrowhead drawn as a separate stroke.
const ARROWHEAD_FOLLOWUP_MS = 4000;
// The arrowhead stroke must be small: relative to the shaft, and on screen.
const ARROWHEAD_MAX_SHAFT_RATIO = 0.6;
const ARROWHEAD_MAX_SCREEN_SIZE = 160;
// How close (closest stroke point → shaft end) the arrowhead must start.
const ARROWHEAD_MAX_END_DISTANCE_RATIO = 0.25;
const ARROWHEAD_MIN_END_DISTANCE_SCREEN = 36;

type LastLinear = {
  id: string;
  at: number;
  /** the end that got an arrowhead automatically (connector upgrade), not
   * because the user drew it */
  autoHeadEnd: "start" | "end" | null;
};

/**
 * Shape recognition for the regular freedraw (pen) tool: when a stroke is
 * finished and it reads clearly as a rectangle, ellipse, diamond, line or
 * arrow, it morphs into that element using the current item style. Strokes
 * that aren't recognized stay as ink.
 *
 * Arrowheads may be drawn as separate strokes after the shaft: a small stroke
 * finishing near either end of the line/arrow recognized just before is
 * absorbed as that end's arrowhead.
 */
export class AppFreedrawShapes {
  enabled = true;

  private lastLinear: LastLinear | null = null;

  constructor(private app: App) {}

  private deleteElement = (element: ExcalidrawElement) => {
    const { scene } = this.app;
    // mutate in place so references held elsewhere (e.g. appState.newElement
    // during finalize) stay in sync, then refresh the scene's non-deleted
    // caches, which in-place mutation doesn't invalidate
    scene.mutateElement(element, { isDeleted: true });
    scene.replaceAllElements(scene.getElementsIncludingDeleted());
  };

  /**
   * Called on pointerup of a freedraw stroke, before `actionFinalize`. Returns
   * true if the stroke was consumed (it is then marked deleted).
   */
  handleStrokeEnd = (stroke: NonDeleted<ExcalidrawFreeDrawElement>) => {
    if (!this.enabled || stroke.points.length < 3) {
      return false;
    }

    const points = stroke.points.map(([x, y]) =>
      pointFrom<GlobalPoint>(stroke.x + x, stroke.y + y),
    );

    if (this.tryAbsorbArrowhead(stroke, points)) {
      return true;
    }

    const zoom = this.app.state.zoom.value;
    const recognized = recognizeShape(points, null, zoom);
    if (recognized.type === "freedraw") {
      return false;
    }
    const [minX, minY, maxX, maxY] = recognized.boundingBox;
    const screenSize = Math.max(maxX - minX, maxY - minY) * zoom;
    const isLinear = recognized.type === "line" || recognized.type === "arrow";
    if (
      screenSize <
      (isLinear ? MIN_LINEAR_SCREEN_SIZE : MIN_CLOSED_SHAPE_SCREEN_SIZE)
    ) {
      return false;
    }

    const detected = convertToShape(
      points,
      this.app.state,
      this.app.scene.getNonDeletedElementsMap(),
      null,
      this.app.scene.getNonDeletedFramesLikes(),
    );
    if (!detected || detected.type === "freedraw") {
      return false;
    }

    this.deleteElement(stroke);
    const inserted = this.app.drawShape.commitRecognizedElement(detected);

    if (isLinearElement(inserted)) {
      this.lastLinear = {
        id: inserted.id,
        at: Date.now(),
        // a line upgraded to a connector arrow got its end head for free
        autoHeadEnd:
          detected.type === "line" && isArrowElement(inserted) ? "end" : null,
      };
    } else {
      this.lastLinear = null;
    }
    return true;
  };

  private tryAbsorbArrowhead = (
    stroke: NonDeleted<ExcalidrawFreeDrawElement>,
    points: GlobalPoint[],
  ): boolean => {
    const { app } = this;
    const last = this.lastLinear;
    if (!last || Date.now() - last.at > ARROWHEAD_FOLLOWUP_MS) {
      return false;
    }
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const shaft = elementsMap.get(last.id);
    if (!shaft || !isLinearElement(shaft) || shaft.points.length < 2) {
      this.lastLinear = null;
      return false;
    }

    const zoom = app.state.zoom.value;
    const start = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      shaft,
      0,
      elementsMap,
    );
    const end = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      shaft,
      -1,
      elementsMap,
    );
    const shaftLength = Math.hypot(end[0] - start[0], end[1] - start[1]);

    const [minX, minY, maxX, maxY] = getBoundsFromPoints(points);
    const strokeSize = Math.max(maxX - minX, maxY - minY);
    if (
      strokeSize > ARROWHEAD_MAX_SHAFT_RATIO * shaftLength ||
      strokeSize * zoom > ARROWHEAD_MAX_SCREEN_SIZE
    ) {
      return false;
    }

    const distanceTo = (target: GlobalPoint) =>
      Math.min(
        ...points.map((p) => Math.hypot(p[0] - target[0], p[1] - target[1])),
      );
    const startDistance = distanceTo(start);
    const endDistance = distanceTo(end);
    const maxDistance = Math.max(
      ARROWHEAD_MAX_END_DISTANCE_RATIO * shaftLength,
      ARROWHEAD_MIN_END_DISTANCE_SCREEN / zoom,
    );
    const which: "start" | "end" =
      startDistance < endDistance ? "start" : "end";
    if (Math.min(startDistance, endDistance) > maxDistance) {
      return false;
    }

    const head: Arrowhead =
      app.state.currentItemEndArrowhead ??
      (isArrowElement(shaft) ? shaft.endArrowhead : null) ??
      "arrow";

    this.deleteElement(stroke);

    if (isArrowElement(shaft)) {
      let startArrowhead = shaft.startArrowhead;
      let endArrowhead = shaft.endArrowhead;
      if (last.autoHeadEnd && last.autoHeadEnd !== which) {
        // the user drew the head at the other end: move the automatic one
        const autoHead =
          last.autoHeadEnd === "start" ? startArrowhead : endArrowhead;
        if (last.autoHeadEnd === "start") {
          startArrowhead = null;
        } else {
          endArrowhead = null;
        }
        if (which === "start") {
          startArrowhead = autoHead ?? head;
        } else {
          endArrowhead = autoHead ?? head;
        }
      } else if (which === "start") {
        startArrowhead = startArrowhead ?? head;
      } else {
        endArrowhead = endArrowhead ?? head;
      }
      app.scene.mutateElement(shaft, { startArrowhead, endArrowhead });
      this.lastLinear = { id: shaft.id, at: Date.now(), autoHeadEnd: null };
      return true;
    }

    if (isLineElement(shaft)) {
      const arrow = this.lineToArrow(shaft, which, head);
      this.deleteElement(shaft);
      app.insertNewElement(arrow);
      if (app.state.isBindingEnabled) {
        app.drawShape.bindRecognizedArrow(arrow);
      }
      this.lastLinear = { id: arrow.id, at: Date.now(), autoHeadEnd: null };
      return true;
    }

    return false;
  };

  private lineToArrow = (
    line: NonDeleted<ExcalidrawLinearElement>,
    which: "start" | "end",
    head: Arrowhead,
  ) =>
    newArrowElement({
      type: "arrow",
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
      startArrowhead: which === "start" ? head : null,
      endArrowhead: which === "end" ? head : null,
      points: line.points,
      groupIds: line.groupIds,
      frameId: line.frameId,
      locked: false,
      angle: line.angle,
      roundness: line.roundness,
      strokeColor: line.strokeColor,
      backgroundColor: line.backgroundColor,
      fillStyle: line.fillStyle,
      roughness: line.roughness,
      opacity: line.opacity,
      strokeStyle: line.strokeStyle,
      strokeWidth: line.strokeWidth,
    });
}
