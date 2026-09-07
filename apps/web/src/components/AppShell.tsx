import Link from "next/link";

export function AppShell({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-[var(--ink)]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[var(--canvas)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_10%_-10%,rgba(93,206,160,0.12),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(61,107,154,0.14),transparent)]" />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 pb-2 pt-8">
        <Link href="/" className="group flex items-baseline gap-3">
          <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">
            Squadrons
          </span>
          <span className="text-sm text-[var(--muted)] transition group-hover:text-[var(--ink-soft)]">
            My Agents
          </span>
        </Link>
        {action}
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 pb-20 pt-8">
        {children}
      </main>
    </div>
  );
}
