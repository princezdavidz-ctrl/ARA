import {
  BrainCircuit,
  BookOpenCheck,
  ShieldCheck,
  Receipt,
  Building2,
  Lock,
} from 'lucide-react';

const features = [
  {
    icon: BrainCircuit,
    title: 'Supervised AI replies',
    desc: 'When confidence is low, AI is off, or evidence is missing, ARA escalates to a human instead of guessing. Only validated answers reach your customers.',
  },
  {
    icon: BookOpenCheck,
    title: 'Tenant-owned knowledge',
    desc: 'Each company gets its own knowledge base with categories, templates and metadata. The RAG worker cites retrieved documents — never invented facts.',
  },
  {
    icon: ShieldCheck,
    title: 'Grounding & evidence checks',
    desc: 'Model output is checked against retrieved tenant documents before delivery. Citations must refer to real evidence, or the draft is held back.',
  },
  {
    icon: Building2,
    title: 'Multi-company platform',
    desc: 'Separate Super Admin and Company CRM apps manage tenant lifecycle, channel connections, plans and invoices from one shared backend.',
  },
  {
    icon: Lock,
    title: 'Encrypted channel credentials',
    desc: 'AES-256-GCM encryption with versioned keys. Credentials are never returned in API responses and are scoped per tenant connection.',
  },
  {
    icon: Receipt,
    title: 'Hybrid subscription billing',
    desc: 'Recurring plans with included quotas plus metered overages. Invoice generation, M-Pesa STK Push, and provider-neutral payment webhooks.',
  },
];

export default function Features() {
  return (
    <section id="features" className="relative py-24 lg:py-32">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[120px]" />
      <div className="container-px relative">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">
            Built for trust
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            AI that answers with evidence, not guesses
          </h2>
          <p className="mt-4 text-lg text-ink-300">
            Every layer of ARA is designed so customers get accurate, grounded responses — and
            companies stay in control.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="card-glow group rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-400/30 bg-brand-500/10 text-brand-300 transition-transform group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-white">{f.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
