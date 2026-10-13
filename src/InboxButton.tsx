import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";

type InboxRequest = {
  id: string;
  sender_id: string;
  created_at: string;
  profile: {
    username: string;
    display_name: string;
    avatar_url?: string | null;
  } | null;
};

type InboxButtonProps = {
  onOpenFriends: () => void;
};

export default function InboxButton({ onOpenFriends }: InboxButtonProps) {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadRequests = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setSignedIn(false);
      setRequests([]);
      setLoadError(false);
      return;
    }

    setSignedIn(true);
    const { data, error } = await supabase
      .from("friend_requests")
      .select("id, sender_id, created_at")
      .eq("recipient_id", authData.user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      console.warn("Could not load inbox friend requests:", error);
      setLoadError(true);
      return;
    }

    const rows = (data ?? []) as Array<{ id: string; sender_id: string; created_at: string }>;
    if (rows.length === 0) {
      setRequests([]);
      setLoadError(false);
      return;
    }

    const senderIds = [...new Set(rows.map((row) => row.sender_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", senderIds);

    if (profilesError) {
      console.warn("Could not load inbox sender profiles:", profilesError);
      setLoadError(true);
      return;
    }

    const profileMap = new Map(
      (profiles ?? []).map((profile: { id: string; username: string; display_name: string; avatar_url?: string | null }) => [
        profile.id,
        profile,
      ]),
    );
    setRequests(rows.map((row) => ({ ...row, profile: profileMap.get(row.sender_id) ?? null })));
    setLoadError(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadRequests().finally(() => setLoading(false));

    const channel = supabase
      .channel("launcher-inbox-friend-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => {
        void loadRequests();
      })
      .subscribe();

    const handleFocus = () => { void loadRequests(); };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      void supabase.removeChannel(channel);
    };
  }, [loadRequests]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
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

  const unreadCount = requests.length;

  return (
    <div className="titlebar-inbox" ref={rootRef}>
      <button
        type="button"
        className={`titlebar-icon-button inbox-trigger${open ? " is-open" : ""}`}
        aria-label={unreadCount ? `Inbox, ${unreadCount} pending friend request${unreadCount === 1 ? "" : "s"}` : "Inbox"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Inbox"
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 4.75h16a1.25 1.25 0 0 1 1.25 1.25v12A1.25 1.25 0 0 1 20 19.25H4A1.25 1.25 0 0 1 2.75 18V6A1.25 1.25 0 0 1 4 4.75Z" />
          <path d="M3 13.25h5.1l1.4 2h5l1.4-2H21" />
        </svg>
        {unreadCount > 0 && <span className="inbox-unread-dot" aria-label={`${unreadCount} pending`} />}
      </button>

      {open && (
        <section className="inbox-popover" role="dialog" aria-label="Inbox notifications">
          <div className="inbox-popover-header">
            <div>
<strong>Notificaties</strong>
            </div>
            {unreadCount > 0 && <span className="inbox-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </div>

          {!signedIn ? (
            <div className="inbox-empty">
              <span className="inbox-empty-icon">♧</span>
<p>Meldingen verschijnen hier wanneer je er een ontvangt.</p>
            </div>
          ) : loading ? (
            <div className="inbox-status">Loading notifications…</div>
          ) : loadError ? (
            <div className="inbox-status">Could not load notifications. Try again in a moment.</div>
          ) : requests.length === 0 ? (
            <div className="inbox-empty">
              <span className="inbox-empty-icon">✓</span>
<p>You currently have no notifications.</p>
            </div>
          ) : (
            <div className="inbox-request-list">
              {requests.map((request) => {
                const name = request.profile?.display_name || request.profile?.username || "Community member";
                return (
                  <button
                    type="button"
                    className="inbox-request"
                    key={request.id}
                    onClick={() => { setOpen(false); onOpenFriends(); }}
                  >
                    {request.profile?.avatar_url ? (
                      <img src={request.profile.avatar_url} alt="" />
                    ) : (
                      <span className="inbox-request-avatar">{name.slice(0, 1).toUpperCase()}</span>
                    )}
                    <span className="inbox-request-copy">
                      <strong>{name}</strong>
<span>Heeft je een vriendschapsverzoek gestuurd</span>
                    </span>
                    <span className="inbox-request-arrow" aria-hidden="true">›</span>
                  </button>
                );
              })}
            </div>
          )}

        </section>
      )}
    </div>
  );
}
