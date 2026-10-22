import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

type ModRecord = { mod_id: string; display_name: string; category_key: string; description: string; enabled: boolean };
type RankPermission = { rank_key: string; mod_id: string; enabled: boolean };
type PlayerRecord = { user_id: string; username: string; display_name: string | null; rank_key: string };
type GrantRecord = { id: string; user_id: string; category_key: string; expires_at: string | null; reason: string; username?: string };
type OverrideRecord = { id: string; user_id: string; mod_id: string; effect: "allow" | "deny"; expires_at: string | null; reason: string; username?: string };
type RankSearchPlayer = { user_id: string; username: string; display_name: string | null; rank_key: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const parts = [
      typeof value.message === "string" ? value.message : "",
      typeof value.code === "string" ? `Code: ${value.code}` : "",
      typeof value.details === "string" ? `Details: ${value.details}` : "",
      typeof value.hint === "string" ? `Hint: ${value.hint}` : "",
    ].filter(Boolean);
    if (parts.length) return parts.join(" · ");
    try { return JSON.stringify(error); } catch { return "An unknown error occurred."; }
  }
  return String(error);
}

const RANKS = [
  ["founder", "Founder"], ["owner", "Owner"], ["manager", "Manager"], ["developer", "Developer"], ["plat_admin", "Platform Admin"],
  ["senior_admin", "Sr Admin"], ["admin", "Admin"], ["senior_moderator", "Sr Mod"], ["moderator", "Moderator"],
  ["trial_moderator", "T-Mod"], ["donator", "Donator"], ["beta", "Beta"], ["alpha_plus", "Alpha+"], ["alpha", "Alpha"],
  ["elite", "Elite"], ["rogue", "Rogue"], ["scout", "Scout"], ["the_nibbler", "The Nibbler"],
  ["media", "Media"], ["famous", "Famous"], ["partner", "Partner"], ["member", "Member"],
] as const;
const CATEGORIES = [
  ["general", "General"], ["staff", "Staff"], ["trial_moderator", "Trial Moderator"],
  ["moderator", "Moderator"], ["senior_moderator", "Senior Moderator"], ["admin", "Admin"],
  ["senior_admin", "Senior Admin"], ["management", "Management"], ["plat_admin", "Platform Admin"], ["manager", "Manager"], ["owner", "Owner"],
  ["beta", "Beta"], ["alpha", "Alpha"], ["alpha_plus", "Alpha+"],
] as const;

