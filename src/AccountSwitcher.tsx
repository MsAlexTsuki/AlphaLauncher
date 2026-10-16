import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type MicrosoftAccount = { name: string; email: string; uuid: string };

type AccountSwitcherProps = {
  account: MicrosoftAccount | null;
  isMinecraftRunning: boolean;
  isLoggingIn: boolean;
  loginError: string | null;
  onLogin: () => Promise<void>;
  onAccountChanged: (account: MicrosoftAccount | null) => void;
  onOpenAccountPage: () => void;
};

export default function AccountSwitcher({
  account,
  isMinecraftRunning,
  isLoggingIn,
  loginError,
  onLogin,
  onAccountChanged,
  onOpenAccountPage,
}: AccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<MicrosoftAccount[]>([]);
  const [switchingUuid, setSwitchingUuid] = useState<string | null>(null);
  const [removingUuid, setRemovingUuid] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshAccounts = useCallback(async () => {
    try {
      const saved = await invoke<MicrosoftAccount[]>("get_saved_microsoft_accounts");
      setAccounts(saved);
      setError("");
    } catch (loadError) {
      console.warn("Could not load saved Minecraft accounts:", loadError);
      setError("Could not load saved accounts.");
    }
  }, []);

  useEffect(() => {
    void refreshAccounts();
  }, [refreshAccounts]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSwitch = async (saved: MicrosoftAccount) => {
    if (isMinecraftRunning || switchingUuid || saved.uuid === account?.uuid) return;
    setSwitchingUuid(saved.uuid);
    setError("");
    try {
      const active = await invoke<MicrosoftAccount>("switch_microsoft_account", {
        uuid: saved.uuid,
      });
      onAccountChanged(active);
      await refreshAccounts();
      setOpen(false);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : String(switchError));
    } finally {
      setSwitchingUuid(null);
    }
  };

  const handleAddAccount = async () => {
    if (isMinecraftRunning || isLoggingIn) return;
    setError("");
    await onLogin();
    await refreshAccounts();
  };

  const handleRemove = async (saved: MicrosoftAccount) => {
    if (isMinecraftRunning || removingUuid) return;
    const confirmed = window.confirm(
      "Remove " + saved.name + " from saved Minecraft accounts? You can add it again later.",
    );
    if (!confirmed) return;

    setRemovingUuid(saved.uuid);
    setError("");
    try {
      const remaining = await invoke<MicrosoftAccount[]>("remove_saved_microsoft_account", {
        uuid: saved.uuid,
      });
      setAccounts(remaining);
      if (account?.uuid === saved.uuid) onAccountChanged(null);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : String(removeError));
    } finally {
      setRemovingUuid(null);
    }
  };

  const disabled = isMinecraftRunning || isLoggingIn || switchingUuid !== null || removingUuid !== null;

  return (
    <div className="titlebar-inbox account-switcher" ref={rootRef}>
      <button
        type="button"
        className={"titlebar-icon-button account-switcher-trigger" + (open ? " is-open" : "")}
        aria-label={account ? "Minecraft account: " + account.name : "Minecraft accounts"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={account ? "Minecraft account: " + account.name : "Minecraft accounts"}
        onClick={() => setOpen((current) => !current)}
      >
        {account ? (
          <img
            className="account-switcher-trigger-avatar"
            src={"https://mc-heads.net/avatar/" + encodeURIComponent(account.name) + "/64"}
            alt=""
            onError={(event) => { event.currentTarget.style.display = "none"; }}
          />
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="8" r="3.4" />
            <path d="M5.5 20v-1.6a6.5 6.5 0 0 1 13 0V20Z" />
          </svg>
        )}
        <span className="account-switcher-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <section className="inbox-popover account-switcher-popover" role="dialog" aria-label="Minecraft account switcher">
          <div className="inbox-popover-header">
            <div>
              <strong>Minecraft accounts</strong>
              <span>{accounts.length} saved {accounts.length === 1 ? "account" : "accounts"}</span>
            </div>
            <span className="account-switcher-header-icon" aria-hidden="true">⇄</span>
          </div>

          {isMinecraftRunning && (
            <div className="account-switcher-notice">Close Minecraft before switching or removing accounts.</div>
          )}

          {accounts.length === 0 ? (
            <div className="inbox-empty account-switcher-empty">
              <span className="inbox-empty-icon">＋</span>
              <strong>No saved accounts</strong>
              <p>Add a Microsoft account to start playing AlphaClient.</p>
            </div>
          ) : (
            <div className="account-switcher-list">
              {accounts.map((saved) => {
                const active = saved.uuid === account?.uuid;
                return (
                  <div className={"account-switcher-row" + (active ? " is-active" : "")} key={saved.uuid}>
                    <img
                      className="account-switcher-avatar"
                      src={"https://mc-heads.net/avatar/" + encodeURIComponent(saved.name) + "/64"}
                      alt=""
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                    />
                    <button
                      type="button"
                      className="account-switcher-select"
                      disabled={disabled || active}
                      onClick={() => void handleSwitch(saved)}
                      title={active ? "Currently active" : "Switch to this account"}
                    >
                      <strong>{saved.name}</strong>
                      <span>{active ? "Active account" : saved.email}</span>
                    </button>
                    {active ? (
                      <span className="account-switcher-active-dot" title="Active account" />
                    ) : (
                      <button
                        type="button"
                        className="account-switcher-remove"
                        aria-label={"Remove " + saved.name}
                        title={"Remove " + saved.name}
                        disabled={disabled}
                        onClick={() => void handleRemove(saved)}
                      >
                        ×
                      </button>
                    )}
                    {switchingUuid === saved.uuid && <span className="account-switcher-spinner" aria-label="Switching account" />}
                    {removingUuid === saved.uuid && <span className="account-switcher-spinner" aria-label="Removing account" />}
                  </div>
                );
              })}
            </div>
          )}

          {(error || loginError) && <div className="account-switcher-error" role="alert">{error || loginError}</div>}

          <div className="account-switcher-footer">
            <button type="button" className="account-switcher-add" disabled={disabled} onClick={() => void handleAddAccount()}>
              <span aria-hidden="true">＋</span>
              {isLoggingIn ? "Waiting for Microsoft…" : "Add Microsoft account"}
            </button>
            <button type="button" className="account-switcher-manage" onClick={() => { setOpen(false); onOpenAccountPage(); }}>
              Manage account
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
