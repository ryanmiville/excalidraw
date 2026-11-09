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

let current: TextFlowId = readStored();

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
