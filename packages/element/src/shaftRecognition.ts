import { pointFrom } from "@excalidraw/math";

import type { GlobalPoint } from "@excalidraw/math";

// Recognizes open strokes that the moment-based recognizer (convertToShape)
// rejects as not straight:
// smooth curves and orthogonal elbows, each with or without an arrowhead drawn
// at the end of the same stroke.

export type ShaftRecognition = {
  kind: "curve" | "elbow";
  /** curve: start, middle, end; elbow: orthogonal corner points */
  points: GlobalPoint[];
  /** an arrowhead was drawn at the end of the stroke */
  hasHead: boolean;
};

const RESAMPLE_N = 64;

// An open stroke's endpoints are at least this fraction of its length apart.
const OPEN_MIN_GAP_RATIO = 0.25;

// Arrowhead drawn in the same stroke: a reversal (turn sharper than this)
// within the last HEAD_ZONE_RATIO of the stroke, followed by a short tail.
const HEAD_MIN_TURN = (125 * Math.PI) / 180;
const HEAD_ZONE_RATIO = 0.4;
const HEAD_MAX_LENGTH_RATIO = 0.5;
const TURN_WINDOW = 2;

// Elbow: simplified to 2–3 segments, each within this angle of an axis.
const ELBOW_MAX_AXIS_DEVIATION = (25 * Math.PI) / 180;
const ELBOW_MIN_SEGMENT_RATIO = 0.12;
const SIMPLIFY_EPSILON_RATIO = 0.08;

// Curve: a single smooth bend.
const CURVE_MIN_TOTAL_TURN = (25 * Math.PI) / 180;
const CURVE_MAX_TOTAL_TURN = (220 * Math.PI) / 180;
// total |turn| / |total turn|: ~1 for a bend in one direction
const CURVE_MAX_WIGGLE = 1.35;
// no sharp corners
const CURVE_MAX_LOCAL_TURN = (70 * Math.PI) / 180;
// bulges at least this far off its chord (else it's a straight line)
const CURVE_MIN_SAGITTA_RATIO = 0.08;

const dist = (a: GlobalPoint, b: GlobalPoint) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

const pathLength = (pts: readonly GlobalPoint[]) => {
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    length += dist(pts[i - 1], pts[i]);
  }
  return length;
};

export const resamplePath = (
  pts: readonly GlobalPoint[],
  n: number,
): GlobalPoint[] => {
  const total = pathLength(pts);
  if (total === 0 || pts.length < 2) {
    return Array.from({ length: n }, () => pts[0]);
  }
  const step = total / (n - 1);
  const result: GlobalPoint[] = [pts[0]];
  let target = step;
  let walked = 0;
  for (let i = 1; i < pts.length && result.length < n; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    while (seg > 0 && walked + seg >= target && result.length < n - 1) {
      const t = (target - walked) / seg;
      result.push(
        pointFrom<GlobalPoint>(
          pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]),
          pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]),
        ),
      );
      target += step;
    }
    walked += seg;
  }
  while (result.length < n) {
    result.push(pts[pts.length - 1]);
  }
  return result;
};

const signedTurn = (a: GlobalPoint, b: GlobalPoint, c: GlobalPoint) => {
  const v1x = b[0] - a[0];
  const v1y = b[1] - a[1];
  const v2x = c[0] - b[0];
  const v2y = c[1] - b[1];
  return Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y);
};

/** index of the arrowhead's tip if the stroke ends in one, else -1 */
const findHeadTip = (pts: readonly GlobalPoint[]) => {
  const turnAt = (i: number) =>
    Math.abs(
      signedTurn(
        pts[Math.max(i - TURN_WINDOW, 0)],
        pts[i],
        pts[Math.min(i + TURN_WINDOW, pts.length - 1)],
      ),
    );
  const firstCandidate = Math.floor(pts.length * (1 - HEAD_ZONE_RATIO));
  for (let i = Math.max(firstCandidate, 1); i < pts.length - 1; i++) {
    if (turnAt(i) >= HEAD_MIN_TURN) {
      // refine to the sharpest point of this reversal
      let tip = i;
      for (let j = i + 1; j <= Math.min(i + TURN_WINDOW, pts.length - 2); j++) {
        if (turnAt(j) > turnAt(tip)) {
          tip = j;
        }
      }
      return tip;
    }
  }
  return -1;
};

// Ramer–Douglas–Peucker
const simplify = (pts: GlobalPoint[], epsilon: number): GlobalPoint[] => {
  if (pts.length < 3) {
    return pts;
  }
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const length = dist(a, b);
  let maxDistance = -1;
  let index = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d =
      length === 0
        ? dist(p, a)
        : Math.abs(
            (b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1]),
          ) / length;
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }
  if (maxDistance <= epsilon) {
    return [a, b];
  }
  const left = simplify(pts.slice(0, index + 1), epsilon);
  const right = simplify(pts.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
};

