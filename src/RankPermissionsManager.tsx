import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./App.css";

type Rank = { key: string; label: string };
type Permission = { key: string; label: string; description: string };
type PermissionRow = { scope: string; rank_key: string; permission_key: string; enabled: boolean };

const RANKS: Rank[] = [
  { key: "founder", label: "Founder" },
  { key: "owner", label: "Owner" },
  { key: "manager", label: "Manager" },
  { key: "plat_admin", label: "Platform Admin" },
  { key: "management", label: "Management (legacy)" },
  { key: "senior_admin", label: "Senior Admin" },
  { key: "admin", label: "Admin" },
  { key: "senior_moderator", label: "Senior Moderator" },
  { key: "moderator", label: "Moderator" },
  { key: "trial_moderator", label: "Trial Moderator" },
  { key: "beta", label: "Beta" },
];

const PERMISSIONS: Permission[] = [
  { key: "members.manage", label: "Manage members", description: "View and manage community member accounts." },
  { key: "moderation.manage", label: "Moderation", description: "Use moderation actions and review moderation queues." },
  { key: "bans_reports.manage", label: "Bans & reports", description: "Manage bans, appeals and user reports." },
  { key: "ranks.manage", label: "Assign ranks", description: "Assign and change community ranks." },
  { key: "developer.tools", label: "Developer Dashboard & tools", description: "Open protected developer tools." },
  { key: "releases.manage", label: "Updates, releases & changelogs", description: "Manage update metadata, releases and changelog entries." },
];

const SCOPES = [
  { key: "community", label: "Community website" },
  { key: "launcher", label: "Launcher dashboard" },
];

export default function RankPermissionsManager() {
  const [scope, setScope] = useState("community");
  const [selectedRank, setSelectedRank] = useState("founder");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async (nextScope = scope) => {
    setLoading(true);
    setError("");
    setMessage("");
    const { data, error: loadError } = await supabase.rpc("get_rank_permissions", { p_scope: nextScope });
    if (loadError) {
      setError(loadError.message);
      setPermissions({});
    } else {
      const next: Record<string, boolean> = {};
      ((data ?? []) as PermissionRow[]).forEach(row => {
        if (row.rank_key === selectedRank) next[row.permission_key] = row.enabled;
      });
      if (selectedRank === "founder") {
        PERMISSIONS.forEach(permission => { next[permission.key] = true; });
      }
      setPermissions(next);
    }
    setLoading(false);
  };

  useEffect(() => { void load(scope); }, [scope, selectedRank]);

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    const rows = PERMISSIONS.map(permission => ({
      rank_key: selectedRank,
      permission_key: permission.key,
      enabled: selectedRank === "founder" || Boolean(permissions[permission.key]),
    }));
    const { error: saveError } = await supabase.rpc("save_rank_permissions", {
      p_scope: scope,
      p_permissions: rows,
    });
    if (saveError) setError(saveError.message);
    else {
      setMessage("Permissions saved successfully.");
      await load(scope);
    }
    setSaving(false);
  };

  const enabledCount = PERMISSIONS.filter(permission => Boolean(permissions[permission.key])).length;

  return <section className="section-card developer-card rank-permissions-manager">
    <div className="rank-permissions-heading">
      <div>
        <span className="card-label">ACCESS CONTROL</span>
        <h3>Rank Permissions</h3>
        <p>Choose a product area and configure access by rank. Founder always has every permission.</p>
      </div>
      <span className="rank-permissions-secure"><span aria-hidden="true">●</span> Server protected</span>
    </div>

    <div className="rank-permission-toolbar">
      <label>
        <span>Product area</span>
        <select value={scope} onChange={event => setScope(event.target.value)}>
          {SCOPES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
      <label>
        <span>Staff rank</span>
        <select value={selectedRank} onChange={event => setSelectedRank(event.target.value)}>
          {RANKS.map(rank => <option key={rank.key} value={rank.key}>{rank.label}</option>)}
        </select>
      </label>
    </div>

    <div className="rank-permission-summary">
      <div>
        <span className="rank-permission-summary-label">PERMISSIONS</span>
        <strong>{selectedRank === "beta" ? "Beta access" : RANKS.find(rank => rank.key === selectedRank)?.label}</strong>
      </div>
      <span className="rank-permission-count">{selectedRank === "founder" ? PERMISSIONS.length + " of " + PERMISSIONS.length + " enabled · always on" : enabledCount + " of " + PERMISSIONS.length + " enabled"}</span>
    </div>

    {error && <div className="friends-notice error" role="alert">{error}</div>}
    {message && <div className="friends-notice success" role="status">{message}</div>}

    {loading ? <div className="friends-loading">Loading permissions…</div> : <div className="rank-permission-list">
      {PERMISSIONS.map((permission, index) => {
        const enabled = Boolean(permissions[permission.key]);
        return <label className={`rank-permission-row${enabled ? " is-enabled" : ""}`} key={permission.key}>
          <span className="rank-permission-index">{String(index + 1).padStart(2, "0")}</span>
          <span className="rank-permission-copy">
            <strong>{permission.label}</strong>
            <small>{permission.description}</small>
          </span>
          <span className={`rank-permission-toggle${enabled ? " is-on" : ""}`} aria-hidden="true">
            <span />
          </span>
          <input
            type="checkbox"
            aria-label={permission.label}
            checked={enabled}
            disabled={selectedRank === "founder"}
            onChange={event => setPermissions(old => ({ ...old, [permission.key]: event.target.checked }))}
          />
        </label>;
      })}
    </div>}

    <div className="rank-permissions-footer">
      <span>Changes apply to <strong>{SCOPES.find(item => item.key === scope)?.label}</strong> only.</span>
      <button className="friends-primary" type="button" disabled={loading || saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save permissions"}
      </button>
    </div>
  </section>;
}
