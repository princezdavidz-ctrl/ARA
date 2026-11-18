import { ArrowRight, ShieldCheck, Zap, CheckCircle2 } from 'lucide-react';

const stats = [
  { value: '4', label: 'Channels unified' },
  { value: '<3s', label: 'Reply time' },
  { value: '100%', label: 'Evidence-grounded' },
];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 lg:pt-36">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 grid-bg radial-fade" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-40 h-96 w-96 rounded-full bg-accent-500/10 blur-[100px]" />

      <div className="container-px relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex animate-fade-in items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-ink-200 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
            </span>
            Supervised AI for multi-company messaging
          </div>

          <h1 className="animate-fade-up font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="gradient-text">Answer every customer,</span>
            <br />
            <span className="text-white">on every channel, instantly.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-ink-300 [animation-delay:80ms]">
            ARA is the Autonomous Respond Agent — an AI communication platform that replies
            across WhatsApp, Email, Instagram and TikTok using your company's own knowledge,
            with human supervision and built-in billing.
          </p>

          <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 [animation-delay:160ms] sm:flex-row">
            <a
              href="https://ara-company-crm.onrender.com/?mode=register"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-ink-950 shadow-lg shadow-brand-500/30 transition-all hover:bg-brand-400 hover:shadow-brand-500/50"
            >
              Start free trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
            >
              See how it works
            </a>
          </div>

          <div className="mt-6 flex animate-fade-up flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-400 [animation-delay:220ms]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-brand-400" /> Human-in-the-loop approval
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-brand-400" /> AES-256 encrypted credentials
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-brand-400" /> No AI guesswork
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-16 grid max-w-3xl animate-fade-up grid-cols-3 gap-4 [animation-delay:300ms]">
          {stats.map((s) => (
            <div
              key={s.label}
              className="glass rounded-2xl px-4 py-5 text-center"
            >
              <div className="font-display text-2xl font-extrabold text-white sm:text-3xl">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-ink-400 sm:text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
