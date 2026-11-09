/**
 * PROTOTYPE (text flows, "Scribble box"): dresses the text editor up as a
 * roomy writing box so iPadOS Scribble has space to catch Pencil
 * handwriting, keeps the on-screen keyboard down (inputmode="none") until
 * asked for, and adds Keyboard / Done buttons under the box.
 */
const LABEL_MIN = 220;

export const attachScribblePad = ({
  editable,
  editorBox,
  ownerWindow,
  isLabel,
  onDone,
}: {
  editable: HTMLTextAreaElement;
  editorBox: HTMLElement | null;
  ownerWindow: Window;
  /** a shape's label: keep the editor's own size, it is centered */
  isLabel: boolean;
  onDone: () => void;
}) => {
  const ownerDocument = editable.ownerDocument;
  editable.classList.add("excalidraw-wysiwyg--pad");
  if (isLabel) {
    editable.classList.add("excalidraw-wysiwyg--pad-label");
  }
  editable.setAttribute("inputmode", "none");

  const bar = ownerDocument.createElement("div");
  bar.className = "excalidraw-padbar";
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

  editable.placeholder = "Write here…";

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
  editorBox?.appendChild(bar);

  let frame = 0;
  const update = () => {
    ownerWindow.cancelAnimationFrame(frame);
    frame = ownerWindow.requestAnimationFrame(() => {
      if (!editorBox) {
        return;
      }
      if (isLabel) {
        // widen a label's editor around its center so there's room to write
        const width = parseFloat(editable.style.width) || 0;
        editable.style.marginLeft = `${Math.min(0, (width - LABEL_MIN) / 2)}px`;
      }
      const box = editorBox.getBoundingClientRect();
      const rect = editable.getBoundingClientRect();
      bar.style.left = `${rect.left - box.left - 8}px`;
      bar.style.top = `${rect.bottom - box.top + 14}px`;
    });
  };
  update();

  return {
    update,
    destroy: () => {
      ownerWindow.cancelAnimationFrame(frame);
      bar.remove();
    },
  };
};