const axisOf = (a: GlobalPoint, b: GlobalPoint): "h" | "v" | null => {
  const angle = Math.atan2(Math.abs(b[1] - a[1]), Math.abs(b[0] - a[0]));
  if (angle <= ELBOW_MAX_AXIS_DEVIATION) {
    return "h";
  }
  if (angle >= Math.PI / 2 - ELBOW_MAX_AXIS_DEVIATION) {
    return "v";
  }
  return null;
};

const recognizeElbow = (shaft: GlobalPoint[]): GlobalPoint[] | null => {
  const xs = shaft.map((p) => p[0]);
  const ys = shaft.map((p) => p[1]);
  const size = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  const simplified = simplify(shaft, SIMPLIFY_EPSILON_RATIO * size);
  if (simplified.length < 3 || simplified.length > 4) {
    return null;
  }
  const total = pathLength(simplified);
  const axes: ("h" | "v")[] = [];
  for (let i = 1; i < simplified.length; i++) {
    const axis = axisOf(simplified[i - 1], simplified[i]);
    if (
      !axis ||
      dist(simplified[i - 1], simplified[i]) < ELBOW_MIN_SEGMENT_RATIO * total
    ) {
      return null;
    }
    if (axes.length && axes[axes.length - 1] === axis) {
      return null;
    }
    axes.push(axis);
  }

  // snap to an orthogonal polyline that keeps both endpoints
  const start = simplified[0];
  const end = simplified[simplified.length - 1];
  const corners: GlobalPoint[] = [start];
  if (axes.length === 2) {
    corners.push(
      axes[0] === "h"
        ? pointFrom<GlobalPoint>(end[0], start[1])
        : pointFrom<GlobalPoint>(start[0], end[1]),
    );
  } else if (axes[0] === "h") {
    const midX = simplified[1][0];
    corners.push(pointFrom<GlobalPoint>(midX, start[1]));
    corners.push(pointFrom<GlobalPoint>(midX, end[1]));
  } else {
    const midY = simplified[1][1];
    corners.push(pointFrom<GlobalPoint>(start[0], midY));
    corners.push(pointFrom<GlobalPoint>(end[0], midY));
  }
  corners.push(end);
  return corners;
};

const recognizeCurve = (shaft: GlobalPoint[]): GlobalPoint[] | null => {
  const pts = resamplePath(shaft, 32);
  let total = 0;
  let absolute = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const turn = signedTurn(pts[i - 1], pts[i], pts[i + 1]);
    total += turn;
    absolute += Math.abs(turn);
  }
  if (
    Math.abs(total) < CURVE_MIN_TOTAL_TURN ||
    Math.abs(total) > CURVE_MAX_TOTAL_TURN ||
    absolute > CURVE_MAX_WIGGLE * Math.abs(total)
  ) {
    return null;
  }
  for (let i = TURN_WINDOW; i < pts.length - TURN_WINDOW; i++) {
    if (
      Math.abs(signedTurn(pts[i - TURN_WINDOW], pts[i], pts[i + TURN_WINDOW])) >
      CURVE_MAX_LOCAL_TURN
    ) {
      return null;
    }
  }

  const start = pts[0];
  const end = pts[pts.length - 1];
  const chord = dist(start, end);
  const mid = pts[Math.floor(pts.length / 2)];
  const sagitta =
    chord === 0
      ? 0
      : Math.abs(
          (end[0] - start[0]) * (start[1] - mid[1]) -
            (start[0] - mid[0]) * (end[1] - start[1]),
        ) / chord;
  if (sagitta < CURVE_MIN_SAGITTA_RATIO * chord) {
    return null;
  }
  return [start, mid, end];
};

export const recognizeShaft = (
  points: readonly GlobalPoint[],
): ShaftRecognition | null => {
  if (points.length < 3) {
    return null;
  }
  const pts = resamplePath(points, RESAMPLE_N);
  const length = pathLength(pts);
  if (length === 0) {
    return null;
  }

  let shaft = pts;
  let hasHead = false;
  const tip = findHeadTip(pts);
  if (tip > 0) {
    const shaftPart = pts.slice(0, tip + 1);
    const headLength = pathLength(pts.slice(tip));
    if (headLength <= HEAD_MAX_LENGTH_RATIO * pathLength(shaftPart)) {
      shaft = shaftPart;
      hasHead = true;
    }
  }

  const shaftLength = pathLength(shaft);
  if (
    dist(shaft[0], shaft[shaft.length - 1]) <
    OPEN_MIN_GAP_RATIO * shaftLength
  ) {
    return null;
  }
  const evenShaft = resamplePath(shaft, RESAMPLE_N);

  const elbow = recognizeElbow(evenShaft);
  if (elbow) {
    return { kind: "elbow", points: elbow, hasHead };
  }
  const curve = recognizeCurve(evenShaft);
  if (curve) {
    return { kind: "curve", points: curve, hasHead };
  }
  return null;
};
