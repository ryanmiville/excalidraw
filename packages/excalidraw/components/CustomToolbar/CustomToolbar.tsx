import clsx from "clsx";
import { Popover } from "radix-ui";
import React from "react";

import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_STROKE_COLOR_INDEX,
} from "@excalidraw/common";
import { showSelectedShapeActions } from "@excalidraw/element";

import type { StrokeWidthKey } from "@excalidraw/common";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { CompactShapeActions } from "../Actions";
import {
  EditorInterfaceContext,
  useEditorInterface,
  useExcalidrawContainer,
} from "../App";
import { Island } from "../Island";
import { LockButton } from "../LockButton";
import { ExtraToolsDropdown } from "../Toolbar";
import {
  ArrowToolButton,
  AutoshapeToolButton,
  DiamondToolButton,
  EllipseToolButton,
  EraserToolButton,
  FrameToolButton,
  FreedrawToolButton,
  HandToolButton,
  ImageToolButton,
  LaserToolButton,
  LassoToolButton,
  LineToolButton,
  RectangleToolButton,
  SelectionToolButton,
  StickyNoteToolButton,
  TextToolButton,
} from "../Tools";
import { palette } from "../icons";

import {
  TOOLBAR_ITEM_LABELS,
  TOOLBAR_SIZES,
  toolbarConfigAtom,
} from "./toolbarConfig";

import "./CustomToolbar.scss";

import type { ToolbarConfig, ToolbarItemId } from "./toolbarConfig";
import type { ActionManager } from "../../actions/manager";
import type {
  AppClassProperties,
  AppProps,
  AppState,
  UIAppState,
} from "../../types";

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

type Props = {
  app: AppClassProperties;
  appState: UIAppState;
  setAppState: React.Component<any, AppState>["setState"];
  actionManager: ActionManager;
  elements: readonly NonDeletedExcalidrawElement[];
  UIOptions: AppProps["UIOptions"];
  onLockToggle: () => void;
};

const isVertical = (config: ToolbarConfig) =>
  config.position === "left" || config.position === "right";

const popoverSide = (config: ToolbarConfig) =>
  ({
    left: "right",
    right: "left",
    top: "bottom",
    bottom: "top",
  }[config.position] as "right" | "left" | "bottom" | "top");

/** compact styles panel, regardless of screen size */
const ForceCompact = ({ children }: { children: React.ReactNode }) => {
  const editorInterface = useEditorInterface();
  return (
    <EditorInterfaceContext.Provider
      value={{ ...editorInterface, formFactor: "tablet" }}
    >
      {children}
    </EditorInterfaceContext.Provider>
  );
};

const StylesPanel = ({
  app,
  appState,
  actionManager,
  setAppState,
  horizontal,
  onHide,
}: Props & { horizontal?: boolean; onHide?: () => void }) => (
  <Island
    className={clsx("ct-styles", { "ct-styles--horizontal": horizontal })}
    padding={0}
    data-testid="ct-styles"
  >
    <ForceCompact>
      <CompactShapeActions
        appState={appState}
        elementsMap={app.scene.getNonDeletedElementsMap()}
        renderAction={actionManager.renderAction}
        app={app}
        setAppState={setAppState}
      />
    </ForceCompact>
    {onHide && (
      <button
        type="button"
        className="ct-styles__hide"
        onClick={onHide}
        title="Hide style options"
        data-testid="ct-styles-hide"
      >
        <span />
      </button>
    )}
  </Island>
);

const setColor = (actionManager: ActionManager, color: string) =>
  actionManager.executeAction(actionManager.actions.changeStrokeColor, "ui", {
    color,
    currentItemStrokeColor: color,
  });

const setWidth = (actionManager: ActionManager, width: StrokeWidthKey) =>
  actionManager.executeAction(
    actionManager.actions.changeStrokeWidth,
    "ui",
    width,
  );

