import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type InspectorMode = "rank" | "verification" | "module" | "permission";

type AccountSummary = {
  username: string;
  display_name: string | null;
  primary_rank: string;
  ranks: string[];
  is_founder: boolean;
  verification: {
    verified: boolean;
    verified_at: string | null;
    verified_by: string | null;
    updated_at: string | null;
  };
};

type PermissionEntry = {
  permission_key: string;
  display_name: string;
  category: string;
  description: string;
  configured: boolean;
  allowed: boolean;
  source: string;
  rank_keys?: string[];
};

const MODE_CONTENT: Record<InspectorMode, { title: string; description: string; eyebrow: string }> = {
  rank: {
    title: "Rank Inspector",
    description: "Select an Alpha account to inspect its primary rank and assigned ranks.",
    eyebrow: "ACCOUNT RANKS",
  },
  verification: {
    title: "Verification",
    description: "Select another Alpha account to inspect and manage its verification status.",
    eyebrow: "ACCOUNT VERIFICATION",
  },
  module: {
    title: "Module Inspector",
    description: "Inspect module access for the selected account and see which rule grants or blocks each module.",
    eyebrow: "MODULE ACCESS",
  },
  permission: {
    title: "Permission Inspector",
    description: "Inspect the selected account's effective permissions and the source of each permission.",
    eyebrow: "ACCOUNT PERMISSIONS",
  },
};

const RANK_LABELS: Record<string, string> = {
  founder: "Founder",
  owner: "Owner",
  manager: "Manager",
  developer: "Developer",
  plat_admin: "Platform Admin",
  senior_admin: "Sr Admin",
  admin: "Admin",
  senior_moderator: "Sr Mod",
  moderator: "Moderator",
  trial_moderator: "Trial Moderator",
  donator: "Donator",
  beta: "BETA",
  alpha_plus: "Alpha+",
  alpha: "Alpha",
  elite: "Elite",
  rogue: "Rogue",
  scout: "Scout",
  the_nibbler: "The Nibbler",
  media: "Media",
  famous: "Famous",
  partner: "Partner",
  member: "Member",
};

