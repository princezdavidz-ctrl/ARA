import { Check, ArrowRight } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: 'KES 2,500',
    period: '/mo',
    tagline: 'For a single company getting started with AI replies.',
    features: [
      '1 channel connection',
      '1,000 messages / month',
      '500 AI responses included',
      '1 knowledge base',
      'Supervised draft approval',
      'Email support',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    name: 'Growth',
    price: 'KES 7,900',
    period: '/mo',
    tagline: 'For growing companies across multiple messaging channels.',
    features: [
      '4 channel connections',
      '5,000 messages / month',
      '2,500 AI responses included',
      '3 knowledge bases',
      'Confidence threshold controls',
      'Hybrid metered overages',
      'Priority support',
    ],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    name: 'Platform',
    price: 'Custom',
    period: '',
    tagline: 'For agencies managing many companies on ARA.',
    features: [
      'Unlimited companies & seats',
      'Custom message quotas',
      'Super Admin & Company CRM',
      'M-Pesa STK Push invoicing',
      'Audit trail & role checks',
      'Dedicated onboarding',
    ],
    cta: 'Talk to sales',
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative py-24 lg:py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-accent-500/10 blur-[120px]" />
      <div className="container-px relative">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Subscription plus metered usage
          </h2>
          <p className="mt-4 text-lg text-ink-300">
            Recurring plans with included message and AI quotas. Pay only for overages beyond your
            plan. M-Pesa and card payments supported.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-3xl border p-8 transition-all duration-300 ${
                p.highlight
                  ? 'border-brand-400/40 bg-gradient-to-b from-brand-500/10 to-white/[0.02] shadow-2xl shadow-brand-500/10 lg:-translate-y-3'
                  : 'border-white/10 bg-white/[0.03] hover:-translate-y-1 hover:border-white/20'
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-ink-950">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-xl font-bold text-white">{p.name}</h3>
              <p className="mt-2 text-sm text-ink-400">{p.tagline}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-white">{p.price}</span>
                <span className="text-sm text-ink-400">{p.period}</span>
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="https://ara-company-crm.onrender.com/?mode=register"
                className={`group mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all ${
                  p.highlight
                    ? 'bg-brand-500 text-ink-950 hover:bg-brand-400'
                    : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                {p.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
