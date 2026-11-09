/**
 * PROTOTYPE: ways to add text on a tablet, switchable from a small picker so
 * they can be compared on the iPad. Each flow turns on one or more features;
 * the editor code asks `textFlowHas(feature)`.
 */
import { atom } from "../../editor-jotai";

export type TextFlowId =
  | "stock"
  | "button"
  | "doubletap"
  | "scribble"
  | "label"
  | "combo";

export type TextFlowFeature =
  /** Text sits on the toolbar and hands back the tool you came from */
  | "toolbarText"
  /** double-tap the canvas with any tool (Draw included) to type there */
  | "doubleTapAnywhere"
  /** a roomy writing box for Scribble, on-screen keyboard only on request */
  | "scribblePad"
  /** a tappable "add label" chip on empty shapes */
  | "labelChip";

export const TEXT_FLOWS: {
  id: TextFlowId;
  letter: string;
  label: string;
  hint: string;
  features: TextFlowFeature[];
}[] = [
  {
    id: "stock",
    letter: "–",
    label: "Today",
    hint: "No changes (for comparison)",
    features: [],
  },
  {
    id: "button",
    letter: "A",
    label: "Text button",
    hint: "Tap Text, tap where it goes; you land back on your tool",
    features: ["toolbarText"],
  },
  {
    id: "doubletap",
    letter: "B",
    label: "Double-tap",
    hint: "Double-tap with the Pencil in any tool, even Draw",
    features: ["doubleTapAnywhere"],
  },
  {
    id: "scribble",
    letter: "C",
    label: "Scribble box",
    hint: "Handwrite into a big box; keyboard stays hidden",
    features: ["toolbarText", "scribblePad"],
  },
  {
    id: "label",
    letter: "D",
    label: "Label chip",
    hint: "Tap the Aa chip on a shape to label it",
    features: ["labelChip"],
  },
  {
    id: "combo",
    letter: "B+C+D",
    label: "Combo",
    hint: "Double-tap anywhere + Scribble box + label chips",
    features: ["doubleTapAnywhere", "scribblePad", "labelChip"],
  },
];

const STORAGE_KEY = "excalidraw.textFlowPrototype";

const readStored = (): TextFlowId => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && TEXT_FLOWS.some((flow) => flow.id === value)) {
      return value as TextFlowId;
    }
  } catch {}
  return "combo";
};

// round 2: the double-tap + Scribble + chip combo is settled; what's being
// compared now is how a shape's label gets written (see LABEL_MODES)
let current: TextFlowId = "combo";
void readStored;

export const getTextFlow = () => current;

export const textFlowHas = (feature: TextFlowFeature) =>
  TEXT_FLOWS.find((flow) => flow.id === current)!.features.includes(feature);

const baseAtom = atom<TextFlowId>(current);

export const textFlowAtom = atom(
  (get) => get(baseAtom),
  (_get, set, next: TextFlowId) => {
    current = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    set(baseAtom, next);
  },
);

/** round 2: where you write a shape's label */
export type LabelMode = "inline" | "bubble" | "zoom" | "strip" | "anywhere";

export const LABEL_MODES: {
  id: LabelMode;
  letter: string;
  label: string;
  hint: string;
}[] = [
  {
    id: "inline",
    letter: "–",
    label: "In the shape",
    hint: "Round 1: the box sits on the shape",
  },
  {
    id: "bubble",
    letter: "1",
    label: "Bubble",
    hint: "Write in a big bubble beside the shape, pointing at it",
  },
  {
    id: "zoom",
    letter: "2",
    label: "Zoom in",
    hint: "The canvas zooms in so the shape is big enough to write in",
  },
  {
    id: "strip",
    letter: "3",
    label: "Bottom panel",
    hint: "Always write in a wide panel at the bottom, linked to the shape",
  },
  {
    id: "anywhere",
    letter: "4",
    label: "Write anywhere",
    hint: "Write anywhere on screen; the text appears in the shape",
  },
];

const LABEL_MODE_KEY = "excalidraw.labelModePrototype";

let currentLabelMode: LabelMode = (() => {
  try {
    const value = localStorage.getItem(LABEL_MODE_KEY);
    if (value && LABEL_MODES.some((mode) => mode.id === value)) {
      return value as LabelMode;
    }
  } catch {}
  return "bubble";
})();

export const getLabelMode = () => currentLabelMode;

const labelModeBaseAtom = atom<LabelMode>(currentLabelMode);

export const labelModeAtom = atom(
  (get) => get(labelModeBaseAtom),
  (_get, set, next: LabelMode) => {
    currentLabelMode = next;
    try {
      localStorage.setItem(LABEL_MODE_KEY, next);
    } catch {}
    set(labelModeBaseAtom, next);
  },
);