function describeSource(source: string, rankKeys?: string[]) {
  if (source === "rank" && rankKeys?.length) {
    return `Rank permission · ${rankKeys.map(key => RANK_LABELS[key] ?? key).join(", ")}`;
  }
  const labels: Record<string, string> = {
    founder: "Founder default",
    account: "Account override",
    category: "Category grant",
    rank: "Rank permission",
    default: "Default",
    disabled: "Module disabled",
    catalog: "Permission catalog",
  };
  return labels[source] ?? source;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

export default function DeveloperAccountTools({ mode }: { mode: InspectorMode }) {
  const content = MODE_CONTENT[mode];
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [savingVerification, setSavingVerification] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const invokeFounderAction = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error: invokeError } = await supabase.functions.invoke("manage-client-permissions", {
      body: { action, ...payload },
    });
    if (invokeError) throw invokeError;
    if (!data || data.error) throw new Error(data?.error ?? "The account service returned an empty response.");
    return data;
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    setError("");
    try {
      const data = await invokeFounderAction("list_accounts");
      const usernames = Array.isArray(data.accounts)
        ? data.accounts.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      setAccounts(usernames);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoadingAccounts(false);
    }
  }, [invokeFounderAction]);

  const inspectAccount = useCallback(async (username: string) => {
    setSelectedUsername(username);
    setLoadingAccount(true);
    setError("");
    setMessage("");
    setAccount(null);
    setPermissions([]);
    try {
      const requests: Promise<any>[] = [invokeFounderAction("inspect_account", { username })];
      if (mode === "module" || mode === "permission") {
        requests.push(invokeFounderAction("list", { target: "account", username }));
      }
      const results = await Promise.all(requests);
      setAccount(results[0].account as AccountSummary);
      if (results[1]) setPermissions((results[1].permissions ?? []) as PermissionEntry[]);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoadingAccount(false);
    }
  }, [invokeFounderAction, mode]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const setVerified = async (verified: boolean) => {
    if (!selectedUsername || !account) return;
    setSavingVerification(true);
    setError("");
    setMessage("");
    try {
      await invokeFounderAction("set_verification", { username: selectedUsername, verified });
      await inspectAccount(selectedUsername);
      setMessage(verified ? `${selectedUsername} is now verified.` : `Verification removed for ${selectedUsername}.`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingVerification(false);
    }
  };

  const visiblePermissions = mode === "module"
    ? permissions.filter(item => item.permission_key.startsWith("mod."))
    : permissions;

  return (
    <section className="section-card developer-card developer-account-tools">
      <div className="section-header">
        <div>
          <span className="card-label">{content.eyebrow}</span>
          <h3>{content.title}</h3>
          <p className="subtitle">{content.description}</p>
        </div>
        <button type="button" className="small-button" onClick={() => void loadAccounts()} disabled={loadingAccounts || loadingAccount}>
          {loadingAccounts ? "Loading…" : "Refresh accounts"}
        </button>
      </div>

      {error && <p className="launch-error" role="alert">{error}</p>}
      {message && <p className="launch-success" role="status">{message}</p>}

      <div className="developer-account-inspector-layout">
        <aside className="developer-account-list" aria-label="Alpha accounts">
          <div className="rank-folder-editor-heading">
            <div><span className="card-label">ALPHA ACCOUNTS</span><h4>Select an account</h4></div>
            <span className="rank-folder-count">{accounts.length}</span>
          </div>
          {loadingAccounts ? (
            <p className="subtitle">Loading accounts…</p>
          ) : accounts.length === 0 ? (
            <p className="subtitle">No Alpha accounts were returned.</p>
          ) : (
            <div className="developer-account-list-items">
              {accounts.map(username => (
                <button
                  type="button"
                  key={username}
                  className={`developer-account-list-item${selectedUsername === username ? " is-selected" : ""}`}
                  onClick={() => void inspectAccount(username)}
                  disabled={loadingAccount}
                  aria-pressed={selectedUsername === username}
                >
                  <span className="developer-account-avatar" aria-hidden="true">{username.charAt(0).toUpperCase()}</span>
                  <span><strong>{username}</strong><small>{selectedUsername === username ? "Selected account" : "Inspect account"}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          )}
          <p className="subtitle">Account data is requested from the server and is available only to the authenticated Founder.</p>
        </aside>

        <div className="developer-account-inspector-detail" aria-live="polite">
          {loadingAccount ? (
            <p className="subtitle">Loading account details…</p>
          ) : !account ? (
            <div className="developer-account-empty">
              <span className="card-label">NO ACCOUNT SELECTED</span>
              <p>Select an account from the list to inspect its details.</p>
            </div>
          ) : (
            <>
              <div className="section-header">
                <div>
                  <span className="card-label">SELECTED ALPHA ACCOUNT</span>
                  <h3>{account.username}</h3>
                  {account.display_name && <p className="subtitle">{account.display_name}</p>}
                </div>
                <span className={`developer-status ${mode === "verification" && account.verification.verified ? "active" : ""}`}>
                  {mode === "verification" ? (account.verification.verified ? "Verified" : "Not verified") : (RANK_LABELS[account.primary_rank] ?? account.primary_rank)}
                </span>
              </div>

              {(mode === "rank" || mode === "verification") && (
                <div className="developer-info-grid">
                  <div><span>Primary rank</span><strong>{RANK_LABELS[account.primary_rank] ?? account.primary_rank}</strong></div>
                  <div><span>Founder account</span><strong>{account.is_founder ? "Yes" : "No"}</strong></div>
                  <div><span>Verification</span><strong>{account.verification.verified ? "Verified" : "Not verified"}</strong></div>
                  <div><span>Assigned ranks</span><strong>{account.ranks.map(key => RANK_LABELS[key] ?? key).join(", ") || "None"}</strong></div>
                </div>
              )}

              {mode === "verification" && (
                <div className="developer-verification-actions">
                  <p className="subtitle">
                    {account.verification.verified
                      ? `Verified on ${account.verification.verified_at ? new Date(account.verification.verified_at).toLocaleString() : "a previous date"}.`
                      : "This account has not been verified yet."}
                  </p>
                  <button type="button" className="large-play-button developer-start-button" onClick={() => void setVerified(!account.verification.verified)} disabled={savingVerification || loadingAccount}>
                    {savingVerification ? "SAVING…" : account.verification.verified ? "REMOVE VERIFICATION" : "VERIFY ACCOUNT"}
                  </button>
                </div>
              )}

              {(mode === "module" || mode === "permission") && (
                <div className="developer-inspected-permissions">
                  <div className="rank-folder-editor-heading">
                    <div><span className="card-label">{mode === "module" ? "MODULE ACCESS" : "EFFECTIVE PERMISSIONS"}</span><h4>{mode === "module" ? "Modules for this account" : "Permissions for this account"}</h4></div>
                    <span className="rank-folder-count">{visiblePermissions.length}</span>
                  </div>
                  {visiblePermissions.length === 0 ? (
                    <p className="subtitle">No matching permissions were returned for this account.</p>
                  ) : (
                    <div className="developer-inspected-permission-list">
                      {visiblePermissions.map(item => (
                        <article className="developer-inspected-permission-row" key={item.permission_key}>
                          <span className={`developer-permission-state ${item.allowed ? "is-allowed" : "is-denied"}`} aria-label={item.allowed ? "Allowed" : "Denied"}>
                            {item.allowed ? "ALLOWED" : "DENIED"}
                          </span>
                          <div className="developer-inspected-permission-copy">
                            <strong>{item.display_name || item.permission_key}</strong>
                            <small>{item.description}</small>
                            <span>Source: {describeSource(item.source, item.rank_keys)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
