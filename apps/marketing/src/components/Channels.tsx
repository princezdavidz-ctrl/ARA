const channels = [
  {
    name: 'WhatsApp',
    desc: 'Cloud API replies with delivery tracking and customer-service window handling.',
    iconSrc: 'https://img.icons8.com/color/48/whatsapp--v1.png',
    iconAlt: 'WhatsApp logo',
    iconCredit: 'https://icons8.com/icon/16713/whatsapp',
    tint: 'from-emerald-400 to-green-600',
    badge: 'Most popular',
  },
  {
    name: 'Email',
    desc: 'Signed inbound relay plus Resend outbound. Every reply grounded in your knowledge base.',
    iconSrc: 'https://img.icons8.com/color/48/email.png',
    iconAlt: 'Email logo',
    iconCredit: 'https://icons8.com/icon/13826/email',
    tint: 'from-sky-400 to-blue-600',
  },
  {
    name: 'Instagram',
    desc: 'Direct messages through the Meta Messaging API, with attachments escalated to humans.',
    iconSrc: 'https://img.icons8.com/color/48/instagram-new--v1.png',
    iconAlt: 'Instagram logo',
    iconCredit: 'https://icons8.com/icon/32323/instagram',
    tint: 'from-fuchsia-400 to-pink-600',
  },
  {
    name: 'TikTok',
    desc: 'Business messaging with normalized webhooks and per-tenant encrypted credentials.',
    iconSrc: 'https://img.icons8.com/color/48/tiktok--v1.png',
    iconAlt: 'TikTok logo',
    iconCredit: 'https://icons8.com/icon/118640/tiktok',
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
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white p-2.5 shadow-lg shadow-black/20">
                <img
                  src={c.iconSrc}
                  alt={c.iconAlt}
                  width={40}
                  height={40}
                  loading="lazy"
                  decoding="async"
                  className="h-9 w-9 object-contain"
                />
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

        <p className="mt-6 text-center text-xs text-ink-500">
          Channel icons by{' '}
          <a href="https://icons8.com/icons/set/social-media--icons8" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-300">
            Icons8
          </a>
          {' · '}
          {channels.map((channel, index) => (
            <span key={channel.name}>
              {index > 0 && ' · '}
              <a href={channel.iconCredit} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-300">
                {channel.name}
              </a>
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
