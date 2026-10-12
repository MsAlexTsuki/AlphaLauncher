import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";

type ChatFriend = { id: string; username: string; display_name?: string; is_founder?: boolean; rank_key?: string | null; avatar_url?: string | null };
type PrivateMessage = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string };
type Props = { userId: string; friends: ChatFriend[]; selectedFriendId: string | null; onSelectFriend: (friendId: string) => void };

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function PrivateChatPanel({ userId, friends, selectedFriendId, onSelectFriend }: Props) {
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const selectedFriend = friends.find(friend => friend.id === selectedFriendId) ?? null;

  useEffect(() => {
    if (!selectedFriendId || !friends.some(friend => friend.id === selectedFriendId)) {
      setMessages([]);
      return;
    }
    let active = true;
    const loadMessages = async () => {
      setLoadingMessages(true);
      setError("");
      const { data, error: loadError } = await supabase.from("private_messages")
        .select("id, sender_id, recipient_id, body, created_at")
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${selectedFriendId}),and(sender_id.eq.${selectedFriendId},recipient_id.eq.${userId})`)
        .order("created_at", { ascending: true }).limit(300);
      if (!active) return;
      if (loadError) {
        setError(loadError.message.includes("private_messages") ? "Private chat is not ready yet. Apply the private chat database migration in Supabase." : loadError.message);
        setMessages([]);
      } else setMessages((data ?? []) as PrivateMessage[]);
      setLoadingMessages(false);
    };
    void loadMessages();
    const channel = supabase.channel(`private-chat-${userId}-${selectedFriendId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_messages" }, payload => {
        const row = payload.new as PrivateMessage;
        if ((row.sender_id === userId && row.recipient_id === selectedFriendId) || (row.sender_id === selectedFriendId && row.recipient_id === userId)) void loadMessages();
      }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [userId, selectedFriendId, friends]);

  useEffect(() => { const list = messageListRef.current; if (list) list.scrollTop = list.scrollHeight; }, [messages, loadingMessages]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selectedFriend || sending) return;
    setSending(true); setError("");
    const { data, error: sendError } = await supabase.from("private_messages")
      .insert({ sender_id: userId, recipient_id: selectedFriend.id, body })
      .select("id, sender_id, recipient_id, body, created_at").single();
    if (sendError) setError(sendError.message.includes("private_messages") ? "Private chat is not ready yet. Apply the private chat database migration in Supabase." : sendError.message);
    else if (data) { setMessages(current => current.some(message => message.id === data.id) ? current : [...current, data as PrivateMessage]); setDraft(""); }
    setSending(false);
  };

  return <section className="section-card private-chat-card" aria-label="Private chat">
    <div className="friends-section-heading private-chat-heading"><div><h2>Private chat</h2><p>Private conversations with your friends.</p></div><span className="private-chat-lock">● PRIVATE</span></div>
    <div className="private-chat-layout">
      <aside className="private-chat-contacts" aria-label="Chat contacts">
        <div className="private-chat-subheading">MESSAGES <span>{friends.length}</span></div>
        {friends.length === 0 ? <div className="private-chat-no-contacts">Add friends to start a private conversation.</div> : friends.map(friend =>
          <button type="button" className={`private-chat-contact${selectedFriendId === friend.id ? " is-active" : ""}`} key={friend.id} onClick={() => onSelectFriend(friend.id)} aria-pressed={selectedFriendId === friend.id}>
            <span className="private-chat-avatar">{friend.avatar_url ? <img src={friend.avatar_url} alt="" /> : friend.username.slice(0,1).toUpperCase()}<i /></span>
            <span className="private-chat-contact-copy"><strong>{friend.username}</strong><small>{friend.is_founder ? "FOUNDER" : "Alpha friend"}</small></span><span className="private-chat-contact-arrow">›</span>
          </button>)}
      </aside>
      <div className="private-chat-conversation">
        {selectedFriend ? <>
          <header className="private-chat-conversation-header"><span className="private-chat-avatar large">{selectedFriend.avatar_url ? <img src={selectedFriend.avatar_url} alt="" /> : selectedFriend.username.slice(0,1).toUpperCase()}<i /></span><div><strong>{selectedFriend.username}</strong><small>Private conversation</small></div><span className="private-chat-secure-label">● FRIENDS</span></header>
          <div className="private-chat-messages" ref={messageListRef} aria-live="polite">
            {loadingMessages ? <div className="private-chat-placeholder">Loading conversation…</div> : messages.length === 0 ? <div className="private-chat-welcome"><span>✦</span><strong>Start the conversation</strong><p>Send a message to {selectedFriend.username}.</p></div> : messages.map(message => {
              const mine = message.sender_id === userId;
              return <div className={`private-chat-message-row${mine ? " is-mine" : ""}`} key={message.id}><div className="private-chat-message"><p>{message.body}</p><time dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time></div></div>;
            })}
          </div>
          {error && <div className="private-chat-error" role="alert">{error}</div>}
          <form className="private-chat-composer" onSubmit={sendMessage}><input value={draft} onChange={event => setDraft(event.target.value.slice(0,2000))} placeholder={`Message @${selectedFriend.username}…`} maxLength={2000} aria-label="Message text" /><button type="submit" disabled={!draft.trim() || sending} aria-label="Send message">{sending ? "…" : "➤"}</button></form>
          <div className="private-chat-footnote">Messages are visible only to the two participants.</div>
        </> : <div className="private-chat-empty-conversation"><span className="private-chat-empty-icon">✉</span><strong>Your private space</strong><p>Select a friend to open your conversation. Your friends list on the right stays visible.</p></div>}
      </div>
    </div>
  </section>;
}
