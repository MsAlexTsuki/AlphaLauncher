import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type LauncherMod = {
  file_name: string;
  enabled: boolean;
  is_alphaclient: boolean;
  size_bytes: number;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ModsPage() {
  const [mods, setMods] = useState<LauncherMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyMod, setBusyMod] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refreshMods = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMods(await invoke<LauncherMod[]>("list_launcher_mods"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMods();
  }, [refreshMods]);

  const toggleMod = async (mod: LauncherMod) => {
    if (mod.is_alphaclient || busyMod) return;
    setBusyMod(mod.file_name);
    setError("");
    setMessage("");
    try {
      await invoke("set_launcher_mod_enabled", {
        fileName: mod.file_name,
        enabled: !mod.enabled,
      });
      setMessage(`${mod.file_name} ${mod.enabled ? "disabled" : "enabled"}. Restart Minecraft for the change to take effect.`);
      await refreshMods();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyMod(null);
    }
  };

  const openModsFolder = async () => {
    setError("");
    setMessage("");
    try {
      await invoke("open_launcher_mods_folder");
      setMessage("Mods folder opened. Add .jar files there, then refresh this list.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const enabledCount = mods.filter((mod) => mod.enabled).length;
  const customMods = mods.filter((mod) => !mod.is_alphaclient);

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">MINECRAFT 1.8.9 · FORGE</p>
        <h1>Mods</h1>
        <p className="subtitle">
          Choose which mods Forge loads when you start AlphaClient. AlphaClient is always enabled.
        </p>
      </div>

      <section className="section-card" style={{ marginBottom: 18 }}>
        <div className="section-header">
          <div>
            <span className="card-label">MODS FOLDER</span>
            <h3>Your Minecraft mods</h3>
          </div>
          <button type="button" className="small-button" onClick={() => void refreshMods()} disabled={loading || busyMod !== null}>
            Refresh
          </button>
        </div>
        <p className="subtitle" style={{ marginTop: 0 }}>
          Add your own mods by placing their <code>.jar</code> files in the active folder below.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <code style={{ display: "block", flex: "1 1 340px", minWidth: 0, padding: "11px 13px", borderRadius: 8, background: "rgba(0,0,0,0.22)", border: "1px solid var(--border)", color: "var(--yellow-light)", overflowWrap: "anywhere" }}>
            %APPDATA%\\AlphaClient\\mods
          </code>
          <button type="button" className="secondary-button" onClick={() => void openModsFolder()}>
            Open mods folder
          </button>
        </div>
        <p className="subtitle" style={{ marginBottom: 0, marginTop: 10 }}>
          Disabled mods are moved to <code>%APPDATA%\\AlphaClient\\mods-disabled</code> so Forge does not load them.
        </p>
      </section>

      {error && <p className="launch-error" role="alert">{error}</p>}
      {message && <p className="launch-success" role="status">{message}</p>}

      <section className="section-card">
        <div className="section-header">
          <div>
            <span className="card-label">MOD LIBRARY</span>
            <h3>Installed mods</h3>
          </div>
          <span className="developer-status">{enabledCount} enabled · {mods.length} total</span>
        </div>

        {loading ? (
          <p className="subtitle">Reading the mods folder…</p>
        ) : mods.length === 0 ? (
          <div style={{ padding: "24px 0" }}>
            <h3 style={{ marginTop: 0 }}>No mods found</h3>
            <p className="subtitle">AlphaClient will be installed automatically when you launch or update the client. You can add other compatible Forge 1.8.9 .jar mods using the button above.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {mods.map((mod) => (
              <div key={mod.file_name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 15px", border: "1px solid var(--border)", borderRadius: 10, background: "rgba(255,255,255,0.018)" }}>
                <div aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, flex: "0 0 42px", borderRadius: 10, border: "1px solid rgba(255,200,61,0.2)", background: "rgba(255,200,61,0.08)", color: "var(--yellow)", fontWeight: 800 }}>
                  {mod.is_alphaclient ? "A" : "JAR"}
                </div>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <strong style={{ display: "block", overflowWrap: "anywhere" }}>{mod.file_name}</strong>
                  <span style={{ display: "block", marginTop: 5, color: "var(--muted)", fontSize: 12 }}>
                    {mod.is_alphaclient ? "Official client · Managed by Alpha Launcher" : `${formatSize(mod.size_bytes)} · ${mod.enabled ? "Loaded by Forge" : "Disabled"}`}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
                  <span style={{ color: mod.enabled ? "var(--green)" : "var(--muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
                    {mod.is_alphaclient ? "REQUIRED" : mod.enabled ? "ENABLED" : "DISABLED"}
                  </span>
                  {mod.is_alphaclient ? (
                    <button type="button" className="small-button" disabled title="AlphaClient is automatically loaded and cannot be disabled here.">Always on</button>
                  ) : (
                    <button type="button" className="small-button" disabled={busyMod !== null} onClick={() => void toggleMod(mod)}>
                      {busyMod === mod.file_name ? "Working…" : mod.enabled ? "Disable" : "Enable"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && customMods.length === 0 && mods.some((mod) => mod.is_alphaclient) && (
          <p className="subtitle" style={{ marginBottom: 0, marginTop: 14 }}>
            No custom mods yet. Add compatible Forge 1.8.9 mods to the folder to see them here.
          </p>
        )}
      </section>
    </div>
  );
}
