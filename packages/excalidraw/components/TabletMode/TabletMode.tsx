/**
 * Tablet UI prototypes: thumb-reachable mode switching (select / draw /
 * erase) for landscape iPad + Apple Pencil use. Enabled with `?tablet=a…e`.
 *
 * These are design explorations, kept self-contained so the variants can be
 * compared side by side and the winner later folded into the real UI.
 */
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_STROKE_COLOR_INDEX,
} from "@excalidraw/common";

import { showSelectedShapeActions } from "@excalidraw/element";

import type { StrokeWidthKey } from "@excalidraw/common";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { CompactShapeActions } from "../Actions";
import { useExcalidrawContainer } from "../App";
import { Island } from "../Island";
import {
  drawShapeToolIcon,
  EraserIcon,
  FreedrawIcon,
  LassoIcon,
  SelectionIcon,
} from "../icons";

import "./TabletMode.scss";

import type { ActionManager } from "../../actions/manager";
import type { AppClassProperties, AppState, UIAppState } from "../../types";

export const TABLET_VARIANTS = ["a", "b", "c", "d", "e"] as const;
export type TabletVariant = typeof TABLET_VARIANTS[number];

export const TABLET_VARIANT_NAMES: Record<TabletVariant, string> = {
  a: "Thumb rail",
  b: "Thumb arc",
  c: "Hold to switch",
  d: "Mode drawer",
  e: "Swipe puck",
};

export const getTabletVariant = (): TabletVariant | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const value = new URLSearchParams(window.location.search).get("tablet");
  return TABLET_VARIANTS.includes(value as TabletVariant)
    ? (value as TabletVariant)
    : null;
};

type Mode = "select" | "draw" | "erase";
type DrawFlavor = "ink" | "shapes";

const MODES: Mode[] = ["select", "draw", "erase"];

