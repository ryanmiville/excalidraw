import clsx from "clsx";

import { useAtom } from "../../editor-jotai";
import { Dialog } from "../Dialog";
import { TOOLS } from "../Tools";
import { LockedIcon, UndoIcon, RedoIcon, DotsIcon } from "../icons";

import {
  ALL_TOOLBAR_ITEMS,
  TOOLBAR_ITEM_LABELS,
  TOOLBAR_PRESETS,
  customizeToolbarOpenAtom,
  toolbarConfigAtom,
} from "./toolbarConfig";

import type {
  StylesPlacement,
  ToolbarItemId,
  ToolbarPosition,
  ToolbarSize,
} from "./toolbarConfig";

const ITEM_ICONS: Partial<Record<ToolbarItemId, React.ReactNode>> = {
  lock: LockedIcon,
  undo: UndoIcon,
  redo: RedoIcon,
  more: DotsIcon,
};

const itemIcon = (id: ToolbarItemId) =>
  ITEM_ICONS[id] ?? TOOLS[id as keyof typeof TOOLS]?.icon ?? null;

const Segmented = <T extends string>({
  value,
  options,
  onChange,
  testId,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  testId: string;
}) => (
  <div className="ct-seg" data-testid={testId}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className={clsx({ "is-active": o.value === value })}
        onClick={() => onChange(o.value)}
        data-value={o.value}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const CustomizeToolbarDialog = () => {
  const [open, setOpen] = useAtom(customizeToolbarOpenAtom);
  const [config, setConfig] = useAtom(toolbarConfigAtom);

  if (!open) {
    return null;
  }

  const move = (id: ToolbarItemId, dir: -1 | 1) => {
    const items = [...config.items];
    const i = items.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) {
      return;
    }
    [items[i], items[j]] = [items[j], items[i]];
    setConfig({ items });
  };

  const toggle = (id: ToolbarItemId) => {
    setConfig({
      items: config.items.includes(id)
        ? config.items.filter((x) => x !== id)
        : [...config.items, id],
    });
  };

  const hidden = ALL_TOOLBAR_ITEMS.filter((id) => !config.items.includes(id));

  return (
    <Dialog
      onCloseRequest={() => setOpen(false)}
      title="Customize toolbar"
      size="small"
      className="ct-dialog"
    >
      <div className="ct-dialog__row">
        <label className="ct-switch">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ enabled: e.target.checked })}
            data-testid="ct-enabled"
          />
          <span>Use my custom toolbar</span>
        </label>
      </div>

      <div className={clsx("ct-dialog__body", { "is-off": !config.enabled })}>
        <div className="ct-dialog__section">
          <div className="ct-dialog__label">Position</div>
          <Segmented<ToolbarPosition>
            testId="ct-position"
            value={config.position}
            onChange={(position) => setConfig({ position })}
            options={[
              { value: "left", label: "Left" },
              { value: "top", label: "Top" },
              { value: "right", label: "Right" },
              { value: "bottom", label: "Bottom" },
            ]}
          />
        </div>

        <div className="ct-dialog__section">
          <div className="ct-dialog__label">Size</div>
          <Segmented<ToolbarSize>
            testId="ct-size"
            value={config.size}
            onChange={(size) => setConfig({ size })}
            options={[
              { value: "s", label: "S" },
              { value: "m", label: "M" },
              { value: "l", label: "L" },
              { value: "xl", label: "XL" },
            ]}
          />
          <label className="ct-check">
            <input
              type="checkbox"
              checked={config.labels}
              onChange={(e) => setConfig({ labels: e.target.checked })}
            />
            Show labels
          </label>
        </div>

        <div className="ct-dialog__section">
          <div className="ct-dialog__label">Style options</div>
          <Segmented<StylesPlacement>
            testId="ct-styles-placement"
            value={config.styles}
            onChange={(styles) => setConfig({ styles, stylesHidden: false })}
            options={[
              { value: "beside", label: "Beside toolbar" },
              { value: "button", label: "Styles button" },
              { value: "inline", label: "On the toolbar" },
              { value: "strip", label: "Top strip" },
            ]}
          />
        </div>

        <div className="ct-dialog__section">
          <div className="ct-dialog__label">Presets</div>
          <div className="ct-presets">
            {TOOLBAR_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setConfig({ items: [...p.items] })}
                data-testid={`ct-preset-${p.id}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ct-dialog__section">
          <div className="ct-dialog__label">
            On the toolbar ({config.items.length})
          </div>
          <div className="ct-list">
            {config.items.map((id, i) => (
              <div className="ct-list__row" key={id}>
                <span className="ct-list__icon">{itemIcon(id)}</span>
                <span className="ct-list__name">{TOOLBAR_ITEM_LABELS[id]}</span>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(id, -1)}
                  aria-label="move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === config.items.length - 1}
                  onClick={() => move(id, 1)}
                  aria-label="move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ct-list__remove"
                  onClick={() => toggle(id)}
                  aria-label="remove"
                >
                  −
                </button>
              </div>
            ))}
          </div>
          {hidden.length > 0 && (
            <>
              <div className="ct-dialog__label">Add</div>
              <div className="ct-chips">
                {hidden.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    data-testid={`ct-add-${id}`}
                  >
                    <span className="ct-list__icon">{itemIcon(id)}</span>
                    {TOOLBAR_ITEM_LABELS[id]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
};
