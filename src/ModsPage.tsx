import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type LauncherMod = {
  file_name: string;
  enabled: boolean;
  is_alphaclient: boolean;
  size_bytes: number;
};

type RecordingStudioStatus = {
  installed: boolean;
  enabled: boolean;
  installedVersion: string | null;
  latestVersion: string | null;
  releaseAvailable: boolean;
  updateAvailable: boolean;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const RECORDING_STUDIO_FILE = "AlphaRecordingStudio.jar";

export default function ModsPage() {
  const [mods, setMods] = useState<LauncherMod[]>([]);
  const [recordingStudio, setRecordingStudio] = useState<RecordingStudioStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyMod, setBusyMod] = useState<string | null>(null);
  const [busyRecordingStudio, setBusyRecordingStudio] = useState(false);
  const [error, setError] = useState("");
  const [recordingStudioError, setRecordingStudioError] = useState("");
  const [message, setMessage] = useState("");

  const refreshMods = useCallback(async () => {
    setLoading(true);
    setError("");
    setRecordingStudioError("");

    const [modsResult, studioResult] = await Promise.allSettled([
      invoke<LauncherMod[]>("list_launcher_mods"),
      invoke<RecordingStudioStatus>("get_recording_studio_status"),
    ]);

    if (modsResult.status === "fulfilled") {
      setMods(modsResult.value);
    } else {
      setError(modsResult.reason instanceof Error ? modsResult.reason.message : String(modsResult.reason));
    }

    if (studioResult.status === "fulfilled") {
      setRecordingStudio(studioResult.value);
    } else {
      setRecordingStudioError(studioResult.reason instanceof Error ? studioResult.reason.message : String(studioResult.reason));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshMods();
  }, [refreshMods]);

  const toggleMod = async (mod: LauncherMod) => {
    if (mod.is_alphaclient || busyMod || mod.file_name === RECORDING_STUDIO_FILE) return;
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

  const toggleRecordingStudio = async () => {
    if (!recordingStudio || busyRecordingStudio) return;
    setBusyRecordingStudio(true);
    setError("");
    setMessage("");
    try {
      await invoke("set_launcher_mod_enabled", {
        fileName: RECORDING_STUDIO_FILE,
        enabled: !recordingStudio.enabled,
      });
      setMessage(`Alpha Recording Studio ${recordingStudio.enabled ? "disabled" : "enabled"}. Restart Minecraft for the change to take effect.`);
      await refreshMods();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyRecordingStudio(false);
    }
  };

  const installOrUpdateRecordingStudio = async () => {
    if (busyRecordingStudio || !recordingStudio?.releaseAvailable) return;
    setBusyRecordingStudio(true);
    setError("");
    setMessage("");
    try {
      const result = await invoke<string>("install_recording_studio");
      setMessage(result);
      await refreshMods();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyRecordingStudio(false);
    }
  };

  const uninstallRecordingStudio = async () => {
    if (busyRecordingStudio || !recordingStudio?.installed) return;
    if (!window.confirm("Uninstall Alpha Recording Studio from this computer? Its official entry will remain in Alpha Launcher, and you can install it again later.")) return;

    setBusyRecordingStudio(true);
    setError("");
    setMessage("");
    try {
      const result = await invoke<string>("uninstall_recording_studio");
      setMessage(result);
      await refreshMods();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyRecordingStudio(false);
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

  const alphaClientMod = mods.find((mod) => mod.is_alphaclient);
  const visibleMods = mods.filter((mod) => mod.file_name !== RECORDING_STUDIO_FILE && !mod.is_alphaclient);
  const enabledCount = visibleMods.filter((mod) => mod.enabled).length;
    const studioNeedsUpdate = recordingStudio?.installed
    && recordingStudio.releaseAvailable
    && (recordingStudio.updateAvailable || !recordingStudio.installedVersion);

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
            <span className="card-label">OFFICIAL ALPHA MODULES</span>
            <h3>Alpha Recording Studio</h3>
          </div>
          <span className="developer-status">
            {recordingStudio?.installed
              ? recordingStudio.enabled ? "Enabled" : "Disabled"
              : "Optional addon"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 15px", marginBottom: 14, border: "1px solid var(--border)", borderRadius: 10, background: "rgba(255,255,255,0.018)" }}>
          <div aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, flex: "0 0 42px", borderRadius: 10, border: "1px solid rgba(255,200,61,0.2)", background: "rgba(255,200,61,0.08)", color: "var(--yellow)", fontWeight: 800 }}>
            A
          </div>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <strong style={{ display: "block", overflowWrap: "anywhere" }}>{alphaClientMod?.file_name ?? "AlphaClient.jar"}</strong>
            <span style={{ display: "block", marginTop: 5, color: "var(--muted)", fontSize: 12 }}>
              Official client · Managed by Alpha Launcher
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
            <span style={{ color: "var(--green)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>REQUIRED</span>
            <button type="button" className="small-button" disabled title="AlphaClient is automatically loaded and cannot be disabled here.">Always on</button>
          </div>
        </div>

        <p className="subtitle" style={{ marginTop: 0 }}>
          Recording Studio and Build Timelapse tools for Minecraft 1.8.9. This is an optional addon; AlphaClient works without it.
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block" }}>
              {recordingStudio?.installed
                ? `Installed version: ${recordingStudio.installedVersion ?? "Unknown"}`
                : "Not installed"}
            </strong>
            <span style={{ display: "block", marginTop: 5, color: "var(--muted)", fontSize: 12 }}>
              {recordingStudio?.releaseAvailable
                ? `Latest release: ${recordingStudio.latestVersion ?? "Available"}`
                : recordingStudioError
                  ? "Release information could not be checked."
                  : "No published Recording Studio release is currently available."}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {recordingStudio?.installed ? (
              <>
                <button
                  type="button"
                  className="small-button"
                  disabled={busyRecordingStudio}
                  onClick={() => void toggleRecordingStudio()}
                >
                  {busyRecordingStudio ? "Working…" : recordingStudio.enabled ? "Disable" : "Enable"}
                </button>
                {studioNeedsUpdate && (
                  <button
                    type="button"
                    className="small-button"
                    disabled={busyRecordingStudio}
                    onClick={() => void installOrUpdateRecordingStudio()}
                  >
                    {busyRecordingStudio ? "Updating…" : "Update"}
                  </button>
                )}
                <button
                  type="button"
                  className="small-button"
                  disabled={busyRecordingStudio}
                  onClick={() => void uninstallRecordingStudio()}
                >
                  Uninstall
                </button>
              </>
            ) : (
              <button
                type="button"
                className="small-button"
                disabled={busyRecordingStudio || !recordingStudio?.releaseAvailable}
                onClick={() => void installOrUpdateRecordingStudio()}
                title={!recordingStudio?.releaseAvailable ? "The official addon release is not available yet." : undefined}
              >
                {busyRecordingStudio ? "Installing…" : "Install"}
              </button>
            )}
          </div>
        </div>

        {recordingStudioError && (
          <p className="launch-error" role="alert" style={{ marginBottom: 0, marginTop: 12 }}>
            Could not check Recording Studio releases: {recordingStudioError}
          </p>
        )}
        {recordingStudio?.installed && (
          <p className="subtitle" style={{ marginBottom: 0, marginTop: 12 }}>
            Uninstall removes the local addon files only. Alpha Recording Studio remains listed here and can be installed again.
          </p>
        )}
      </section>

      <section className="section-card" style={{ marginBottom: 18 }}>
        <div className="section-header">
          <div>
            <span className="card-label">MODS FOLDER</span>
            <h3>Your Minecraft mods</h3>
          </div>
          <button type="button" className="small-button" onClick={() => void refreshMods()} disabled={loading || busyMod !== null || busyRecordingStudio}>
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
          <span className="developer-status">{enabledCount} enabled · {visibleMods.length} total</span>
        </div>

        {loading ? (
          <p className="subtitle">Reading the mods folder…</p>
        ) : visibleMods.length === 0 ? (
          <div style={{ padding: "24px 0" }}>
            <h3 style={{ marginTop: 0 }}>No custom mods found</h3>
            <p className="subtitle">All official Alpha modules are managed above. You can add other compatible Forge 1.8.9 .jar mods using the button above.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visibleMods.map((mod) => (
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
                    <button type="button" className="small-button" disabled={busyMod !== null || busyRecordingStudio} onClick={() => void toggleMod(mod)}>
                      {busyMod === mod.file_name ? "Working…" : mod.enabled ? "Disable" : "Enable"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </section>
    </div>
  );
}
