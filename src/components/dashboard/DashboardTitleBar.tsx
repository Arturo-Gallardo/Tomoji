import { MinusIcon, SquareIcon, XIcon } from "@phosphor-icons/react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export function DashboardTitleBar() {
  return (
    <div
      className="tomoji-titlebar"
      data-tauri-drag-region
      onDoubleClick={() => void appWindow.toggleMaximize()}
    >
      <span className="tomoji-titlebar__brand" data-tauri-drag-region>
        Tomoji
      </span>
      <div className="tomoji-titlebar__controls">
        <button
          type="button"
          className="tomoji-titlebar__button"
          onClick={() => void appWindow.minimize()}
          aria-label="Minimize window"
        >
          <MinusIcon weight="bold" />
        </button>
        <button
          type="button"
          className="tomoji-titlebar__button"
          onClick={() => void appWindow.toggleMaximize()}
          aria-label="Maximize or restore window"
        >
          <SquareIcon weight="bold" />
        </button>
        <button
          type="button"
          className="tomoji-titlebar__button tomoji-titlebar__button--close"
          onClick={() => void appWindow.close()}
          aria-label="Close window"
        >
          <XIcon weight="bold" />
        </button>
      </div>
    </div>
  );
}
