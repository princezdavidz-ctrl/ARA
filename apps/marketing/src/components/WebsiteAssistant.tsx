import { FormEvent, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';

type ChatMessage = { role: 'assistant' | 'user'; text: string };

const API_BASE = (import.meta.env.VITE_ARA_API_URL || 'https://ara-api-c525.onrender.com').replace(/\/$/, '');

export default function WebsiteAssistant() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Hi! I’m the ARA Website Assistant. Ask me about the platform, supported channels, company workspaces or getting started.' },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy, open]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setDraft('');
    setMessages((items) => [...items, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/public/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'The assistant could not respond just now.');
      setMessages((items) => [...items, { role: 'assistant', text: data.answer || 'I could not prepare an answer. Please try again.' }]);
    } catch (error) {
      setMessages((items) => [...items, { role: 'assistant', text: error instanceof Error ? error.message : 'The assistant is temporarily unavailable.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="website-assistant">
      {open && (
        <section className="website-assistant-panel" aria-label="ARA website assistant">
          <header className="website-assistant-header">
            <span className="website-assistant-avatar"><Sparkles size={18} /></span>
            <span><strong>ARA Assistant</strong><small>Website guide · English & Kiswahili</small></span>
            <button type="button" aria-label="Close assistant" onClick={() => setOpen(false)}><X size={18} /></button>
          </header>
          <div className="website-assistant-messages" aria-live="polite">
            {messages.map((item, index) => <div key={index} className={`website-assistant-message ${item.role}`}>{item.text}</div>)}
            {busy && <div className="website-assistant-message assistant typing">Thinking…</div>}
            <div ref={endRef} />
          </div>
          <form className="website-assistant-form" onSubmit={send}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1200} placeholder="Ask about ARA…" aria-label="Your message" />
            <button type="submit" disabled={busy || draft.trim().length < 2} aria-label="Send message"><Send size={17} /></button>
          </form>
          <p className="website-assistant-note">Please don't share passwords, API keys or private customer information.</p>
        </section>
      )}
      <button type="button" className="website-assistant-launcher" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'Close ARA assistant' : 'Chat with ARA'}>
        {open ? <X size={21} /> : <><MessageCircle size={20} /><span>Ask ARA</span></>}
      </button>
    </div>
  );
}
