import { atom } from "../../editor-jotai";

export type ToolbarPosition = "top" | "left" | "right" | "bottom";
export type ToolbarSize = "s" | "m" | "l" | "xl";

/**
 * Where the style options (stroke, color, …) go when the toolbar is
 * customized:
 * - beside: docked next to the toolbar, shown when relevant, can be hidden
 * - button: hidden until you tap the Styles button on the toolbar
 * - inline: quick color + stroke buttons live on the toolbar itself
 * - strip:  a horizontal strip across the top of the screen
 */
export type StylesPlacement = "beside" | "button" | "inline" | "strip";

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
  styles: StylesPlacement;
  /** user tucked the docked style options away */
  stylesHidden: boolean;
  /** the stock full options panel, or the compact (tablet) one */
  panel: "full" | "compact";
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
  styles: "beside",
  stylesHidden: false,
  panel: "full",
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

/**
 * `?toolbar=left|right|top|bottom` turns the custom toolbar on (handy for
 * sharing a setup), `&styles=beside|button|inline|strip` picks where the
 * style options go. Saved like any other change.
 */
const applyUrlOverrides = (config: ToolbarConfig): ToolbarConfig => {
  try {
    const params = new URLSearchParams(window.location.search);
    const position = params.get("toolbar");
    const styles = params.get("styles");
    const panel = params.get("panel");
    const side = params.get("side");
    if (panel === "full" || panel === "compact") {
      config = { ...config, panel };
    }
    if (side === "left" || side === "right") {
      config = { ...config, panelSide: side };
    }
    const next = { ...config };
    if (position && ["left", "right", "top", "bottom"].includes(position)) {
      next.enabled = true;
      next.position = position as ToolbarPosition;
    }
    if (styles && ["beside", "button", "inline", "strip"].includes(styles)) {
      next.styles = styles as StylesPlacement;
      next.stylesHidden = false;
    }
    if (next !== config) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return next;
  } catch {
    return config;
  }
};

const baseToolbarConfigAtom = atom<ToolbarConfig>(
  applyUrlOverrides(loadConfig()),
);

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
