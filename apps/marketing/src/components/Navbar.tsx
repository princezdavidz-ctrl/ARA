import { useEffect, useState } from 'react';
import { Menu, X, Sparkles } from 'lucide-react';

const links = [
  { label: 'Channels', href: '#channels' },
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-white/10 bg-ink-950/80 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <nav className="container-px flex h-16 items-center justify-between lg:h-18">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/30">
            <Sparkles className="h-5 w-5 text-ink-950" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-white">
            ARA
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-ink-300 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="https://ara-company-crm.onrender.com/?mode=login"
            className="text-sm font-medium text-ink-200 transition-colors hover:text-white"
          >
            Sign in
          </a>
          <a
            href="https://ara-company-crm.onrender.com/?mode=register"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.03] active:scale-95"
          >
            Start free
          </a>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden rounded-lg p-2 text-ink-200 hover:bg-white/10"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-ink-950/95 backdrop-blur-xl">
          <div className="container-px flex flex-col gap-1 py-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-200 hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <a
              href="https://ara-company-crm.onrender.com/?mode=register"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-ink-950"
            >
              Start free
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
