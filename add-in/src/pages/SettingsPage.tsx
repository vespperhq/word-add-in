import { Icon, iconButtonClassName } from "../components/Icon";
import { useChatSettings } from "../context/ChatContext";

export function SettingsPage() {
  const { author, setAuthor, closeSettings } = useChatSettings();

  return (
    <section className="flex h-screen min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-1 px-2 pt-2 pb-1">
        <button
          type="button"
          className={iconButtonClassName}
          title="Back"
          aria-label="Back"
          onClick={closeSettings}
        >
          <Icon name="back" className="size-4" />
        </button>
        <h1 className="m-0 text-xl font-semibold tracking-tight">Settings</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-6">
        <label
          htmlFor="author"
          className="mb-1 block text-[15px] font-semibold"
        >
          Tracked-change author
        </label>
        <p className="mb-2.5 text-[13px] leading-snug font-normal text-muted-foreground">
          Shown in Word Review on insertions and deletions.
        </p>
        <input
          id="author"
          type="text"
          value={author}
          placeholder="Your name (shown in Word Review)"
          onChange={(e) => setAuthor(e.target.value)}
          className="mb-5.5 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15"
        />
      </div>
    </section>
  );
}
