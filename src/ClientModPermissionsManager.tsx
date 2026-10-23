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
  ["senior_admin", "Senior Admin"], ["management", "Management"], ["plat_admin", "Platform Admin"],
  ["manager", "Manager"], ["owner", "Owner"], ["founder", "Founder"], ["beta", "Beta"],
  ["donator", "Donator"], ["scout", "Scout"], ["rogue", "Rogue"], ["elite", "Elite"],
  ["alpha", "Alpha"], ["alpha_plus", "Alpha+"], ["mod", "Mod"], ["sr_mod", "Sr Mod"],
] as const;

// Mirrors the actual StaffMods folder tree in AlphaClient. Management contains two subfolders.
const CLIENT_RANK_FOLDERS = [
  { key: "general", label: "General", description: "Public client modules and Bhop." },
  { key: "beta", label: "Beta", description: "Beta rank modules." },
  { key: "donator", label: "Donator", description: "Donator and supporter modules." },
  { key: "trial_moderator", label: "T-Mod", description: "Trial Moderator modules." },
  { key: "moderator", label: "Mod", description: "Moderator modules." },
  { key: "senior_moderator", label: "Sr Mod", description: "Senior Moderator modules." },
  { key: "admin", label: "Admin", description: "Admin modules." },
  { key: "senior_admin", label: "Sr Admin", description: "Senior Admin modules." },
  { key: "management", label: "Management", description: "Platform Admin and Manager subfolders." },
  { key: "owner", label: "Owner", description: "Owner folder." },
  { key: "founder", label: "Founder", description: "Founder-only client modules." },
] as const;
const MANAGEMENT_SUBFOLDERS = [
  { key: "plat_admin", label: "Platform Admin", description: "Platform Admin permissions." },
  { key: "manager", label: "Manager", description: "Manager permissions." },
] as const;
const DONATOR_SUBFOLDERS = [
  { key: "scout", label: "Scout", description: "Scout donor-rank permissions." },
  { key: "rogue", label: "Rogue", description: "Rogue donor-rank permissions." },
  { key: "elite", label: "Elite", description: "Elite donor-rank permissions." },
  { key: "alpha", label: "Alpha", description: "Alpha donor-rank permissions." },
  { key: "alpha_plus", label: "Alpha+", description: "Alpha+ donor-rank permissions." },
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
  const [selectedRankFolder, setSelectedRankFolder] = useState("general");
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
  const groupedMods = useMemo(() => {
    const categoryKeys = Array.from(new Set(mods.map(mod => mod.category_key))).sort((a, b) => {
      const aIndex = CATEGORIES.findIndex(([key]) => key === a);
      const bIndex = CATEGORIES.findIndex(([key]) => key === b);
      if (aIndex < 0 && bIndex < 0) return a.localeCompare(b);
      if (aIndex < 0) return 1;
      if (bIndex < 0) return -1;
      return aIndex - bIndex;
    });
    return categoryKeys.map(key => ({
      key,
      label: CATEGORIES.find(([categoryKey]) => categoryKey === key)?.[1]
        ?? key.split("_").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
      mods: mods.filter(mod => mod.category_key === key),
    }));
  }, [mods]);

  // Keep the complete Rank Permission folder tree visible, including empty folders.
  const PLAYER_PERMISSION_FOLDERS = [
    ...CLIENT_RANK_FOLDERS.filter(folder => folder.key !== "founder"),
    ...MANAGEMENT_SUBFOLDERS,
    ...DONATOR_SUBFOLDERS,
  ];
  const getFolderCategoryKeys = (folderKey: string): string[] => {
    if (folderKey === "management") return ["management", ...MANAGEMENT_SUBFOLDERS.map(folder => folder.key)];
    if (folderKey === "donator") return ["donator", ...DONATOR_SUBFOLDERS.map(folder => folder.key)];
    return [folderKey];
  };
  const getFolderMods = (folderKey: string) => {
    const keys = getFolderCategoryKeys(folderKey);
    return mods.filter(mod => keys.includes(mod.category_key));
  };
  const isModEnabledForSelectedRank = (mod: ModRecord, rankKey = selectedRank) => {
    if (rankKey === "founder") return true;
    if (mod.mod_id === "w-tap-assistance") return false;
    if (rankKey === "owner") return true;
    return permissions.find(permission => permission.rank_key === rankKey && permission.mod_id === mod.mod_id)?.enabled ?? false;
  };
  const getFolderEnabledCount = (folderKey: string) =>
    getFolderMods(folderKey).filter(isModEnabledForSelectedRank).length;
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
        for (const categoryKey of getFolderCategoryKeys(selectedCategory)) {
          const { error: rpcError } = await supabase.rpc("grant_client_mod_category", {
            p_user_id: selectedPlayer, p_category_key: categoryKey,
            p_expires_at: expiresAt, p_reason: reason.trim() || "Manual access rule via AlphaLauncher Mods",
          });
          if (rpcError) throw rpcError;
        }
      }
      setMessage("Access rule saved.");
      setReason("");
      await load();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };

  const saveModuleAccess = async (modId: string, nextEffect: "allow" | "deny") => {
    if (!selectedPlayer) { setError("Select a player first."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const expiresAt = duration === "permanent" ? null : new Date(Date.now() + Number(duration) * 60 * 60 * 1000).toISOString();
      const { error: rpcError } = await supabase.rpc("set_client_mod_user_override", {
        p_user_id: selectedPlayer,
        p_mod_id: modId,
        p_effect: nextEffect,
        p_expires_at: expiresAt,
        p_reason: reason.trim() || "Manual player module access via AlphaLauncher",
      });
      if (rpcError) throw rpcError;
      setMessage(`${nextEffect === "allow" ? "Access granted" : "Access denied"} for module ${mods.find(mod => mod.mod_id === modId)?.display_name ?? modId}.`);
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
      <div className="section-header"><div><span className="card-label">ALPHACLIENT FOLDERS</span><h3>Rank permission folders</h3></div><button className="small-button" onClick={() => void load()} disabled={loading || busy}>Refresh</button></div>
      <p className="subtitle">Choose a community rank, then use the same folder structure as AlphaClient → StaffMods. Every current client folder is listed, including empty folders, so new modules can be assigned without redesigning this screen.</p>
      <div className="rank-permission-rank-section">
        <div className="rank-folder-editor-heading"><div><span className="card-label">COMMUNITY RANKS</span><h4>Select a rank to configure</h4></div><span className="rank-folder-count">{RANKS.length} ranks</span></div>
        <div className="rank-folder-grid" aria-label="Community ranks">
          {RANKS.map(([key, label]) => {
            const enabledCount = mods.filter(mod => isModEnabledForSelectedRank(mod, key)).length;
            const active = selectedRank === key;
            return <button type="button" key={key} className={`rank-folder-card${active ? " is-selected" : ""}`}
              aria-pressed={active} onClick={() => setSelectedRank(key)}>
              <span className="rank-folder-icon" aria-hidden="true">▰</span>
              <span className="rank-folder-copy"><strong>{label}</strong><small>{enabledCount} / {mods.length} mods enabled</small></span>
              <span className="rank-folder-chevron" aria-hidden="true">›</span>
            </button>;
          })}
        </div>
      </div>
      <div className="rank-client-folders-section">
        <div className="rank-folder-editor-heading"><div><span className="card-label">CLIENT FOLDERS</span><h4>{RANKS.find(([key]) => key === selectedRank)?.[1] ?? selectedRank} · Mod access</h4></div></div>
      <div className="rank-folder-grid" aria-label="AlphaClient rank folders">
        {CLIENT_RANK_FOLDERS.map(folder => {
          const folderMods = getFolderMods(folder.key);
          const countMods = folder.key === "management"
            ? [...getFolderMods("management"), ...getFolderMods("plat_admin"), ...getFolderMods("manager")]
            : folder.key === "donator"
              ? [...getFolderMods("donator"), ...DONATOR_SUBFOLDERS.flatMap(subfolder => getFolderMods(subfolder.key))]
              : folderMods;
          const enabledCount = countMods.filter(isModEnabledForSelectedRank).length;
          const active = selectedRankFolder === folder.key;
          return <button type="button" key={folder.key}
            className={`rank-folder-card${active ? " is-selected" : ""}`}
            aria-pressed={active}
            onClick={() => setSelectedRankFolder(folder.key)}>
            <span className="rank-folder-icon" aria-hidden="true">▰</span>
            <span className="rank-folder-copy"><strong>{folder.label}</strong><small>{enabledCount} / {countMods.length} mods enabled</small></span>
            <span className="rank-folder-chevron" aria-hidden="true">›</span>
          </button>;
        })}
      </div>
      {selectedRankFolder === "donator" && <div className="rank-management-subfolders">
        <div className="rank-folder-editor-heading"><div><span className="card-label">DONATOR</span><h4>Choose a Donator rank</h4></div></div>
        <div className="rank-folder-grid" aria-label="Donator rank subfolders">
          {DONATOR_SUBFOLDERS.map(folder => {
            const folderMods = getFolderMods(folder.key);
            const enabledCount = folderMods.filter(isModEnabledForSelectedRank).length;
            return <button type="button" key={folder.key} className={`rank-folder-card${selectedRankFolder === folder.key ? " is-selected" : ""}`}
              aria-pressed={selectedRankFolder === folder.key} onClick={() => setSelectedRankFolder(folder.key)}>
              <span className="rank-folder-icon" aria-hidden="true">▰</span>
              <span className="rank-folder-copy"><strong>{folder.label}</strong><small>{enabledCount} / {folderMods.length} mods enabled</small></span>
              <span className="rank-folder-chevron" aria-hidden="true">›</span>
            </button>;
          })}
        </div>
      </div>}
      {selectedRankFolder === "management" && <div className="rank-management-subfolders">
        <div className="rank-folder-editor-heading"><div><span className="card-label">MANAGEMENT</span><h4>Choose a subfolder</h4></div></div>
        <div className="rank-folder-grid" aria-label="Management subfolders">
          {MANAGEMENT_SUBFOLDERS.map(folder => {
            const folderMods = getFolderMods(folder.key);
            const enabledCount = folderMods.filter(isModEnabledForSelectedRank).length;
            return <button type="button" key={folder.key} className={`rank-folder-card${selectedRankFolder === folder.key ? " is-selected" : ""}`}
              onClick={() => setSelectedRankFolder(folder.key)}>
              <span className="rank-folder-icon" aria-hidden="true">▰</span>
              <span className="rank-folder-copy"><strong>{folder.label}</strong><small>{enabledCount} / {folderMods.length} mods enabled</small></span>
              <span className="rank-folder-chevron" aria-hidden="true">›</span>
            </button>;
          })}
        </div>
      </div>}
      {(selectedRankFolder === "plat_admin" || selectedRankFolder === "manager") && <button type="button" className="mods-permissions-back" onClick={() => setSelectedRankFolder("management")}><span aria-hidden="true">‹</span> Back to Management</button>}
      {DONATOR_SUBFOLDERS.some(folder => folder.key === selectedRankFolder) && <button type="button" className="mods-permissions-back" onClick={() => setSelectedRankFolder("donator")}><span aria-hidden="true">‹</span> Back to Donator</button>}
      <div className="rank-folder-editor">
        <div className="rank-folder-editor-heading">
          <div><span className="card-label">{selectedRankFolder === "plat_admin" || selectedRankFolder === "manager" ? "MANAGEMENT SUBFOLDER" : DONATOR_SUBFOLDERS.some(folder => folder.key === selectedRankFolder) ? "DONATOR SUBFOLDER" : "CLIENT FOLDER"}</span>
            <h4>{[...CLIENT_RANK_FOLDERS, ...MANAGEMENT_SUBFOLDERS, ...DONATOR_SUBFOLDERS].find(folder => folder.key === selectedRankFolder)?.label ?? selectedRankFolder}</h4>
          </div>
          <span className="rank-folder-count">{getFolderEnabledCount(selectedRankFolder)} / {getFolderMods(selectedRankFolder).length} enabled</span>
        </div>
        {selectedRank === "founder" && <p className="subtitle">Founder access is always enabled and cannot be disabled.</p>}
        {selectedRank === "owner" && <p className="subtitle">Owner always has access to every non-Founder mod. Founder-only modules remain exclusive.</p>}
        {selectedRankFolder === "management" && <p className="subtitle">Management contains the Platform Admin and Manager subfolders, matching the client menu.</p>}
        {selectedRankFolder === "donator" && <p className="subtitle">Donator contains the Scout, Rogue, Elite, Alpha, and Alpha+ subfolders.</p>}
        {loading ? <p className="subtitle">Loading mod permissions…</p> : selectedRankFolder === "management"
          ? <div className="rank-folder-empty"><span className="rank-folder-icon" aria-hidden="true">▰</span><strong>Choose a management subfolder.</strong><small>Open Platform Admin or Manager above to configure its mods.</small></div>
          : selectedRankFolder === "donator"
            ? <div className="rank-folder-empty"><span className="rank-folder-icon" aria-hidden="true">▰</span><strong>Choose a Donator rank.</strong><small>Open Scout, Rogue, Elite, Alpha, or Alpha+ above to configure its mods.</small></div>
          : getFolderMods(selectedRankFolder).length === 0
            ? <div className="rank-folder-empty"><span className="rank-folder-icon" aria-hidden="true">▱</span><strong>This folder is currently empty.</strong><small>When a mod is added to this AlphaClient folder and its catalog entry is registered, it will appear here automatically.</small></div>
            : <div className="rank-mod-rows">
            {getFolderMods(selectedRankFolder).map(mod => {
              const founderOnly = mod.mod_id === "w-tap-assistance";
              const lockedForRank = founderOnly && selectedRank !== "founder";
              const enabled = isModEnabledForSelectedRank(mod);
              return <div className={`rank-mod-row${enabled ? " is-enabled" : ""}`} key={mod.mod_id}>
                <span className="rank-mod-copy"><strong>{mod.display_name}{founderOnly ? " · Founder only" : ""}</strong><small>{mod.description} · {mod.mod_id}</small></span>
                <button type="button" className="mods-permission-switch" role="switch"
                  aria-label={`${mod.display_name} permission`} aria-checked={enabled}
                  disabled={selectedRank === "founder" || selectedRank === "owner" || lockedForRank}
                  onClick={() => setPermissions(old => {
                    const current = old.find(permission => permission.rank_key === selectedRank && permission.mod_id === mod.mod_id)?.enabled ?? false;
                    const rest = old.filter(permission => !(permission.rank_key === selectedRank && permission.mod_id === mod.mod_id));
                    return [...rest, { rank_key: selectedRank, mod_id: mod.mod_id, enabled: !current }];
                  })}><span /></button>
              </div>;
            })}
          </div>}
        <button className="large-play-button developer-start-button" onClick={() => void saveRankDefaults()} disabled={busy || loading || selectedRank === "founder" || selectedRank === "owner"}>
          {busy ? "SAVING…" : `SAVE ${(RANKS.find(([key]) => key === selectedRank)?.[1] ?? selectedRank).toUpperCase()} PERMISSIONS`}
        </button>
      </div>
      </div>
    </section>}

    {activeTab === "player" && <section className="section-card developer-card">
      <div className="section-header">
        <div><span className="card-label">PLAYER ACCESS</span><h3>Player Permission</h3><p className="subtitle">Select a player, choose a client folder, and grant access to the whole folder or individual modules.</p></div>
        <button className="small-button" onClick={() => void load(search)} disabled={loading || busy}>Refresh</button>
      </div>

      <div className="rank-folder-editor">
        <div className="rank-folder-editor-heading"><div><span className="card-label">ALPHA ACCOUNTS</span><h4>Select a player</h4></div><span className="rank-folder-count">{players.length} players</span></div>
        <div className="client-mod-search-row">
          <input className="developer-text-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username or display name"/>
          <button className="small-button" onClick={() => void load(search)} disabled={loading || busy}>Search</button>
        </div>
        <select className="developer-text-input player-permission-player-select" value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)} aria-label="Select player">
          <option value="">Select player…</option>{players.map(p => <option key={p.user_id} value={p.user_id}>{p.display_name || p.username} (@{p.username}) — {p.rank_key}</option>)}
        </select>
        {chosenPlayer && <p className="subtitle">Selected player: <strong>{chosenPlayer.display_name || chosenPlayer.username}</strong> · Rank: {chosenPlayer.rank_key}. These rules change this player's access without changing their rank.</p>}
      </div>

      <div className="rank-client-folders-section">
        <div className="rank-folder-editor-heading"><div><span className="card-label">CLIENT FOLDERS</span><h4>Choose a folder</h4></div><span className="rank-folder-count">{PLAYER_PERMISSION_FOLDERS.length} folders</span></div>
        <div className="rank-folder-grid" aria-label="Client folders for player access">
          {PLAYER_PERMISSION_FOLDERS.map(folder => {
            const folderMods = getFolderMods(folder.key);
            const active = selectedCategory === folder.key;
            const grantedCount = folderMods.filter(mod => overrides.some(rule => rule.user_id === selectedPlayer && rule.mod_id === mod.mod_id && rule.effect === "allow" && (!rule.expires_at || new Date(rule.expires_at).getTime() > Date.now()))).length;
            return <button type="button" key={folder.key} className={`rank-folder-card${active ? " is-selected" : ""}`} aria-pressed={active} onClick={() => setSelectedCategory(folder.key)}>
              <span className="rank-folder-icon" aria-hidden="true">▰</span>
              <span className="rank-folder-copy"><strong>{folder.label}</strong><small>{folderMods.length} modules · {grantedCount} individual grants</small></span>
              <span className="rank-folder-chevron" aria-hidden="true">›</span>
            </button>;
          })}
        </div>
      </div>

      <div className="rank-folder-editor">
        <div className="rank-folder-editor-heading">
          <div><span className="card-label">ACCESS SETTINGS</span><h4>Duration and reason</h4></div>
        </div>
        <div className="client-mod-grant-grid">
          <div><label className="developer-input-label">Duration for new rules</label><select className="developer-text-input" value={duration} onChange={e => setDuration(e.target.value)}><option value="permanent">Permanent</option><option value="1">1 hour</option><option value="24">24 hours</option><option value="168">7 days</option><option value="720">30 days</option></select></div>
          <div><label className="developer-input-label">Reason (optional)</label><input className="developer-text-input" value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="Reason for this access rule"/></div>
        </div>
        <button className="large-play-button developer-start-button" onClick={() => { setSelectedMod(""); setEffect("allow"); void saveGrant(); }} disabled={busy || loading || !selectedPlayer || !getFolderMods(selectedCategory).length}>
          {busy ? "SAVING…" : `GRANT ENTIRE ${PLAYER_PERMISSION_FOLDERS.find(folder => folder.key === selectedCategory)?.label.toUpperCase() ?? "FOLDER"} FOLDER`}
        </button>
        <p className="subtitle">The folder grant applies to every module in this category. Use the module controls below to add a specific allow or deny override.</p>
      </div>

      <div className="rank-folder-editor">
        <div className="rank-folder-editor-heading">
          <div><span className="card-label">INDIVIDUAL MODULES</span><h4>{PLAYER_PERMISSION_FOLDERS.find(folder => folder.key === selectedCategory)?.label ?? selectedCategory} · Module access</h4></div>
          <span className="rank-folder-count">{getFolderMods(selectedCategory).length} modules</span>
        </div>
        {!selectedPlayer
          ? <div className="rank-folder-empty"><span className="rank-folder-icon" aria-hidden="true">♙</span><strong>Select a player first.</strong><small>Choose an Alpha account above to configure folder and module access.</small></div>
          : loading
            ? <p className="subtitle">Loading player permissions…</p>
            : getFolderMods(selectedCategory).length === 0
              ? <div className="rank-folder-empty"><span className="rank-folder-icon" aria-hidden="true">▱</span><strong>This folder is currently empty.</strong><small>Modules registered under this category will appear here.</small></div>
              : <div className="rank-mod-rows">
                {getFolderMods(selectedCategory).map(mod => {
                  const activeOverride = overrides.find(rule => rule.user_id === selectedPlayer && rule.mod_id === mod.mod_id && (!rule.expires_at || new Date(rule.expires_at).getTime() > Date.now()));
                  const status = activeOverride ? (activeOverride.effect === "allow" ? "Individual allow rule" : "Individual deny rule") : "Uses folder and rank permissions";
                  return <div className="rank-mod-row" key={mod.mod_id}>
                    <span className="rank-mod-copy"><strong>{mod.display_name}</strong><small>{mod.description || mod.mod_id} · {status}{activeOverride?.expires_at ? " · Expires " + new Date(activeOverride.expires_at).toLocaleString() : activeOverride ? " · Permanent" : ""}</small></span>
                    <div className="player-module-actions">
                      <button type="button" className="small-button" disabled={busy} onClick={() => void saveModuleAccess(mod.mod_id, "allow")}>Allow</button>
                      <button type="button" className="small-button" disabled={busy} onClick={() => void saveModuleAccess(mod.mod_id, "deny")}>Deny</button>
                    </div>
                  </div>;
                })}
              </div>}
      </div>
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
