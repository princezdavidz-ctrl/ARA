import { Plug, BrainCircuit, ShieldCheck, Send } from 'lucide-react';

const steps = [
  {
    icon: Plug,
    title: 'Connect your channels',
    desc: 'Add WhatsApp, Email, Instagram and TikTok connections per company. Credentials are encrypted and webhook-verified before going live.',
  },
  {
    icon: BrainCircuit,
    title: 'Feed your knowledge base',
    desc: 'Upload documents into tenant-owned categories. ARA retrieves and cites them to answer customer questions with grounded evidence.',
  },
  {
    icon: ShieldCheck,
    title: 'Supervise the replies',
    desc: 'Confidence thresholds and response modes decide whether an answer sends automatically or routes to a human for approval.',
  },
  {
    icon: Send,
    title: 'Deliver and meter',
    desc: 'Validated replies are sent through the right channel. Every message is metered for usage billing, with retries and idempotency.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative py-24 lg:py-32">
      <div className="container-px">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            From inbox to answer in four steps
          </h2>
        </div>

        <div className="relative mt-16">
          {/* connecting line */}
          <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent lg:block" />
          <div className="grid gap-10 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className="relative">
                <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-ink-900 shadow-lg">
                  <s.icon className="h-6 w-6 text-brand-400" />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-ink-950">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-center font-display text-base font-bold text-white">
                  {s.title}
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-ink-400">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
