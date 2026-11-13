import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "./lib/supabase";

type ReleaseVersion = {
  version: string;
  channel: "official" | "test";
  asset_name: string;
  sha256: string;
  file_size: number;
  release_notes: string;
  created_at: string;
  downloadable: boolean;
};
type ReleaseStatus = {
  official_version: string;
  github_release_url: string;
  github_configured: boolean;
  versions: ReleaseVersion[];
};
type JarMetadata = {
  version: string;
  file_name: string;
  file_size: number;
  sha256: string;
  mod_id: string;
};
type Tab = "Built JARs" | "Publish release" | "Official version" | "Test versions";

async function releaseRequest(body: Record<string, unknown> | FormData) {
  const { data, error } = await supabase.functions.invoke("alphaclient-releases", { body });
  if (error) {
    const context = (error as any).context;
    if (context && typeof context.clone === "function") {
      try {
        const payload = await context.clone().json();
        throw new Error(payload?.error || error.message);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== error.message) throw parseError;
      }
    }
    throw new Error(error.message || "Release request failed.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes, index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

export default function ReleaseManagement({
  onBack,
  canManageReleases,
}: {
  onBack: () => void;
  canManageReleases: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Built JARs");
  const [status, setStatus] = useState<ReleaseStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<JarMetadata | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    const result = await releaseRequest({ action: "status" });
    setStatus(result as ReleaseStatus);
  }, []);

  useEffect(() => {
    if (!canManageReleases) return;
    let active = true;
    void releaseRequest({ action: "status" }).then((result) => {
      if (active) setStatus(result as ReleaseStatus);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load release information.");
    });
    return () => { active = false; };
  }, [canManageReleases]);

  const inspectFile = async (file: File) => {
    setBusy(true);
    setError("");
    setMessage("");
    setMetadata(null);
    try {
      const form = new FormData();
      form.append("action", "inspect");
      form.append("file", file, file.name);
      const result = await releaseRequest(form);
      setMetadata(result.metadata as JarMetadata);
      setMessage("JAR metadata verified.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not inspect this JAR.");
    } finally {
      setBusy(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setMetadata(null);
    setError("");
    setMessage("");
    if (file) void inspectFile(file);
  };

  const publish = async (channel: "official" | "test") => {
    if (!selectedFile || !metadata) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.append("action", channel === "official" ? "publish_official" : "publish_test");
      form.append("file", selectedFile, selectedFile.name);
      form.append("release_notes", releaseNotes);
      const result = await releaseRequest(form);
      setMessage(channel === "official"
        ? `AlphaClient ${result.version} is now the official release.`
        : `AlphaClient ${result.version} was saved as a private test version.`);
      await loadStatus();
      setTab(channel === "official" ? "Official version" : "Test versions");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Publishing failed.");
    } finally {
      setBusy(false);
    }
  };

  const promote = async (version: string) => {
    if (!window.confirm(`Set AlphaClient ${version} as the official version? This changes the version delivered by the Launcher.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await releaseRequest({ action: "set_official", version });
      setMessage(`AlphaClient ${version} is now the official version.`);
      await loadStatus();
      setTab("Official version");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not change the official version.");
    } finally {
      setBusy(false);
    }
  };

  const downloadTest = async (version: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await releaseRequest({ action: "download_test", version });
      await window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a test-build download.");
    } finally {
      setBusy(false);
    }
  };

  const versions = status?.versions ?? [];
  const testVersions = versions.filter((item) => item.channel === "test");
  const official = versions.find((item) => item.version === status?.official_version);

  if (!canManageReleases) {
    return (
      <section className="section-card developer-card release-overview">
        <button type="button" className="release-manager-back" onClick={onBack}>← Back to Release Manager</button>
        <h3>Release access restricted</h3>
        <p className="subtitle">This account does not have the launcher permission releases.manage.</p>
      </section>
    );
  }

  return (
    <section className="section-card developer-card release-overview release-management">
      <button type="button" className="release-manager-back" onClick={onBack}>← Back to Release Manager</button>
      <div className="section-header">
        <div>
          <span className="card-label">ALPHACLIENT RELEASES</span>
          <h3>Release management</h3>
        </div>
        <span className={status ? "developer-status" : "developer-status is-pending"}>
          {status ? (status.github_configured ? "Connected" : "GitHub setup required") : "Connecting…"}
        </span>
      </div>
      <div className="release-current-version">
        <span>OFFICIAL VERSION</span>
        <strong>{status?.official_version ?? "—"}</strong>
        <small>{official ? `${formatBytes(official.file_size)} · SHA-256 verified` : "Loading official release information"}</small>
      </div>
      <nav className="release-tabs" aria-label="Release management sections">
        {(["Built JARs", "Publish release", "Official version", "Test versions"] as Tab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>{item}</button>
        ))}
      </nav>

      {tab === "Built JARs" && (
        <div className="release-panel">
          <h4>Local AlphaClient builds</h4>
          <p className="subtitle">Select a built JAR from your computer. The backend checks the mod ID, reads the actual version from the JAR metadata, and calculates its SHA-256 checksum.</p>
          <label className="release-file-picker">
            <input type="file" accept=".jar,application/java-archive" onChange={onFileChange} disabled={busy} />
            <span>{selectedFile ? "Choose another JAR" : "Select AlphaClient JAR"}</span>
          </label>
          {selectedFile && <p className="release-file-name">{selectedFile.name} · {formatBytes(selectedFile.size)}</p>}
          {metadata && (
            <div className="release-metadata">
              <div><span>Detected version</span><strong>{metadata.version}</strong></div>
              <div><span>Mod ID</span><strong>{metadata.mod_id}</strong></div>
              <div><span>File size</span><strong>{formatBytes(metadata.file_size)}</strong></div>
              <div><span>SHA-256</span><code>{metadata.sha256}</code></div>
            </div>
          )}
        </div>
      )}

      {tab === "Publish release" && (
        <div className="release-panel">
          <h4>Publish a build</h4>
          <p className="subtitle">Choose a JAR in Built JARs first. Official builds are uploaded to the existing GitHub Release with tag Release. Test builds stay in private Supabase Storage.</p>
          {!selectedFile && <p className="release-inline-warning">No JAR selected. Select and inspect a build in Built JARs.</p>}
          {metadata && <p className="release-selected-build">Ready to publish: <strong>AlphaClient {metadata.version}</strong></p>}
          <label className="release-field-label" htmlFor="release-notes">Release notes</label>
          <textarea id="release-notes" className="release-notes-input" value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} placeholder="Describe the changes in this release…" rows={4} />
          <div className="release-actions">
            <button type="button" className="small-button" disabled={busy || !metadata || !status?.github_configured} onClick={() => void publish("official")}>Publish official release</button>
            <button type="button" className="small-button" disabled={busy || !metadata} onClick={() => void publish("test")}>Save as test version</button>
          </div>
          {!status?.github_configured && <p className="release-inline-warning">Official publishing is disabled until GITHUB_RELEASE_TOKEN is added to Supabase Edge Function secrets. Test builds can still be stored privately.</p>}
        </div>
      )}

      {tab === "Official version" && (
        <div className="release-panel">
          <h4>Official version</h4>
          <p className="subtitle">The Launcher update manifest serves this exact version. Changing it updates the official download target without changing the existing checksum verification.</p>
          <div className="release-version-current"><span>Currently selected</span><strong>{status?.official_version ?? "Loading…"}</strong></div>
          <div className="release-version-list">
            {testVersions.map((item) => (
              <div className="release-version-row" key={item.version}>
                <div><strong>{item.version}</strong><span>Private test build · {formatBytes(item.file_size)}</span></div>
                <button type="button" className="small-button" disabled={busy || !status?.github_configured} onClick={() => void promote(item.version)}>Set as official</button>
              </div>
            ))}
            {testVersions.length === 0 && <p className="subtitle">No stored test versions are available to promote.</p>}
          </div>
        </div>
      )}

      {tab === "Test versions" && (
        <div className="release-panel">
          <h4>Private test versions</h4>
          <p className="subtitle">Test JARs are stored in a private bucket and are not included in the public update manifest.</p>
          <div className="release-version-list">
            {testVersions.map((item) => (
              <div className="release-version-row" key={item.version}>
                <div><strong>{item.version}</strong><span>{formatBytes(item.file_size)} · Added {formatDate(item.created_at)}</span></div>
                <div className="release-actions">
                  <button type="button" className="small-button" disabled={busy} onClick={() => void downloadTest(item.version)}>Download</button>
                  <button type="button" className="small-button" disabled={busy || !status?.github_configured} onClick={() => void promote(item.version)}>Make official</button>
                </div>
              </div>
            ))}
            {testVersions.length === 0 && <p className="subtitle">No test versions have been saved yet.</p>}
          </div>
        </div>
      )}

      {busy && <p className="release-feedback">Working…</p>}
      {message && <p className="release-feedback is-success">{message}</p>}
      {error && <p className="release-feedback is-error">{error}</p>}
      <div className="release-footer">
        <a href={status?.github_release_url ?? "https://github.com/MsAlexTsuki/AlphaClient/releases/tag/Release"} target="_blank" rel="noreferrer">Open official GitHub Release</a>
        <button type="button" className="small-button" disabled={busy} onClick={() => { setError(""); void loadStatus().catch((reason) => setError(reason instanceof Error ? reason.message : "Refresh failed.")); }}>Refresh</button>
      </div>
    </section>
  );
}
