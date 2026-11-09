import clsx from "clsx";
import React from "react";

import { CLASSES } from "@excalidraw/common";
import { showSelectedShapeActions } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useAtom, useAtomValue } from "../../editor-jotai";
import { t } from "../../i18n";
import { SelectedShapeActions } from "../Actions";
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

import {
  TOOLBAR_ITEM_LABELS,
  TOOLBAR_SIZES,
  toolbarConfigAtom,
} from "./toolbarConfig";

import { TEXT_FLOWS, textFlowAtom } from "../TextFlows/textFlows";

import "./CustomToolbar.scss";

import type { ToolbarConfig, ToolbarItemId } from "./toolbarConfig";
import type { ActionManager } from "../../actions/manager";
import type {
  AppClassProperties,
  AppProps,
  AppState,
  UIAppState,
} from "../../types";

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

/** the stock full options panel, regardless of screen size */
const ForceFull = ({ children }: { children: React.ReactNode }) => {
  const editorInterface = useEditorInterface();
  return (
    <EditorInterfaceContext.Provider
      value={{
        ...editorInterface,
        formFactor: "desktop",
        desktopUIMode: "full",
      }}
    >
      {children}
    </EditorInterfaceContext.Provider>
  );
};

/** the full options panel, with a tab to tuck it away */
const OptionsPanel = ({
  app,
  appState,
  actionManager,
  onHide,
}: Props & { onHide: () => void }) => (
  <div className="ct-styles" data-testid="ct-styles">
    <Island
      className={clsx(CLASSES.SHAPE_ACTIONS_MENU, "ct-styles__island")}
      padding={2}
    >
      <ForceFull>
        <SelectedShapeActions
          appState={appState}
          elementsMap={app.scene.getNonDeletedElementsMap()}
          renderAction={actionManager.renderAction}
          app={app}
        />
      </ForceFull>
    </Island>
    <button
      type="button"
      className="ct-styles__hide"
      onClick={onHide}
      title="Hide options"
      data-testid="ct-styles-hide"
    >
      <span />
    </button>
  </div>
);

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
  // PROTOTYPE (text flows): flows built around the Text button put it on the
  // toolbar, right after the drawing tools
  const textFlow = useAtomValue(textFlowAtom);
  const items = React.useMemo(() => {
    const wantsText = TEXT_FLOWS.find(
      (flow) => flow.id === textFlow,
    )!.features.includes("toolbarText");
    if (!wantsText || config.items.includes("text")) {
      return config.items;
    }
    const after = Math.max(
      config.items.indexOf("autoshape"),
      config.items.indexOf("freedraw"),
    );
    const next = [...config.items];
    next.splice(after + 1, 0, "text");
    return next;
  }, [config.items, textFlow]);
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

  // the options panel hugs the chosen screen edge; on the toolbar's own
  // edge it docks right beside the toolbar
  const panelEdge = config.panelSide;
  const docked = panelEdge === config.position;
  let panel: React.ReactNode = null;
  if (relevant) {
    panel = config.stylesHidden ? (
      <button
        type="button"
        className="ct-peek"
        onClick={() => setConfig({ stylesHidden: false })}
        title="Show options"
        data-testid="ct-styles-show"
      >
        <span style={{ background: appState.currentItemStrokeColor }} />
      </button>
    ) : (
      <OptionsPanel
        {...props}
        onHide={() => setConfig({ stylesHidden: true })}
      />
    );
  }

  const size = TOOLBAR_SIZES[config.size];

  return (
    <>
      <div
        className={clsx(
          "ct-dock",
          `ct-dock--${config.position}`,
          `ct-edge--${config.position}`,
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
          {items.map((id) => (
            <Item
              key={id}
              label={TOOLBAR_ITEM_LABELS[id]}
              show={config.labels}
              className={`ct-item--${id}`}
            >
              {renderItem(id)}
            </Item>
          ))}
        </Island>
        {docked && panel}
      </div>
      {!docked && panel && (
        <div
          className={clsx(
            "ct-side",
            `ct-side--${panelEdge}`,
            `ct-edge--${panelEdge}`,
          )}
        >
          {panel}
        </div>
      )}
    </>
  );
};
