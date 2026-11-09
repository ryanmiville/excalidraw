import { atom } from "../../editor-jotai";

export type ToolbarPosition = "top" | "left" | "right" | "bottom";
export type ToolbarSize = "s" | "m" | "l" | "xl";

export type ToolbarItemId =
  | "lock"
  | "hand"
  | "selection"
  | "lasso"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "freedraw"
  | "autoshape"
  | "text"
  | "stickynote"
  | "image"
  | "eraser"
  | "frame"
  | "laser"
  | "undo"
  | "redo"
  | "more";

export const ALL_TOOLBAR_ITEMS: readonly ToolbarItemId[] = [
  "lock",
  "hand",
  "selection",
  "lasso",
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "autoshape",
  "text",
  "stickynote",
  "image",
  "eraser",
  "frame",
  "laser",
  "undo",
  "redo",
  "more",
];

export const TOOLBAR_ITEM_LABELS: Record<ToolbarItemId, string> = {
  lock: "Lock",
  hand: "Hand",
  selection: "Select",
  lasso: "Lasso",
  rectangle: "Rectangle",
  diamond: "Diamond",
  ellipse: "Ellipse",
  arrow: "Arrow",
  line: "Line",
  freedraw: "Draw",
  autoshape: "Shapes",
  text: "Text",
  stickynote: "Note",
  image: "Image",
  eraser: "Erase",
  frame: "Frame",
  laser: "Laser",
  undo: "Undo",
  redo: "Redo",
  more: "More",
};

export type ToolbarConfig = {
  /** false = the stock Excalidraw toolbar */
  enabled: boolean;
  position: ToolbarPosition;
  size: ToolbarSize;
  labels: boolean;
  items: ToolbarItemId[];
  /** user tucked the docked style options away */
  stylesHidden: boolean;
  /**
   * which screen edge the options panel hugs; when it matches the toolbar's
   * edge, the panel docks right beside the toolbar
   */
  panelSide: "left" | "right";
};

export const DEFAULT_ITEMS: ToolbarItemId[] = [
  "lock",
  "hand",
  "selection",
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "autoshape",
  "text",
  "stickynote",
  "eraser",
  "more",
];

export const TOOLBAR_PRESETS: {
  id: string;
  label: string;
  items: ToolbarItemId[];
}[] = [
  {
    id: "pencil",
    label: "Pencil",
    items: ["selection", "freedraw", "eraser", "undo", "redo"],
  },
  {
    id: "pencil-shapes",
    label: "Pencil + shapes",
    items: ["selection", "freedraw", "autoshape", "eraser", "undo", "redo"],
  },
  {
    id: "pencil-text",
    label: "Pencil + text",
    items: [
      "selection",
      "freedraw",
      "autoshape",
      "text",
      "eraser",
      "undo",
      "redo",
      "more",
    ],
  },
  { id: "everything", label: "Everything", items: [...DEFAULT_ITEMS] },
];

export const DEFAULT_TOOLBAR_CONFIG: ToolbarConfig = {
  enabled: false,
  position: "left",
  size: "l",
  labels: true,
  items: TOOLBAR_PRESETS[1].items,
  stylesHidden: false,
  panelSide: "right",
};

const STORAGE_KEY = "excalidraw.toolbarConfig";

const loadConfig = (): ToolbarConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // older saved setups said "toolbar"/"opposite" instead of a side
      if (!parsed.panelSide && parsed.stylesSide) {
        const pos = parsed.position ?? DEFAULT_TOOLBAR_CONFIG.position;
        const same = pos === "left" || pos === "right" ? pos : "right";
        parsed.panelSide =
          parsed.stylesSide === "toolbar"
            ? same
            : same === "left"
            ? "right"
            : "left";
      }
      // settings from the exploration rounds that no longer exist
      delete parsed.styles;
      delete parsed.panel;
      delete parsed.stylesSide;
      return {
        ...DEFAULT_TOOLBAR_CONFIG,
        ...parsed,
        items: (parsed.items ?? DEFAULT_TOOLBAR_CONFIG.items).filter(
          (id: ToolbarItemId) => ALL_TOOLBAR_ITEMS.includes(id),
        ),
      };
    }
  } catch {}
  return DEFAULT_TOOLBAR_CONFIG;
};

const baseToolbarConfigAtom = atom<ToolbarConfig>(loadConfig());

export const toolbarConfigAtom = atom(
  (get) => get(baseToolbarConfigAtom),
  (get, set, update: Partial<ToolbarConfig>) => {
    const next = { ...get(baseToolbarConfigAtom), ...update };
    set(baseToolbarConfigAtom, next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  },
);

export const customizeToolbarOpenAtom = atom(false);

export const TOOLBAR_SIZES: Record<
  ToolbarSize,
  { button: string; icon: string }
> = {
  s: { button: "2.375rem", icon: "1.25rem" },
  m: { button: "3rem", icon: "1.5rem" },
  l: { button: "3.75rem", icon: "1.75rem" },
  xl: { button: "4.5rem", icon: "2.125rem" },
};