export default function ClientModPermissionsManager() {
  const [activeTab, setActiveTab] = useState<"home" | "rank" | "player" | "rules">("home");
  const [mods, setMods] = useState<ModRecord[]>([]);
  const [permissions, setPermissions] = useState<RankPermission[]>([]);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [overrides, setOverrides] = useState<OverrideRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedRank, setSelectedRank] = useState("member");
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [selectedMod, setSelectedMod] = useState("");
  const [effect, setEffect] = useState<"allow" | "deny">("allow");
  const [duration, setDuration] = useState("permanent");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async (term = search) => {
    setLoading(true); setError("");
    try {
      const [catalog, rankRows, playerRows, grantRows, overrideRows] = await Promise.all([
        supabase.rpc("admin_list_client_mods"),
        supabase.rpc("admin_get_client_mod_rank_permissions"),
        supabase.rpc("admin_search_client_mod_players", { p_search: term.trim() }),
        supabase.rpc("admin_list_client_mod_category_grants"),
        supabase.rpc("admin_list_client_mod_user_overrides"),
      ]);
      for (const result of [catalog, rankRows, playerRows, grantRows, overrideRows]) if (result.error) throw result.error;
      setMods((catalog.data ?? []) as ModRecord[]);
      setPermissions((rankRows.data ?? []) as RankPermission[]);
      setPlayers(((playerRows.data ?? []) as RankSearchPlayer[]).map(player => ({
        user_id: player.user_id,
        username: player.username,
        display_name: player.display_name,
        rank_key: player.rank_key,
      })));
      setGrants((grantRows.data ?? []) as GrantRecord[]);
      setOverrides((overrideRows.data ?? []) as OverrideRecord[]);
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(""); }, []);
  const chosenPlayer = players.find(p => p.user_id === selectedPlayer);
  const groupedMods = useMemo(() => CATEGORIES.map(([key, label]) => ({
    key, label, mods: mods.filter(m => m.category_key === key),
  })).filter(g => g.mods.length), [mods]);

  const saveRankDefaults = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const { error: rpcError } = await supabase.rpc("save_client_mod_rank_permissions", {
        p_rank_key: selectedRank,
        p_permissions: mods.map(mod => ({
          mod_id: mod.mod_id,
          enabled: selectedRank === "founder" || (permissions.find(p => p.rank_key === selectedRank && p.mod_id === mod.mod_id)?.enabled ?? false),
        })),
      });
      if (rpcError) throw rpcError;
      setMessage("Rank defaults saved.");
      await load();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };

  const saveGrant = async () => {
    if (!selectedPlayer) { setError("Select a player first."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const expiresAt = duration === "permanent" ? null : new Date(Date.now() + Number(duration) * 60 * 60 * 1000).toISOString();
      if (selectedMod) {
        const { error: rpcError } = await supabase.rpc("set_client_mod_user_override", {
          p_user_id: selectedPlayer, p_mod_id: selectedMod, p_effect: effect,
          p_expires_at: expiresAt, p_reason: reason.trim() || "Manual access rule via AlphaLauncher Mods",
        });
        if (rpcError) throw rpcError;
      } else {
        if (effect !== "allow") throw new Error("Category grants only grant access. Use an individual mod override to deny access.");
        const { error: rpcError } = await supabase.rpc("grant_client_mod_category", {
          p_user_id: selectedPlayer, p_category_key: selectedCategory,
          p_expires_at: expiresAt, p_reason: reason.trim() || "Manual access rule via AlphaLauncher Mods",
        });
        if (rpcError) throw rpcError;
      }
      setMessage("Access rule saved.");
      setReason("");
      await load();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };

  const revokeGrant = async (id: string) => {
    setBusy(true); setError("");
    try { const { error: e } = await supabase.rpc("revoke_client_mod_category_grant", { p_grant_id: id }); if (e) throw e; await load(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const revokeOverride = async (id: string) => {
    setBusy(true); setError("");
    try { const { error: e } = await supabase.rpc("revoke_client_mod_user_override", { p_override_id: id }); if (e) throw e; await load(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  return <div className="client-mod-manager mods-permissions-page">
    <div className="mods-permissions-heading">
      <div><span className="card-label">ALPHACLIENT MODS</span><h2>Mod Permissions</h2><p className="subtitle">Manage mod access by rank, player, or individual access rule.</p></div>
      <button className="small-button" onClick={() => void load()} disabled={loading || busy}>Refresh</button>
    </div>
    {activeTab === "home" ? <section className="mods-permissions-home" aria-label="Mods sections">
      <button type="button" className="mods-permissions-home-card" onClick={() => setActiveTab("rank")}>
        <span className="mods-permissions-home-icon" aria-hidden="true">◇</span>
        <span className="mods-permissions-home-copy"><strong>Rank Permission</strong><small>Manage default mod access for each rank.</small></span>
        <span className="mods-permissions-home-chevron" aria-hidden="true">›</span>
      </button>
      <button type="button" className="mods-permissions-home-card" onClick={() => setActiveTab("player")}>
        <span className="mods-permissions-home-icon" aria-hidden="true">♙</span>
        <span className="mods-permissions-home-copy"><strong>Player Permission</strong><small>Manage individual player access and grants.</small></span>
        <span className="mods-permissions-home-chevron" aria-hidden="true">›</span>
      </button>
      <button type="button" className="mods-permissions-home-card" onClick={() => setActiveTab("rules")}>
        <span className="mods-permissions-home-icon" aria-hidden="true">☷</span>
        <span className="mods-permissions-home-copy"><strong>Grants and Overrides</strong><small>Review, manage, and revoke access rules.</small></span>
        <span className="mods-permissions-home-chevron" aria-hidden="true">›</span>
      </button>
    </section> : <>
      <button type="button" className="mods-permissions-back" onClick={() => setActiveTab("home")}><span aria-hidden="true">‹</span> Back to Mods</button>
      {activeTab === "rank" && <div className="mods-permissions-section-title"><h3>Rank Permission</h3><p className="subtitle">Configure default mod access for each rank.</p></div>}
      {activeTab === "player" && <div className="mods-permissions-section-title"><h3>Player Permission</h3><p className="subtitle">Manage individual player access.</p></div>}
      {activeTab === "rules" && <div className="mods-permissions-section-title"><h3>Grants and Overrides</h3><p className="subtitle">Review and revoke category grants and individual overrides.</p></div>}
    </>}
    {activeTab === "rank" && <section className="section-card developer-card">
      <div className="section-header"><div><span className="card-label">ALPHACLIENT</span><h3>Mod permission defaults</h3></div><button className="small-button" onClick={() => void load()} disabled={loading || busy}>Refresh</button></div>
      <p className="subtitle">Choose a rank folder, then configure exactly which mods that rank can access. Each rank has its own saved defaults. Founder access is always enabled.</p>
      <div className="rank-folder-grid" aria-label="Rank folders">
        {RANKS.map(([key, label]) => {
          const enabledCount = key === "founder"
            ? mods.length
            : mods.filter(mod => permissions.find(permission => permission.rank_key === key && permission.mod_id === mod.mod_id)?.enabled ?? false).length;
          const active = selectedRank === key;
          return <button
            type="button"
            key={key}
            className={`rank-folder-card${active ? " is-selected" : ""}`}
            aria-pressed={active}
            onClick={() => setSelectedRank(key)}
          >
            <span className="rank-folder-icon" aria-hidden="true">▰</span>
            <span className="rank-folder-copy"><strong>{label}</strong><small>{enabledCount} / {mods.length} mods enabled</small></span>
            <span className="rank-folder-chevron" aria-hidden="true">›</span>
          </button>;
        })}
      </div>
      <div className="rank-folder-editor">
        <div className="rank-folder-editor-heading">
          <div><span className="card-label">RANK FOLDER</span><h4>{RANKS.find(([key]) => key === selectedRank)?.[1] ?? selectedRank}</h4></div>
          <span className="rank-folder-count">{selectedRank === "founder" ? `${mods.length} / ${mods.length} enabled · always on` : `${mods.filter(mod => permissions.find(p => p.rank_key === selectedRank && p.mod_id === mod.mod_id)?.enabled ?? false).length} / ${mods.length} enabled`}</span>
        </div>
        {selectedRank === "founder" && <p className="subtitle">Founder always has access to every enabled mod. These permissions cannot be disabled.</p>}
        {loading ? <p className="subtitle">Loading mod permissions…</p> : groupedMods.map(group => {
          const groupEnabled = group.mods.filter(mod => selectedRank === "founder" || (permissions.find(p => p.rank_key === selectedRank && p.mod_id === mod.mod_id)?.enabled ?? false)).length;
          return <div className="rank-mod-group" key={group.key}>
            <div className="rank-mod-group-heading"><h5>{group.label}</h5><span>{groupEnabled} / {group.mods.length}</span></div>
            <div className="rank-mod-rows">
              {group.mods.map(mod => {
                const enabled = selectedRank === "founder" || (permissions.find(p => p.rank_key === selectedRank && p.mod_id === mod.mod_id)?.enabled ?? false);
                return <div className={`rank-mod-row${enabled ? " is-enabled" : ""}`} key={mod.mod_id}>
                  <span className="rank-mod-copy"><strong>{mod.display_name}</strong><small>{mod.description} · {mod.mod_id}</small></span>
                  <button
                    type="button"
                    className="mods-permission-switch"
                    role="switch"
                    aria-label={`${mod.display_name} permission`}
                    aria-checked={enabled}
                    disabled={selectedRank === "founder"}
                    onClick={() => setPermissions(old => {
                      const current = old.find(p => p.rank_key === selectedRank && p.mod_id === mod.mod_id)?.enabled ?? false;
                      const rest = old.filter(p => !(p.rank_key === selectedRank && p.mod_id === mod.mod_id));
                      return [...rest, { rank_key: selectedRank, mod_id: mod.mod_id, enabled: !current }];
                    })}
                  ><span /></button>
                </div>;
              })}
            </div>
          </div>;
        })}
        <button className="large-play-button developer-start-button" onClick={() => void saveRankDefaults()} disabled={busy || loading || selectedRank === "founder"}>{busy ? "SAVING…" : `SAVE ${(RANKS.find(([key]) => key === selectedRank)?.[1] ?? selectedRank).toUpperCase()} PERMISSIONS`}</button>
      </div>
    </section>}

    {activeTab === "player" && <section className="section-card developer-card">
      <div className="section-header"><div><span className="card-label">PLAYER ACCESS</span><h3>Player Permission</h3></div></div>
      <label className="developer-input-label">Search player</label>
      <div className="client-mod-search-row"><input className="developer-text-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Username or display name"/><button className="small-button" onClick={() => void load(search)} disabled={loading}>Search</button></div>
      <label className="developer-input-label">Player</label>
      <select className="developer-text-input" value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)}>
        <option value="">Select player…</option>{players.map(p => <option key={p.user_id} value={p.user_id}>{p.display_name || p.username} (@{p.username}) — {p.rank_key}</option>)}
      </select>
      {chosenPlayer && <p className="subtitle">Selected rank: {chosenPlayer.rank_key}. Grants below do not alter this rank.</p>}
      <div className="client-mod-grant-grid">
        <div><label className="developer-input-label">Grant scope</label><select className="developer-text-input" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}><option value="general">General category</option>{CATEGORIES.filter(([k]) => k !== "general").map(([k,l]) => <option key={k} value={k}>{l} category</option>)}</select></div>
        <div><label className="developer-input-label">Individual mod (optional)</label><select className="developer-text-input" value={selectedMod} onChange={e => setSelectedMod(e.target.value)}><option value="">Entire selected category</option>{mods.map(m => <option key={m.mod_id} value={m.mod_id}>{m.display_name}</option>)}</select></div>
      </div>
      <div className="client-mod-grant-grid">
        <div><label className="developer-input-label">Action</label><select className="developer-text-input" value={effect} onChange={e => setEffect(e.target.value as "allow"|"deny")}><option value="allow">Allow access</option><option value="deny">Deny access (individual mod only)</option></select></div>
        <div><label className="developer-input-label">Duration</label><select className="developer-text-input" value={duration} onChange={e => setDuration(e.target.value)}><option value="permanent">Permanent</option><option value="1">1 hour</option><option value="24">24 hours</option><option value="168">7 days</option><option value="720">30 days</option></select></div>
      </div>
      <label className="developer-input-label">Reason (optional)</label><input className="developer-text-input" value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="Reason for this access rule"/>
      <button className="large-play-button developer-start-button" onClick={() => void saveGrant()} disabled={busy || !selectedPlayer || (effect === "deny" && !selectedMod)}>{busy ? "SAVING…" : "APPLY ACCESS RULE"}</button>
      {message && <p className="launch-success" role="status">{message}</p>}
      {error && <p className="launch-error" role="alert">{error}</p>}
    </section>}

    {activeTab === "rules" && <section className="section-card developer-card">
      <div className="section-header"><div><span className="card-label">ACTIVE RULES</span><h3>Grants and Overrides</h3></div></div>
      <h4>Category grants</h4>
      {grants.length === 0 ? <p className="subtitle">No active category grants.</p> : grants.map(g => <div className="client-mod-rule" key={g.id}><span><strong>{g.username || g.user_id}</strong><small>{g.category_key} · {g.expires_at ? "Expires " + new Date(g.expires_at).toLocaleString() : "Permanent"}{g.reason ? " · " + g.reason : ""}</small></span><button className="small-button" disabled={busy} onClick={() => void revokeGrant(g.id)}>Revoke</button></div>)}
      <h4>Individual mod overrides</h4>
      {overrides.length === 0 ? <p className="subtitle">No active individual overrides.</p> : overrides.map(o => <div className="client-mod-rule" key={o.id}><span><strong>{o.username || o.user_id}</strong><small>{o.mod_id} · {o.effect} · {o.expires_at ? "Expires " + new Date(o.expires_at).toLocaleString() : "Permanent"}{o.reason ? " · " + o.reason : ""}</small></span><button className="small-button" disabled={busy} onClick={() => void revokeOverride(o.id)}>Revoke</button></div>)}
    </section>}
  </div>;
}