const QuickPopover = ({
  trigger,
  children,
  side,
  testId,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  side: "left" | "right" | "top" | "bottom";
  testId: string;
}) => {
  const { container } = useExcalidrawContainer();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="ct-quick" data-testid={testId}>
          {trigger}
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          side={side}
          sideOffset={14}
          className="ct-quick-popover"
          collisionBoundary={container ?? undefined}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

const Item = ({
  label,
  show,
  children,
  className,
}: {
  label: string;
  show: boolean;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={clsx("ct-item", className)}>
    {children}
    {show && <span className="ct-item__label">{label}</span>}
  </div>
);

export const CustomToolbar = (props: Props) => {
  const { app, appState, setAppState, actionManager, elements, UIOptions } =
    props;
  const [config, setConfig] = useAtom(toolbarConfigAtom);
  const [stylesOpen, setStylesOpen] = React.useState(false);
  const { container } = useExcalidrawContainer();
  const hasUndoItem = config.items.includes("undo");
  React.useEffect(() => {
    if (!container || !hasUndoItem) {
      return;
    }
    container.classList.add("excalidraw--ct-undo");
    return () => container.classList.remove("excalidraw--ct-undo");
  }, [container, hasUndoItem]);

  const toolProps = {
    app,
    activeTool: appState.activeTool,
    hideKeyBinding: true,
  };
  const vertical = isVertical(config);
  const side = popoverSide(config);
  const relevant = showSelectedShapeActions(appState, elements);

  const renderItem = (id: ToolbarItemId) => {
    switch (id) {
      case "lock":
        return (
          <LockButton
            checked={appState.activeTool.locked}
            onChange={props.onLockToggle}
            title={t("toolBar.lock")}
          />
        );
      case "hand":
        return <HandToolButton {...toolProps} />;
      case "selection":
        return <SelectionToolButton {...toolProps} />;
      case "lasso":
        return <LassoToolButton {...toolProps} />;
      case "rectangle":
        return <RectangleToolButton {...toolProps} />;
      case "diamond":
        return <DiamondToolButton {...toolProps} />;
      case "ellipse":
        return <EllipseToolButton {...toolProps} />;
      case "arrow":
        return <ArrowToolButton {...toolProps} />;
      case "line":
        return <LineToolButton {...toolProps} />;
      case "freedraw":
        return <FreedrawToolButton {...toolProps} />;
      case "autoshape":
        return <AutoshapeToolButton {...toolProps} />;
      case "text":
        return <TextToolButton {...toolProps} />;
      case "stickynote":
        return <StickyNoteToolButton {...toolProps} />;
      case "image":
        return <ImageToolButton {...toolProps} />;
      case "eraser":
        return <EraserToolButton {...toolProps} />;
      case "frame":
        return <FrameToolButton {...toolProps} />;
      case "laser":
        return <LaserToolButton {...toolProps} />;
      case "undo":
        return actionManager.renderAction("undo");
      case "redo":
        return actionManager.renderAction("redo");
      case "more":
        return (
          <ExtraToolsDropdown
            app={app}
            activeTool={appState.activeTool}
            setAppState={setAppState}
            UIOptions={UIOptions}
          />
        );
    }
    return null;
  };

  // --- style controls that live on the toolbar ------------------------------

  const stylesButton = (
    <Item label="Styles" show={config.labels}>
      <button
        type="button"
        className={clsx("ct-quick", { "is-active": stylesOpen })}
        onClick={() => setStylesOpen((o) => !o)}
        data-testid="ct-styles-button"
        title="Style options"
      >
        <span
          className="ct-quick__palette"
          style={{ color: appState.currentItemStrokeColor }}
        >
          {palette}
        </span>
      </button>
    </Item>
  );

  const inlineControls = (
    <>
      <Item label="Color" show={config.labels}>
        <QuickPopover
          side={side}
          testId="ct-color"
          trigger={
            <span
              className="ct-quick__swatch"
              style={{ background: appState.currentItemStrokeColor }}
            />
          }
        >
          <div className="ct-quick-row">
            {QUICK_COLORS.map((c) => (
              <Popover.Close asChild key={c}>
                <button
                  type="button"
                  className={clsx("ct-color", {
                    "is-active": appState.currentItemStrokeColor === c,
                  })}
                  style={{ background: c }}
                  onClick={() => setColor(actionManager, c)}
                  aria-label={c}
                />
              </Popover.Close>
            ))}
          </div>
        </QuickPopover>
      </Item>
      <Item label="Stroke" show={config.labels}>
        <QuickPopover
          side={side}
          testId="ct-width"
          trigger={
            <span
              className="ct-quick__dot"
              style={{
                width: WIDTH_DOT[appState.currentItemStrokeWidthKey] + 2,
                height: WIDTH_DOT[appState.currentItemStrokeWidthKey] + 2,
                background: appState.currentItemStrokeColor,
              }}
            />
          }
        >
          <div className="ct-quick-row">
            {WIDTHS.map((w) => (
              <Popover.Close asChild key={w}>
                <button
                  type="button"
                  className={clsx("ct-width", {
                    "is-active": appState.currentItemStrokeWidthKey === w,
                  })}
                  onClick={() => setWidth(actionManager, w)}
                  aria-label={w}
                >
                  <span
                    style={{
                      width: WIDTH_DOT[w],
                      height: WIDTH_DOT[w],
                      background: appState.currentItemStrokeColor,
                    }}
                  />
                </button>
              </Popover.Close>
            ))}
          </div>
        </QuickPopover>
      </Item>
      {stylesButton}
    </>
  );

  // --- where the full style options go ---------------------------------------

  let besidePanel: React.ReactNode = null;
  let peek: React.ReactNode = null;

  if (config.styles === "beside" && relevant) {
    if (config.stylesHidden) {
      peek = (
        <button
          type="button"
          className="ct-peek"
          onClick={() => setConfig({ stylesHidden: false })}
          title="Show style options"
          data-testid="ct-styles-show"
        >
          <span style={{ background: appState.currentItemStrokeColor }} />
        </button>
      );
    } else {
      besidePanel = (
        <StylesPanel
          {...props}
          horizontal={!vertical}
          onHide={() => setConfig({ stylesHidden: true })}
        />
      );
    }
  } else if (
    (config.styles === "button" || config.styles === "inline") &&
    stylesOpen
  ) {
    besidePanel = relevant ? (
      <StylesPanel
        {...props}
        horizontal={!vertical}
        onHide={() => setStylesOpen(false)}
      />
    ) : (
      <Island className="ct-styles ct-styles--empty" padding={2}>
        Pick a drawing tool or select something to change its style.
      </Island>
    );
  }

  const strip =
    config.styles === "strip" && relevant ? (
      <div className="ct-strip">
        <StylesPanel {...props} horizontal />
      </div>
    ) : null;

  const size = TOOLBAR_SIZES[config.size];

  return (
    <>
      <div
        className={clsx(
          "ct-dock",
          `ct-dock--${config.position}`,
          `ct-dock--size-${config.size}`,
          { "ct-dock--labels": config.labels },
        )}
        style={
          {
            "--ct-button": size.button,
            "--ct-icon": size.icon,
          } as React.CSSProperties
        }
      >
        <Island
          className={clsx("ct-toolbar", "App-toolbar", {
            "ct-toolbar--vertical": vertical,
          })}
          padding={1}
          data-testid="ct-toolbar"
        >
          {config.items.map((id) => (
            <Item
              key={id}
              label={TOOLBAR_ITEM_LABELS[id]}
              show={config.labels}
              className={`ct-item--${id}`}
            >
              {renderItem(id)}
            </Item>
          ))}
          {(config.styles === "button" || config.styles === "inline") && (
            <div className="ct-divider" />
          )}
          {config.styles === "button" && stylesButton}
          {config.styles === "inline" && inlineControls}
        </Island>
        {peek}
        {besidePanel}
      </div>
      {strip}
    </>
  );
};
