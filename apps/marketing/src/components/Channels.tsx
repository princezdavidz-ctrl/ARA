import { MessageCircle, Mail, Instagram, Music2 } from 'lucide-react';

const channels = [
  {
    name: 'WhatsApp',
    desc: 'Cloud API replies with delivery tracking and customer-service window handling.',
    icon: MessageCircle,
    tint: 'from-emerald-400 to-green-600',
    badge: 'Most popular',
  },
  {
    name: 'Email',
    desc: 'Signed inbound relay plus Resend outbound. Every reply grounded in your knowledge base.',
    icon: Mail,
    tint: 'from-sky-400 to-blue-600',
  },
  {
    name: 'Instagram',
    desc: 'Direct messages through the Meta Messaging API, with attachments escalated to humans.',
    icon: Instagram,
    tint: 'from-fuchsia-400 to-pink-600',
  },
  {
    name: 'TikTok',
    desc: 'Business messaging with normalized webhooks and per-tenant encrypted credentials.',
    icon: Music2,
    tint: 'from-rose-400 to-red-600',
  },
];

export default function Channels() {
  return (
    <section id="channels" className="relative py-24 lg:py-32">
      <div className="container-px">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">
            One inbox, every channel
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Unify your customer conversations
          </h2>
          <p className="mt-4 text-lg text-ink-300">
            ARA connects the messaging apps your customers already use, routes each message to the
            right tenant, and replies with the same grounded knowledge everywhere.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((c) => (
            <div
              key={c.name}
              className="card-glow group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06]"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${c.tint} shadow-lg`}
              >
                <c.icon className="h-6 w-6 text-white" />
              </div>
              {c.badge && (
                <span className="absolute right-4 top-4 rounded-full bg-brand-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-300">
                  {c.badge}
                </span>
              )}
              <h3 className="mt-5 font-display text-lg font-bold text-white">{c.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
