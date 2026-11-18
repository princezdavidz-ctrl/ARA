import { Sparkles, ArrowRight } from 'lucide-react';

export default function CTA() {
  return (
    <section className="relative py-24 lg:py-28">
      <div className="container-px">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-600/20 via-ink-900 to-ink-950 px-8 py-14 text-center sm:px-16 lg:py-20">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/30 blur-[100px]" />
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-brand-200">
              <Sparkles className="h-3.5 w-3.5" /> Ready when you are
            </span>
            <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Put your customer replies on autopilot — safely.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-ink-300">
              Connect a channel, upload your knowledge, and let ARA answer with evidence while you
              keep full oversight.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="https://ara-company-crm.onrender.com/?mode=register"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.03] active:scale-95"
              >
                Start free trial
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Explore features
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
