import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 text-sm sm:flex-row sm:items-end">
        <div>
          <p className="font-bold text-[var(--color-text-primary)]">DynaSaurus · 词灵龙</p>
          <p className="mt-2 max-w-xl leading-6 text-[var(--color-text-muted)]">
            A personalized AI language-learning web app created by Kee Lee.
          </p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-[var(--color-text-muted)]">
          <Link href="/about" className="hover:text-[var(--color-text-primary)]">About</Link>
          <Link href="/method/rua" className="hover:text-[var(--color-text-primary)]">RUA</Link>
          <Link href="/faq" className="hover:text-[var(--color-text-primary)]">FAQ</Link>
          <Link href="/pricing" className="hover:text-[var(--color-text-primary)]">Pricing</Link>
          <Link href="/privacy" className="hover:text-[var(--color-text-primary)]">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