const QUICK_COLORS = [
  COLOR_PALETTE.black,
  COLOR_PALETTE.red[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.blue[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.green[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.orange[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
];

const WIDTHS: StrokeWidthKey[] = ["thin", "medium", "bold"];
const WIDTH_DOT: Record<StrokeWidthKey, number> = {
  thin: 4,
  medium: 8,
  bold: 13,
};

const FLAVOR_KEY = "excalidraw.tablet.drawFlavor";

const readFlavor = (): DrawFlavor => {
  try {
    return localStorage.getItem(FLAVOR_KEY) === "shapes" ? "shapes" : "ink";
  } catch {
    return "ink";
  }
};

const getMode = (appState: UIAppState): Mode | null => {
  switch (appState.activeTool.type) {
    case "selection":
    case "lasso":
      return "select";
    case "freedraw":
    case "autoshape":
      return "draw";
    case "eraser":
      return "erase";
    default:
      return null;
  }
};

const MODE_LABEL: Record<Mode, string> = {
  select: "Select",
  draw: "Draw",
  erase: "Erase",
};

type Props = {
  variant: TabletVariant;
  app: AppClassProperties;
  appState: UIAppState;
  setAppState: React.Component<any, AppState>["setState"];
  actionManager: ActionManager;
  elements: readonly NonDeletedExcalidrawElement[];
};

const useTabletControls = ({ app, appState, actionManager }: Props) => {
  const [flavor, setFlavorState] = useState<DrawFlavor>(readFlavor);
  const mode = getMode(appState);

  const setFlavor = (next: DrawFlavor) => {
    setFlavorState(next);
    try {
      localStorage.setItem(FLAVOR_KEY, next);
    } catch {}
    if (mode === "draw") {
      app.setActiveTool({ type: next === "shapes" ? "autoshape" : "freedraw" });
    }
  };

  const setMode = (next: Mode, nextFlavor = flavor) => {
    if (next === "select") {
      app.setActiveTool({ type: app.state.preferredSelectionTool.type });
    } else if (next === "draw") {
      app.setActiveTool({
        type: nextFlavor === "shapes" ? "autoshape" : "freedraw",
      });
    } else {
      app.setActiveTool({ type: "eraser" });
    }
  };

  const setColor = (color: string) => {
    actionManager.executeAction(actionManager.actions.changeStrokeColor, "ui", {
      color,
      currentItemStrokeColor: color,
    });
  };

  const setWidth = (width: StrokeWidthKey) => {
    actionManager.executeAction(
      actionManager.actions.changeStrokeWidth,
      "ui",
      width,
    );
  };

  const drawIcon = flavor === "shapes" ? drawShapeToolIcon : FreedrawIcon;
  const selectIcon =
    app.state.preferredSelectionTool.type === "lasso"
      ? LassoIcon
      : SelectionIcon;

  const icons: Record<Mode, React.ReactNode> = {
    select: selectIcon,
    draw: drawIcon,
    erase: EraserIcon,
  };

  return {
    mode,
    setMode,
    flavor,
    setFlavor,
    setColor,
    setWidth,
    icons,
    color: appState.currentItemStrokeColor,
    width: appState.currentItemStrokeWidthKey,
  };
};

type Controls = ReturnType<typeof useTabletControls>;

// -----------------------------------------------------------------------------
// shared bits
// -----------------------------------------------------------------------------

const UndoRedo = ({
  actionManager,
  className,
}: {
  actionManager: ActionManager;
  className?: string;
}) => (
  <div className={clsx("tm-undo-redo", className)}>
    {actionManager.renderAction("undo")}
    {actionManager.renderAction("redo")}
  </div>
);

const ColorDots = ({
  controls,
  className,
}: {
  controls: Controls;
  className?: string;
}) => (
  <div className={clsx("tm-colors", className)}>
    {QUICK_COLORS.map((c) => (
      <button
        key={c}
        type="button"
        className={clsx("tm-color", { "is-active": controls.color === c })}
        style={{ "--tm-swatch": c } as React.CSSProperties}
        onClick={() => controls.setColor(c)}
        aria-label={c}
      />
    ))}
  </div>
);

const WidthDots = ({
  controls,
  className,
}: {
  controls: Controls;
  className?: string;
}) => (
  <div className={clsx("tm-widths", className)}>
    {WIDTHS.map((w) => (
      <button
        key={w}
        type="button"
        className={clsx("tm-width", { "is-active": controls.width === w })}
        onClick={() => controls.setWidth(w)}
        aria-label={w}
      >
        <span
          style={{
            width: WIDTH_DOT[w],
            height: WIDTH_DOT[w],
            background: controls.color,
          }}
        />
      </button>
    ))}
  </div>
);

const FlavorToggle = ({ controls }: { controls: Controls }) => (
  <div className="tm-segmented">
    <button
      type="button"
      className={clsx({ "is-active": controls.flavor === "ink" })}
      onClick={() => controls.setFlavor("ink")}
    >
      {FreedrawIcon}
      <span>Ink</span>
    </button>
    <button
      type="button"
      className={clsx({ "is-active": controls.flavor === "shapes" })}
      onClick={() => controls.setFlavor("shapes")}
    >
      {drawShapeToolIcon}
      <span>Shapes</span>
    </button>
  </div>
);

/** The existing compact styles panel, relocated to the right edge. */
const RightStylesPanel = (props: Props) => {
  const { app, appState, elements, actionManager, setAppState } = props;
  if (!showSelectedShapeActions(appState, elements)) {
    return null;
  }
  return (
    <Island className="tm-right-styles" padding={0}>
      <CompactShapeActions
        appState={appState}
        elementsMap={app.scene.getNonDeletedElementsMap()}
        renderAction={actionManager.renderAction}
        app={app}
        setAppState={setAppState}
      />
    </Island>
  );
};

const ModeButton = ({
  mode,
  controls,
  size = "lg",
  onTap,
}: {
  mode: Mode;
  controls: Controls;
  size?: "lg" | "md";
  onTap?: () => void;
}) => (
  <button
    type="button"
    className={clsx("tm-mode-btn", `tm-mode-btn--${size}`, {
      "is-active": controls.mode === mode,
    })}
    data-testid={`tablet-mode-${mode}`}
    onClick={onTap ?? (() => controls.setMode(mode))}
  >
    <span className="tm-mode-btn__icon">{controls.icons[mode]}</span>
    <span className="tm-mode-btn__label">
      {mode === "draw" && controls.flavor === "shapes"
        ? "Shapes"
        : MODE_LABEL[mode]}
    </span>
  </button>
);

// -----------------------------------------------------------------------------
// A — Thumb rail
// -----------------------------------------------------------------------------

const ThumbRail = (props: Props) => {
  const controls = useTabletControls(props);
  return (
    <>
      <Island className="tm-rail" padding={1}>
        {MODES.map((m) => (
          <ModeButton
            key={m}
            mode={m}
            controls={controls}
            onTap={
              m === "draw"
                ? () => {
                    // tapping Draw again flips between ink and shapes
                    if (controls.mode === "draw") {
                      controls.setFlavor(
                        controls.flavor === "ink" ? "shapes" : "ink",
                      );
                    } else {
                      controls.setMode("draw");
                    }
                  }
                : undefined
            }
          />
        ))}
        <div className="tm-sep" />
        <UndoRedo actionManager={props.actionManager} className="tm-col" />
      </Island>
      <RightStylesPanel {...props} />
    </>
  );
};

// -----------------------------------------------------------------------------
// B — Thumb arc
// -----------------------------------------------------------------------------

const ARC = {
  w: 250,
  h: 480,
  cy: 240,
  hub: 50,
  inner: 56,
  outer: 150,
  swatchR: 196,
};

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: r * Math.cos(a), y: ARC.cy + r * Math.sin(a) };
};

const wedgePath = (r0: number, r1: number, a0: number, a1: number) => {
  const p0 = polar(r1, a0);
  const p1 = polar(r1, a1);
  const p2 = polar(r0, a1);
  const p3 = polar(r0, a0);
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${r1} ${r1} 0 0 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${r0} ${r0} 0 0 0 ${p3.x} ${p3.y}`,
    "Z",
  ].join(" ");
};

const ARC_WEDGES: { mode: Mode; a0: number; a1: number }[] = [
  { mode: "select", a0: -88, a1: -31 },
  { mode: "draw", a0: -29, a1: 29 },
  { mode: "erase", a0: 31, a1: 88 },
];

const ThumbArc = (props: Props) => {
  const controls = useTabletControls(props);
  const [open, setOpen] = useState(false);

  const swatches = [
    ...QUICK_COLORS.map((c) => ({ kind: "color" as const, value: c })),
    ...WIDTHS.map((w) => ({ kind: "width" as const, value: w })),
  ];
  const step = 130 / (swatches.length - 1);

  return (
    <>
      <div
        className={clsx("tm-arc", { "is-open": open })}
        style={{ width: ARC.w, height: ARC.h }}
      >
        <svg width={ARC.w} height={ARC.h} className="tm-arc__svg">
          <path
            className="tm-arc__ring"
            d={wedgePath(ARC.outer + 22, ARC.swatchR + 26, -76, 76)}
          />
          {ARC_WEDGES.map(({ mode, a0, a1 }) => (
            <path
              key={mode}
              d={wedgePath(ARC.inner, ARC.outer, a0, a1)}
              className={clsx("tm-arc__wedge", {
                "is-active": controls.mode === mode,
              })}
              onClick={() => {
                if (mode === "draw" && controls.mode === "draw") {
                  controls.setFlavor(
                    controls.flavor === "ink" ? "shapes" : "ink",
                  );
                } else {
                  controls.setMode(mode);
                }
              }}
              data-testid={`tablet-mode-${mode}`}
            />
          ))}
          <path
            className="tm-arc__hub"
            d={`M 0 ${ARC.cy - ARC.hub} A ${ARC.hub} ${ARC.hub} 0 0 1 0 ${
              ARC.cy + ARC.hub
            } Z`}
            onClick={() => setOpen((o) => !o)}
            data-testid="tablet-arc-hub"
          />
        </svg>
        {ARC_WEDGES.map(({ mode, a0, a1 }) => {
          const p = polar((ARC.inner + ARC.outer) / 2 + 4, (a0 + a1) / 2);
          return (
            <div
              key={mode}
              className={clsx("tm-arc__label", {
                "is-active": controls.mode === mode,
              })}
              style={{ left: p.x, top: p.y }}
            >
              {controls.icons[mode]}
              <span>
                {mode === "draw" && controls.flavor === "shapes"
                  ? "Shapes"
                  : MODE_LABEL[mode]}
              </span>
            </div>
          );
        })}
        <div
          className="tm-arc__hub-dot"
          style={{
            top: ARC.cy,
            width: WIDTH_DOT[controls.width] + 12,
            height: WIDTH_DOT[controls.width] + 12,
            background: controls.color,
          }}
        />
        {swatches.map((s, i) => {
          const p = polar(ARC.swatchR, -65 + i * step);
          const active =
            s.kind === "color"
              ? controls.color === s.value
              : controls.width === s.value;
          return (
            <button
              key={s.value}
              type="button"
              className={clsx("tm-arc__swatch", `tm-arc__swatch--${s.kind}`, {
                "is-active": active,
              })}
              style={
                {
                  left: p.x,
                  top: p.y,
                  transitionDelay: open ? `${i * 18}ms` : "0ms",
                  "--tm-swatch": s.kind === "color" ? s.value : controls.color,
                } as React.CSSProperties
              }
              onClick={() =>
                s.kind === "color"
                  ? controls.setColor(s.value)
                  : controls.setWidth(s.value as StrokeWidthKey)
              }
            >
              {s.kind === "width" && (
                <span
                  style={{
                    width: WIDTH_DOT[s.value as StrokeWidthKey],
                    height: WIDTH_DOT[s.value as StrokeWidthKey],
                  }}
                />
              )}
            </button>
          );
        })}
        <UndoRedo
          actionManager={props.actionManager}
          className="tm-arc__undo"
        />
      </div>
      <RightStylesPanel {...props} />
    </>
  );
};

// -----------------------------------------------------------------------------
// C — Hold to switch (quasimode: draw is home, hold a pad to borrow a tool)
// -----------------------------------------------------------------------------

const HOLD_MS = 250;

const HoldPad = ({
  mode,
  controls,
  latched,
  setLatched,
}: {
  mode: Mode;
  controls: Controls;
  latched: Mode | null;
  setLatched: (m: Mode | null) => void;
}) => {
  const downAt = useRef(0);
  const [held, setHeld] = useState(false);
  const active = controls.mode === mode;

  return (
    <button
      type="button"
      className={clsx("tm-pad", {
        "is-active": active,
        "is-held": held,
        "is-latched": latched === mode,
      })}
      data-testid={`tablet-mode-${mode}`}
      onPointerDown={(e) => {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        downAt.current = performance.now();
        setHeld(true);
        if (latched === mode) {
          return;
        }
        controls.setMode(mode);
      }}
      onPointerUp={() => {
        setHeld(false);
        const heldFor = performance.now() - downAt.current;
        if (heldFor >= HOLD_MS) {
          // spring back to drawing
          setLatched(null);
          controls.setMode("draw");
        } else if (latched === mode) {
          setLatched(null);
          controls.setMode("draw");
        } else {
          setLatched(mode);
        }
      }}
      onPointerCancel={() => setHeld(false)}
    >
      <span className="tm-pad__icon">{controls.icons[mode]}</span>
      <span className="tm-pad__label">{MODE_LABEL[mode]}</span>
      <span className="tm-pad__hint">
        {latched === mode ? "tap to drop" : held ? "release to draw" : "hold"}
      </span>
    </button>
  );
};

const HoldToSwitch = (props: Props) => {
  const controls = useTabletControls(props);
  const [latched, setLatched] = useState<Mode | null>(null);

  // draw is home base
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (
        getMode(props.app.state) !== "draw" &&
        Object.keys(props.app.state.selectedElementIds).length === 0
      ) {
        controls.setMode("draw");
      }
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="tm-pads">
        <HoldPad
          mode="select"
          controls={controls}
          latched={latched}
          setLatched={setLatched}
        />
        <button
          type="button"
          className={clsx("tm-home", { "is-active": controls.mode === "draw" })}
          onClick={() => {
            if (controls.mode === "draw") {
              controls.setFlavor(controls.flavor === "ink" ? "shapes" : "ink");
            } else {
              setLatched(null);
              controls.setMode("draw");
            }
          }}
          data-testid="tablet-mode-draw"
        >
          {controls.icons.draw}
          <span>{controls.flavor === "shapes" ? "Shapes" : "Ink"}</span>
        </button>
        <HoldPad
          mode="erase"
          controls={controls}
          latched={latched}
          setLatched={setLatched}
        />
      </div>
      <Island className="tm-strip" padding={1}>
        <FlavorToggle controls={controls} />
        <div className="tm-vsep" />
        <ColorDots controls={controls} />
        <div className="tm-vsep" />
        <WidthDots controls={controls} />
        <div className="tm-vsep" />
        <UndoRedo actionManager={props.actionManager} />
      </Island>
      <RightStylesPanel {...props} />
    </>
  );
};

// -----------------------------------------------------------------------------
// D — Mode drawer (styles live next to the thumb, per mode)
// -----------------------------------------------------------------------------

const ModeDrawer = (props: Props) => {
  const controls = useTabletControls(props);
  const [collapsed, setCollapsed] = useState(false);
  const { app, appState, elements, actionManager, setAppState } = props;
  const hasSelection = Object.keys(appState.selectedElementIds).length > 0;

  let drawer: React.ReactNode = null;
  if (controls.mode === "draw") {
    drawer = (
      <>
        <div className="tm-drawer__title">Pen</div>
        <FlavorToggle controls={controls} />
        <div className="tm-drawer__title">Color</div>
        <ColorDots controls={controls} className="tm-colors--grid" />
        <div className="tm-drawer__title">Stroke</div>
        <WidthDots controls={controls} />
      </>
    );
  } else if (controls.mode === "select") {
    drawer =
      hasSelection && showSelectedShapeActions(appState, elements) ? (
        <>
          <div className="tm-drawer__title">Selection</div>
          <div className="tm-drawer__compact">
            <CompactShapeActions
              appState={appState}
              elementsMap={app.scene.getNonDeletedElementsMap()}
              renderAction={actionManager.renderAction}
              app={app}
              setAppState={setAppState}
            />
          </div>
        </>
      ) : (
        <>
          <div className="tm-drawer__title">Select with</div>
          <div className="tm-segmented tm-segmented--col">
            <button
              type="button"
              className={clsx({
                "is-active": app.state.preferredSelectionTool.type !== "lasso",
              })}
              onClick={() => {
                setAppState({
                  preferredSelectionTool: {
                    type: "selection",
                    initialized: true,
                  },
                });
                app.setActiveTool({ type: "selection" });
              }}
            >
              {SelectionIcon}
              <span>Box</span>
            </button>
            <button
              type="button"
              className={clsx({
                "is-active": app.state.preferredSelectionTool.type === "lasso",
              })}
              onClick={() => {
                setAppState({
                  preferredSelectionTool: { type: "lasso", initialized: true },
                });
                app.setActiveTool({ type: "lasso" });
              }}
            >
              {LassoIcon}
              <span>Lasso</span>
            </button>
          </div>
          <div className="tm-drawer__hint">
            Tap or drag around things to select them. Their styles show up here.
          </div>
        </>
      );
  } else if (controls.mode === "erase") {
    drawer = (
      <>
        <div className="tm-drawer__title">Eraser</div>
        <div className="tm-drawer__hint">
          Scribble over strokes to erase them. Undo is right below.
        </div>
      </>
    );
  }

  return (
    <Island
      className={clsx("tm-drawer", { "is-collapsed": collapsed || !drawer })}
      padding={0}
    >
      <div className="tm-drawer__rail">
        {MODES.map((m) => (
          <ModeButton key={m} mode={m} controls={controls} />
        ))}
        <div className="tm-sep" />
        <UndoRedo actionManager={actionManager} className="tm-col" />
      </div>
      <div className="tm-drawer__panel">
        <div className="tm-drawer__panel-inner">{drawer}</div>
      </div>
      {drawer && (
        <button
          type="button"
          className="tm-drawer__handle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label="toggle drawer"
          data-testid="tablet-drawer-handle"
        >
          <span />
        </button>
      )}
    </Island>
  );
};

// -----------------------------------------------------------------------------
// E — Swipe puck (one big target; swipe to change, tap to flip draw/select)
// -----------------------------------------------------------------------------

const SwipePuck = (props: Props) => {
  const controls = useTabletControls(props);
  const start = useRef<{ y: number; t: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [drag, setDrag] = useState(0);
  const [fanOpen, setFanOpen] = useState(false);
  const longPress = useRef<number | null>(null);
  const index = controls.mode ? MODES.indexOf(controls.mode) : 0;

  const go = (m: Mode) => {
    controls.setMode(m);
    setFlash(MODE_LABEL[m]);
    window.setTimeout(() => setFlash(null), 700);
  };

  return (
    <>
      <RightStylesPanel {...props} />
      <div className="tm-puck-wrap">
        <div className="tm-puck-track">
          {MODES.map((m, i) => (
            <button
              key={m}
              type="button"
              className={clsx("tm-puck-ghost", {
                "is-active": i === index,
              })}
              style={{ top: `calc(50% + ${(i - index) * 66}px)` }}
              onClick={() => go(m)}
            >
              {controls.icons[m]}
            </button>
          ))}
          <button
            type="button"
            className={clsx("tm-puck", `tm-puck--${controls.mode ?? "select"}`)}
            style={
              {
                "--tm-swatch": controls.color,
                transform: `translateY(calc(-50% + ${drag}px))`,
              } as React.CSSProperties
            }
            data-testid="tablet-puck"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              start.current = { y: e.clientY, t: performance.now() };
              longPress.current = window.setTimeout(() => {
                setFanOpen(true);
                start.current = null;
              }, 450);
            }}
            onPointerMove={(e) => {
              if (!start.current) {
                return;
              }
              const dy = e.clientY - start.current.y;
              if (Math.abs(dy) > 6 && longPress.current) {
                clearTimeout(longPress.current);
                longPress.current = null;
              }
              setDrag(Math.max(-40, Math.min(40, dy * 0.5)));
            }}
            onPointerUp={(e) => {
              if (longPress.current) {
                clearTimeout(longPress.current);
                longPress.current = null;
              }
              setDrag(0);
              if (!start.current) {
                return;
              }
              const dy = e.clientY - start.current.y;
              start.current = null;
              if (dy < -24) {
                go(MODES[Math.max(0, index - 1)]);
              } else if (dy > 24) {
                go(MODES[Math.min(MODES.length - 1, index + 1)]);
              } else {
                go(controls.mode === "draw" ? "select" : "draw");
              }
            }}
          >
            <span className="tm-puck__icon">
              {controls.icons[controls.mode ?? "select"]}
            </span>
          </button>
          <div className={clsx("tm-puck-flash", { "is-visible": !!flash })}>
            {flash}
          </div>
          {fanOpen && (
            <div
              className="tm-puck-fan"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {QUICK_COLORS.map((c, i) => {
                const a = ((-60 + i * 30) * Math.PI) / 180;
                return (
                  <button
                    key={c}
                    type="button"
                    className={clsx("tm-color", "tm-color--lg", {
                      "is-active": controls.color === c,
                    })}
                    style={
                      {
                        "--tm-swatch": c,
                        left: 46 + Math.cos(a) * 92,
                        top: Math.sin(a) * 92,
                        animationDelay: `${i * 25}ms`,
                      } as React.CSSProperties
                    }
                    onClick={() => {
                      controls.setColor(c);
                      setFanOpen(false);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
        <UndoRedo
          actionManager={props.actionManager}
          className="tm-puck-undo"
        />
        {fanOpen && (
          <div
            className="tm-puck-scrim"
            onPointerDown={() => setFanOpen(false)}
          />
        )}
      </div>
    </>
  );
};

// -----------------------------------------------------------------------------

const VariantSwitcher = ({ variant }: { variant: TabletVariant }) => {
  const go = (v: string | null) => {
    const url = new URL(window.location.href);
    if (v) {
      url.searchParams.set("tablet", v);
    } else {
      url.searchParams.delete("tablet");
    }
    window.location.href = url.toString();
  };
  return (
    <Island className="tm-switcher" padding={1}>
      <span className="tm-switcher__name">{TABLET_VARIANT_NAMES[variant]}</span>
      {TABLET_VARIANTS.map((v) => (
        <button
          key={v}
          type="button"
          className={clsx({ "is-active": v === variant })}
          onClick={() => go(v)}
        >
          {v.toUpperCase()}
        </button>
      ))}
      <button type="button" onClick={() => go(null)}>
        Off
      </button>
    </Island>
  );
};

export const TabletMode = (props: Props) => {
  const { container } = useExcalidrawContainer();
  useEffect(() => {
    if (!container) {
      return;
    }
    const classes = [
      "excalidraw--tablet-ui",
      `excalidraw--tablet-ui-${props.variant}`,
    ];
    container.classList.add(...classes);
    return () => container.classList.remove(...classes);
  }, [container, props.variant]);
  const Variant = {
    a: ThumbRail,
    b: ThumbArc,
    c: HoldToSwitch,
    d: ModeDrawer,
    e: SwipePuck,
  }[props.variant];
  return (
    <div className={clsx("tablet-mode", `tablet-mode--${props.variant}`)}>
      <Variant {...props} />
      <VariantSwitcher variant={props.variant} />
    </div>
  );
};
