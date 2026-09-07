import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function NotFound() {
  return (
    <AppShell>
      <div className="space-y-4 py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-[-0.02em]">
          Agent not found
        </h1>
        <Link href="/" className="text-[var(--accent)] underline-offset-4 hover:underline">
          Back to My Agents
        </Link>
      </div>
    </AppShell>
  );
}
