import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./App.css";

type Rank = { key: string; label: string };
type Permission = { key: string; label: string; description: string };
type PermissionRow = { scope: string; rank_key: string; permission_key: string; enabled: boolean };

const RANKS: Rank[] = [
  { key: "founder", label: "Founder" },
  { key: "owner", label: "Owner" },
  { key: "management", label: "Management" },
  { key: "senior_admin", label: "Senior Admin" },
  { key: "admin", label: "Admin" },
  { key: "senior_moderator", label: "Senior Moderator" },
  { key: "moderator", label: "Moderator" },
  { key: "trial_moderator", label: "Trial Moderator" },
  { key: "beta", label: "Beta" },
  { key: "alpha_plus", label: "Alpha+" },
  { key: "alpha", label: "Alpha" },
  { key: "member", label: "Member" },
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
  const [selectedRank, setSelectedRank] = useState("member");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async (nextScope = scope) => {
    setLoading(true); setError(""); setMessage("");
    const { data, error: loadError } = await supabase.rpc("get_rank_permissions", { p_scope: nextScope });
    if (loadError) {
      setError(loadError.message);
      setPermissions({});
    } else {
      const next: Record<string, boolean> = {};
      ((data ?? []) as PermissionRow[]).forEach(row => {
        if (row.rank_key === selectedRank) next[row.permission_key] = row.enabled;
      });
      setPermissions(next);
    }
    setLoading(false);
  };

  useEffect(() => { void load(scope); }, [scope, selectedRank]);

  const save = async () => {
    setSaving(true); setError(""); setMessage("");
    const rows = PERMISSIONS.map(permission => ({
      rank_key: selectedRank,
      permission_key: permission.key,
      enabled: Boolean(permissions[permission.key]),
    }));
    const { error: saveError } = await supabase.rpc("save_rank_permissions", {
      p_scope: scope,
      p_permissions: rows,
    });
    if (saveError) setError(saveError.message);
    else { setMessage("Rank permissions saved."); await load(scope); }
    setSaving(false);
  };

  return <section className="section-card developer-card rank-permissions-manager">
    <div className="section-header"><div><span className="card-label">ACCESS CONTROL</span><h3>Rank Permissions Manager</h3></div><span className="developer-status">Server enforced</span></div>
    <p className="subtitle">Configure access separately for the community website and launcher dashboard. Changes are stored in Supabase and protected by server-side permission checks.</p>
    <div className="rank-permission-toolbar">
      <label>Scope<select value={scope} onChange={event => setScope(event.target.value)}>{SCOPES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <label>Rank<select value={selectedRank} onChange={event => setSelectedRank(event.target.value)}>{RANKS.map(rank => <option key={rank.key} value={rank.key}>{rank.label}</option>)}</select></label>
    </div>
    {error && <div className="friends-notice error" role="alert">{error}</div>}
    {message && <div className="friends-notice success" role="status">{message}</div>}
    {loading ? <div className="friends-loading">Loading permissions…</div> : <div className="rank-permission-list">
      {PERMISSIONS.map(permission => <label className="rank-permission-row" key={permission.key}>
        <span><strong>{permission.label}</strong><small>{permission.description}</small></span>
        <input type="checkbox" checked={Boolean(permissions[permission.key])} onChange={event => setPermissions(old => ({ ...old, [permission.key]: event.target.checked }))} />
      </label>)}
    </div>}
    <div className="profile-form-actions"><button className="friends-primary" type="button" disabled={loading || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save permissions"}</button></div>
  </section>;
}
