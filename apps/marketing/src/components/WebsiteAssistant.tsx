import { FormEvent, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';

type ChatMessage = { role: 'assistant' | 'user'; text: string };
type Language = 'en' | 'sw';
const API_BASE = (import.meta.env.VITE_ARA_API_URL || 'https://ara-api-c525.onrender.com').replace(/\/$/, '');
const copy = {
  en: { subtitle: 'Website guide · English', greeting: 'Hi! I’m the ARA Website Assistant. Ask me about the platform, supported channels, company workspaces or getting started.', placeholder: 'Ask about ARA…', note: "Please don't share passwords, API keys or private customer information.", thinking: 'Thinking…' },
  sw: { subtitle: 'Mwongozo wa tovuti · Kiswahili', greeting: 'Habari! Mimi ni Msaidizi wa Tovuti wa ARA. Niulize kuhusu mfumo, njia za mawasiliano, akaunti za kampuni au jinsi ya kuanza.', placeholder: 'Uliza kuhusu ARA…', note: 'Usishiriki nywila, funguo za API au taarifa binafsi za wateja.', thinking: 'Ninafikiria…' },
};

export default function WebsiteAssistant() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<Language | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const text = language ? copy[language] : copy.en;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy, open]);
  function chooseLanguage(next: Language) { setLanguage(next); setMessages([{ role: 'assistant', text: copy[next].greeting }]); }
  async function send(event: FormEvent) {
    event.preventDefault(); const message = draft.trim(); if (!message || busy || !language) return;
    setDraft(''); setMessages((items) => [...items, { role: 'user', text: message }]); setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/public/assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, language }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'The assistant could not respond just now.');
      setMessages((items) => [...items, { role: 'assistant', text: data.answer || 'I could not prepare an answer. Please try again.' }]);
    } catch (error) { setMessages((items) => [...items, { role: 'assistant', text: error instanceof Error ? error.message : 'The assistant is temporarily unavailable.' }]); }
    finally { setBusy(false); }
  }
  return <div className="website-assistant">
    {open && <section className="website-assistant-panel" aria-label="ARA website assistant">
      <header className="website-assistant-header"><span className="website-assistant-avatar"><Sparkles size={18} /></span><span><strong>ARA Assistant</strong><small>{language ? text.subtitle : 'Select a language · Chagua lugha'}</small></span><button type="button" aria-label="Close assistant" onClick={() => setOpen(false)}><X size={18} /></button></header>
      {!language ? <div className="website-assistant-language"><strong>Choose your language</strong><p>Chagua lugha yako ili kuendelea</p><button type="button" onClick={() => chooseLanguage('en')}>English</button><button type="button" onClick={() => chooseLanguage('sw')}>Kiswahili</button></div> : <>
        <div className="website-assistant-messages" aria-live="polite">{messages.map((item, index) => <div key={index} className={`website-assistant-message ${item.role}`}>{item.text}</div>)}{busy && <div className="website-assistant-message assistant typing">{text.thinking}</div>}<div ref={endRef} /></div>
        <form className="website-assistant-form" onSubmit={send}><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1200} placeholder={text.placeholder} aria-label={text.placeholder} /><button type="submit" disabled={busy || draft.trim().length < 2} aria-label="Send message"><Send size={17} /></button></form>
        <p className="website-assistant-note">{text.note}</p><button type="button" className="website-assistant-change-language" onClick={() => { setLanguage(null); setMessages([]); setDraft(''); }}>Change language · Badili lugha</button>
      </>}</section>}
    <button type="button" className="website-assistant-launcher" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'Close ARA assistant' : 'Chat with ARA'}>{open ? <X size={21} /> : <><MessageCircle size={20} /><span>Ask ARA</span></>}</button>
  </div>;
}
