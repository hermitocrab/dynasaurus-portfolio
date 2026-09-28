import Link from "next/link";

const LINKS = [
  ["How it works", "/intro"],
  ["RUA method", "/method/rua"],
  ["About", "/about"],
  ["FAQ", "/faq"],
  ["Pricing", "/pricing"],
] as const;

export default function MarketingNav() {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)]/80 backdrop-blur-xl">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-5 py-4 sm:px-6"
      >
        <Link href="/" className="shrink-0 font-black tracking-tight text-[var(--color-text-primary)]">
          DynaSaurus <span aria-hidden="true">🦕</span>
        </Link>
        <div className="hidden items-center gap-5 md:flex">
          {LINKS.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              {label}
            </Link>
          ))}
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-white"
        >
          Open app
        </Link>
      </nav>
    </header>
  );
}
