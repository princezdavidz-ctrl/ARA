import { Sparkles } from 'lucide-react';

const cols = [
  {
    title: 'Product',
    links: ['Channels', 'Features', 'Pricing', 'How it works'],
  },
  {
    title: 'Platform',
    links: ['Super Admin', 'Company CRM', 'Knowledge bases', 'Billing'],
  },
  {
    title: 'Company',
    links: ['About', 'Security', 'Documentation', 'Contact'],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-white/10 py-14">
      <div className="container-px">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600">
                <Sparkles className="h-5 w-5 text-ink-950" />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight text-white">
                ARA
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-400">
              The Autonomous Respond Agent — supervised, evidence-grounded AI across WhatsApp,
              Email, Instagram and TikTok.
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-sm font-semibold text-white">{c.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#top"
                      className="text-sm text-ink-400 transition-colors hover:text-white"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-ink-500 sm:flex-row">
          <p>(c) {new Date().getFullYear()} ARA. All rights reserved.</p>
          <p className="flex items-center gap-4">
            <a href="#top" className="hover:text-ink-200">Privacy</a>
            <a href="#top" className="hover:text-ink-200">Terms</a>
            <a href="#top" className="hover:text-ink-200">Security</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
