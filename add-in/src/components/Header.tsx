import { useChatSettings } from "../context/ChatContext";
import { Icon, iconButtonClassName } from "./Icon";

export function Header() {
  const { openSettings } = useChatSettings();

  return (
    <header className="absolute top-0 right-12 z-10 p-1.5">
      <button
        type="button"
        className={iconButtonClassName}
        title="Settings"
        aria-label="Settings"
        onClick={openSettings}
      >
        <Icon name="settings" className="size-4" />
      </button>
    </header>
  );
}
