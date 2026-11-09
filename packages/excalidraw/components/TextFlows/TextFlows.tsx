/**
 * PROTOTYPE (text flows): the flow picker and the "add label" chip.
 */
import clsx from "clsx";
import React from "react";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import {
  getContainerCenter,
  hasBoundTextElement,
  isArrowElement,
  isTextBindableContainer,
} from "@excalidraw/element";

import type {
  ExcalidrawTextContainer,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { useAtom, useAtomValue } from "../../editor-jotai";

import {
  LABEL_MODES,
  TEXT_FLOWS,
  labelModeAtom,
  textFlowAtom,
} from "./textFlows";

import "./TextFlows.scss";

import type { AppClassProperties, UIAppState } from "../../types";

export const TextFlowPicker = () => {
  const [mode, setMode] = useAtom(labelModeAtom);
  const active = LABEL_MODES.find((option) => option.id === mode)!;
  return (
    <div className="text-flow-picker" data-testid="text-flow-picker">
      <div className="text-flow-picker__row">
        {LABEL_MODES.map((option) => (
          <button
            key={option.id}
            type="button"
            className={clsx("text-flow-picker__opt", {
              "is-active": option.id === mode,
            })}
            onClick={() => setMode(option.id)}
            data-testid={`label-mode-${option.id}`}
          >
            {option.letter !== "–" && <b>{option.letter}</b>}
            {option.label}
          </button>
        ))}
      </div>
      <div className="text-flow-picker__hint">
        Labels: {active.hint}. Double-tap a shape, or tap its Aa chip.
      </div>
    </div>
  );
};

/** how long a fresh Draw-to-shape shape offers its chip */
const RECENT_MS = 6000;

const isEmptyShape = (
  element: NonDeletedExcalidrawElement | undefined,
): element is NonDeleted<ExcalidrawTextContainer> =>
  !!element &&
  isTextBindableContainer(element, false) &&
  !isArrowElement(element) &&
  !hasBoundTextElement(element);

export const TextLabelChip = ({
  app,
  appState,
  elements,
}: {
  app: AppClassProperties;
  appState: UIAppState;
  elements: readonly NonDeletedExcalidrawElement[];
}) => {
  const flow = useAtomValue(textFlowAtom);
  const enabled = TEXT_FLOWS.find(
    (option) => option.id === flow,
  )!.features.includes("labelChip");
  const [, forceUpdate] = React.useReducer((n: number) => n + 1, 0);
  // the UI layer doesn't re-render on pan/zoom: follow the canvas
  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    return (app as any).onScrollChangeEmitter.on(forceUpdate);
  }, [app, enabled]);

  let target: NonDeleted<ExcalidrawTextContainer> | null = null;
  let expiresIn = 0;

  const busy =
    !enabled ||
    !!appState.editingTextElement ||
    !!appState.newElement ||
    appState.selectedElementsAreBeingDragged ||
    !!appState.resizingElement ||
    appState.viewModeEnabled;

  if (!busy) {
    const selectedIds = Object.keys(appState.selectedElementIds);
    if (
      selectedIds.length === 1 &&
      (appState.activeTool.type === "selection" ||
        appState.activeTool.type === "lasso")
    ) {
      const element = elements.find((el) => el.id === selectedIds[0]);
      if (isEmptyShape(element)) {
        target = element;
      }
    } else if (
      appState.activeTool.type === "autoshape" &&
      selectedIds.length === 0
    ) {
      // the shape Draw to shape just made
      let newest: NonDeletedExcalidrawElement | null = null;
      for (const element of elements) {
        if (!newest || element.updated > newest.updated) {
          newest = element;
        }
      }
      const age = newest ? Date.now() - newest.updated : Infinity;
      if (newest && isEmptyShape(newest) && age < RECENT_MS) {
        target = newest;
        expiresIn = RECENT_MS - age;
      }
    }
  }

  React.useEffect(() => {
    if (!expiresIn) {
      return;
    }
    const timer = window.setTimeout(forceUpdate, expiresIn + 20);
    return () => window.clearTimeout(timer);
  }, [expiresIn, target?.id, target?.updated]);

  if (!target) {
    return null;
  }

  const elementsMap = app.scene.getNonDeletedElementsMap();
  const center = getContainerCenter(target, elementsMap);
  const { x, y } = sceneCoordsToViewportCoords(
    { sceneX: center.x, sceneY: center.y },
    app.state,
  );
  const screenHeight = target.height * app.state.zoom.value;
  // too small to sit inside: hang it under the shape
  const top =
    screenHeight < 72
      ? y - appState.offsetTop + screenHeight / 2 + 28
      : y - appState.offsetTop;
  const container = target;

  return (
    <button
      type="button"
      className="text-label-chip"
      style={{ left: x - appState.offsetLeft, top }}
      data-testid="text-label-chip"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => {
        app.text.startTextEditing({
          sceneX: center.x,
          sceneY: center.y,
          container,
          textElement: null,
        });
      }}
    >
      <span className="text-label-chip__aa">Aa</span>
      Label
    </button>
  );
};
