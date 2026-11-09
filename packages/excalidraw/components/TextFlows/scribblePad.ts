/**
 * PROTOTYPE (text flows, "Scribble box"): dresses the text editor up as a
 * roomy writing box so iPadOS Scribble has space to catch Pencil
 * handwriting, keeps the on-screen keyboard down (inputmode="none") until
 * asked for, and adds Keyboard / Done buttons.
 *
 * Round 2: for a shape's label, the writing area can move away from the
 * shape (bubble / bottom panel / whole screen) or the canvas can zoom in,
 * and a "ghost" of the text is drawn where it will land in the shape.
 */
import { getLabelMode } from "./textFlows";

import type { LabelMode } from "./textFlows";
import type App from "../App";
import type { ExcalidrawElement } from "@excalidraw/element/types";

const LABEL_MIN = 220;
const SVG_NS = "http://www.w3.org/2000/svg";

type BubbleSide = "right" | "left" | "below" | "above";
type Rect = { left: number; top: number; right: number; bottom: number };

export const attachScribblePad = ({
  app,
  editable,
  editorBox,
  ownerWindow,
  container,
  onDone,
}: {
  app: App;
  editable: HTMLTextAreaElement;
  editorBox: HTMLElement | null;
  ownerWindow: Window;
  /** the shape the text is a label of */
  container: ExcalidrawElement | null;
  onDone: () => void;
}) => {
  const ownerDocument = editable.ownerDocument;
  const isLabel = !!container;
  const mode: LabelMode = isLabel ? getLabelMode() : "inline";

  editable.classList.add("excalidraw-wysiwyg--pad");
  if (isLabel) {
    editable.classList.add(
      "excalidraw-wysiwyg--pad-label",
      `excalidraw-wysiwyg--label-${mode}`,
    );
  }
  editable.setAttribute("inputmode", "none");
  editable.placeholder =
    mode === "bubble"
      ? "Write the label here…"
      : mode === "strip"
      ? "Write the label here — it goes in the highlighted shape"
      : mode === "anywhere"
      ? ""
      : "Write here…";

  // --- Keyboard / Done ------------------------------------------------------
  const bar = ownerDocument.createElement("div");
  bar.className = `excalidraw-padbar excalidraw-padbar--${mode}`;
  bar.dataset.testid = "text-padbar";

  const makeButton = (label: string, className: string, onTap: () => void) => {
    const button = ownerDocument.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    // keep focus (and the edit) on the textarea
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onTap();
    });
    return button;
  };

  const keyboard = makeButton("Keyboard", "excalidraw-padbar__kbd", () => {
    // iPadOS only re-reads inputmode on focus: swap it without the blur
    // ending the edit
    const onblur = editable.onblur;
    editable.onblur = null;
    editable.blur();
    editable.setAttribute("inputmode", "text");
    editable.focus({ preventScroll: true });
    editable.onblur = onblur;
    keyboard.remove();
  });
  const done = makeButton("Done", "excalidraw-padbar__done", onDone);
  bar.append(keyboard, done);

  // --- label decorations ------------------------------------------------------
  // shape highlight + connector, under the editor
  const svg = ownerDocument.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "excalidraw-labelwriter-svg");
  const highlight = ownerDocument.createElementNS(SVG_NS, "rect");
  highlight.setAttribute("class", "excalidraw-labelwriter-highlight");
  const tail = ownerDocument.createElementNS(SVG_NS, "path");
  tail.setAttribute("class", `excalidraw-labelwriter-tail--${mode}`);
  svg.append(highlight, tail);

  // where the text will land in the shape (the canvas hides the text while
  // it is being edited)
  const ghost = ownerDocument.createElement("div");
  ghost.className = "excalidraw-labelwriter-ghost";

  const hint = ownerDocument.createElement("div");
  hint.className = "excalidraw-labelwriter-hint";
  hint.textContent = "Write anywhere — it goes in this shape";

  const decorate = isLabel && mode !== "inline";
  if (decorate && editorBox) {
    editorBox.insertBefore(svg, editorBox.firstChild);
    if (mode !== "zoom") {
      editorBox.appendChild(ghost);
    }
    if (mode === "anywhere") {
      editorBox.appendChild(hint);
    }
  }
  editorBox?.appendChild(bar);

  // --- zoom in on the shape, back out when done -----------------------------
  const savedView =
    mode === "zoom"
      ? {
          zoom: app.state.zoom,
          scrollX: app.state.scrollX,
          scrollY: app.state.scrollY,
        }
      : null;
  let zoomFrame = 0;
  const animateView = (
    to: { zoom: number; scrollX: number; scrollY: number },
    after?: () => void,
  ) => {
    ownerWindow.cancelAnimationFrame(zoomFrame);
    const from = {
      zoom: app.state.zoom.value,
      scrollX: app.state.scrollX,
      scrollY: app.state.scrollY,
    };
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / 260);
      const k = 1 - (1 - t) ** 3;
      const zoom = from.zoom + (to.zoom - from.zoom) * k;
      app.setState({
        zoom: { value: zoom as any },
        scrollX: from.scrollX + (to.scrollX - from.scrollX) * k,
        scrollY: from.scrollY + (to.scrollY - from.scrollY) * k,
      });
      if (t < 1) {
        zoomFrame = ownerWindow.requestAnimationFrame(step);
      } else {
        after?.();
      }
    };
    zoomFrame = ownerWindow.requestAnimationFrame(step);
  };
  if (savedView && container) {
    const { width, height } = app.state;
    // big enough to write in, small enough to still see around it
    const zoom = Math.min(
      4,
      Math.max(
        app.state.zoom.value,
        Math.min(360 / container.width, 200 / container.height),
      ),
      (width * 0.6) / container.width,
      (height * 0.5) / container.height,
    );
    const zoomTo = Math.max(zoom, app.state.zoom.value);
    const centerX = container.x + container.width / 2;
    const centerY = container.y + container.height / 2;
    // shape centered, a little above the middle (room for the buttons)
    animateView({
      zoom: zoomTo,
      scrollX: width / 2 / zoomTo - centerX,
      scrollY: (height * 0.42) / zoomTo - centerY,
    });
  }

  // --- layout -----------------------------------------------------------------
  const shapeRect = (box: DOMRect): Rect | null => {
    const current = container && app.scene.getElement(container.id);
    if (!current) {
      return null;
    }
    const { zoom, scrollX, scrollY, offsetLeft, offsetTop } = app.state;
    const toX = (x: number) =>
      (x + scrollX) * zoom.value + offsetLeft - box.left;
    const toY = (y: number) => (y + scrollY) * zoom.value + offsetTop - box.top;
    return {
      left: toX(current.x),
      top: toY(current.y),
      right: toX(current.x + current.width),
      bottom: toY(current.y + current.height),
    };
  };

  const placeEditor = (
    left: number,
    top: number,
    width: number,
    minHeight: number,
  ) => {
    // the editor's own text measuring keeps running; only where and how big
    // the box is changes
    const height = Math.max(minHeight, editable.scrollHeight);
    Object.assign(editable.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      transform: "none",
      marginLeft: "0px",
      textAlign: "left",
    });
    return height;
  };

  let bubbleSide: BubbleSide | null = null;
  let barFrame = 0;
  /** buttons under the editor's right end, once its size has settled */
  const placeBarUnder = (box: DOMRect) => {
    ownerWindow.cancelAnimationFrame(barFrame);
    barFrame = ownerWindow.requestAnimationFrame(() => {
      const rect = editable.getBoundingClientRect();
      const barWidth = bar.offsetWidth || 170;
      bar.style.left = `${rect.right - box.left - barWidth}px`;
      bar.style.top = `${rect.bottom - box.top + 12}px`;
    });
  };

  const update = () => {
    if (!editorBox) {
      return;
    }
    const box = editorBox.getBoundingClientRect();

    if (decorate) {
      // the ghost takes the editor's spot exactly as the editor laid it out
      const s = editable.style;
      Object.assign(ghost.style, {
        left: s.left,
        top: s.top,
        width: s.width,
        height: s.height,
        transform: s.transform,
        transformOrigin: s.transformOrigin,
        font: s.font,
        lineHeight: s.lineHeight,
        textAlign: s.textAlign,
        color: s.color,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      });
      ghost.textContent = editable.value;
    }

    const shape = shapeRect(box);
    if (decorate && shape) {
      const pad = 8;
      highlight.setAttribute("x", `${shape.left - pad}`);
      highlight.setAttribute("y", `${shape.top - pad}`);
      highlight.setAttribute("width", `${shape.right - shape.left + pad * 2}`);
      highlight.setAttribute("height", `${shape.bottom - shape.top + pad * 2}`);
      highlight.setAttribute("rx", "10");
    }

    if (isLabel && mode === "inline") {
      // widen a label's editor around its center so there's room to write
      const width = parseFloat(editable.style.width) || 0;
      editable.style.marginLeft = `${Math.min(0, (width - LABEL_MIN) / 2)}px`;
    }

    if (mode === "bubble" && shape) {
      const width = Math.min(360, box.width - 160);
      const gap = 56;
      const shapeMidY = (shape.top + shape.bottom) / 2;
      const minHeight = 120;
      const clampX = (x: number) =>
        Math.max(110, Math.min(box.width - width - 90, x));
      const clampY = (y: number) =>
        Math.max(90, Math.min(box.height - minHeight - 110, y));
      const midX = (shape.left + shape.right) / 2;
      const spot = (side: BubbleSide) =>
        side === "right"
          ? { left: shape.right + gap, top: clampY(shapeMidY - minHeight / 2) }
          : side === "left"
          ? {
              left: shape.left - gap - width,
              top: clampY(shapeMidY - minHeight / 2),
            }
          : side === "below"
          ? { left: clampX(midX - width / 2), top: shape.bottom + gap }
          : {
              left: clampX(midX - width / 2),
              top: shape.top - gap - minHeight,
            };
      if (!bubbleSide) {
        // the side that fits on screen and covers the least of the drawing
        const others = app.scene
          .getNonDeletedElements()
          .filter(
            (el) =>
              el.id !== container!.id &&
              (el as any).containerId !== container!.id,
          );
        const { zoom, scrollX, scrollY, offsetLeft, offsetTop } = app.state;
        const overlap = (r: Rect) =>
          others.reduce((sum, el) => {
            const l = (el.x + scrollX) * zoom.value + offsetLeft - box.left;
            const t = (el.y + scrollY) * zoom.value + offsetTop - box.top;
            const w = Math.max(
              0,
              Math.min(r.right, l + el.width * zoom.value) -
                Math.max(r.left, l),
            );
            const h = Math.max(
              0,
              Math.min(r.bottom, t + el.height * zoom.value) -
                Math.max(r.top, t),
            );
            return sum + w * h;
          }, 0);
        let best = Infinity;
        for (const side of ["right", "left", "below", "above"] as const) {
          const { left, top } = spot(side);
          const r = {
            left,
            top,
            right: left + width,
            bottom: top + minHeight,
          };
          const offscreen =
            r.left < 100 ||
            r.right > box.width - 80 ||
            r.top < 80 ||
            r.bottom > box.height - 100;
          const score = overlap(r) + (offscreen ? 1e9 : 0);
          if (score < best) {
            best = score;
            bubbleSide = side;
          }
        }
      }
      const side = bubbleSide!;
      const { left, top } = spot(side);
      const height = placeEditor(left, top, width, minHeight);

      // speech-bubble tail from the bubble's edge to the shape
      let d: string;
      if (side === "above") {
        const cx = Math.max(left + 30, Math.min(left + width - 30, midX));
        d = `M ${cx - 18} ${top + height - 4} L ${midX} ${shape.top - 10} L ${
          cx + 18
        } ${top + height - 4} Z`;
      } else if (side === "below") {
        const cx = Math.max(
          left + 30,
          Math.min(left + width - 30, (shape.left + shape.right) / 2),
        );
        d = `M ${cx - 18} ${top + 4} L ${(shape.left + shape.right) / 2} ${
          shape.bottom + 10
        } L ${cx + 18} ${top + 4} Z`;
      } else {
        const edgeX = side === "right" ? left + 4 : left + width - 4;
        const tipX = side === "right" ? shape.right + 10 : shape.left - 10;
        const cy = Math.max(top + 24, Math.min(top + height - 24, shapeMidY));
        d = `M ${edgeX} ${cy - 18} L ${tipX} ${shapeMidY} L ${edgeX} ${
          cy + 18
        } Z`;
      }
      tail.setAttribute("d", d);
      placeBarUnder(box);
      return;
    }

    if (mode === "strip" && shape) {
      const width = Math.min(780, box.width - 260);
      const minHeight = 120;
      const left = (box.width - width) / 2;
      const top = box.height - minHeight - 84;
      const height = placeEditor(left, top, width, minHeight);
      const finalTop = Math.min(top, box.height - height - 84);
      editable.style.top = `${finalTop}px`;
      // dotted link from the panel up to the shape
      const fromX = Math.max(
        left + 40,
        Math.min(left + width - 40, (shape.left + shape.right) / 2),
      );
      tail.setAttribute(
        "d",
        `M ${fromX} ${finalTop - 12} L ${(shape.left + shape.right) / 2} ${
          shape.bottom + 12
        }`,
      );
      placeBarUnder(box);
      return;
    }

    if (mode === "anywhere" && shape) {
      Object.assign(editable.style, {
        left: "0px",
        top: "0px",
        width: `${box.width}px`,
        height: `${box.height}px`,
        transform: "none",
        marginLeft: "0px",
      });
      hint.style.left = `${(shape.left + shape.right) / 2}px`;
      hint.style.top = `${shape.top - 22}px`;
      bar.style.left = `${box.width / 2 - 85}px`;
      bar.style.top = `${box.height - 76}px`;
      return;
    }

    // inline / zoom: buttons under the editor
    const rect = editable.getBoundingClientRect();
    const below = shape && mode === "zoom" ? shape.bottom + 16 : 0;
    bar.style.left = `${rect.left - box.left - 8}px`;
    bar.style.top = `${Math.max(rect.bottom - box.top + 14, below)}px`;
  };
  update();

  return {
    update,
    destroy: () => {
      ownerWindow.cancelAnimationFrame(barFrame);
      bar.remove();
      svg.remove();
      ghost.remove();
      hint.remove();
      if (savedView) {
        animateView({
          zoom: savedView.zoom.value,
          scrollX: savedView.scrollX,
          scrollY: savedView.scrollY,
        });
      }
    },
  };
};
