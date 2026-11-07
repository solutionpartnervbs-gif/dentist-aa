import { useEffect, useRef, useState } from 'react';
import { QUICK_CHIPS } from '../config/clinic';
import { useAssistant } from '../hooks/useAssistant';
import { useChat } from '../hooks/useChat';

/** Plain text chat with Milky. Messages go to the receptionist API; nothing is spoken aloud. */
export function ChatPanel({ embedded = false }: { embedded?: boolean }) {
  const { messages, busy, send, clear } = useChat('local');
  const { setActivity, findMilky } = useAssistant();
  const [draft, setDraft] = useState('');
  const log = useRef<HTMLDivElement>(null);

  // Milky mirrors what the assistant is doing.
  useEffect(() => {
    setActivity(busy ? 'thinking' : 'idle');
    return () => setActivity('idle');
  }, [busy, setActivity]);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const submit = async (text: string) => {
    const res = await send(text);
    if (res?.client?.findMilky) findMilky(); // "Where is Milky?" -> Milky waves
  };

  return (
    <div className={`assistant ${embedded ? 'assistant--embedded' : ''}`}>
      <div ref={log} className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <span className="bubble">
              {m.text}
              {m.receiptUrl && (
                <a className="receipt-link" href={m.receiptUrl} target="_blank" rel="noopener noreferrer">
                  View proof of appointment
                </a>
              )}
            </span>
          </div>
        ))}
        {busy && (
          <div className="msg bot" aria-hidden>
            <span className="bubble typing"><i /><i /><i /></span>
          </div>
        )}
      </div>

      <div className="chips" aria-label="Quick questions">
        {QUICK_CHIPS.map((c) => (
          <button key={c} className="chip" disabled={busy} onClick={() => void submit(c)}>
            {c}
          </button>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft;
          setDraft('');
          void submit(t);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">Message Milky</label>
        <input id="chat-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message…" autoComplete="off" maxLength={500} />
        <div className="composer-actions">
          <button className="btn btn-primary composer-send" disabled={busy || !draft.trim()}>Send</button>
          <button type="button" className="link-btn small" onClick={clear}>Clear chat</button>
        </div>
      </form>
    </div>
  );
}
