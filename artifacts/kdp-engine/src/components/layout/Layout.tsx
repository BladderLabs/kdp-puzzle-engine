import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AuthorWizard, useActivePersona } from "@/components/author/AuthorWizard";

function NavLink({
  href,
  children,
  highlight,
}: {
  href: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  const [location] = useLocation();
  const active = location === href || (href !== "/" && location.startsWith(href));
  if (highlight) {
    return (
      <Link
        href={href}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-150 ${
          active
            ? "bg-amber-500 text-black border-amber-500"
            : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/60"
        }`}
      >
        <span className="opacity-70">✦</span>
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active ? "text-white bg-white/8 font-semibold" : "text-white/45 hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
    </Link>
  );
}

function AuthorBadge({ onOpen }: { onOpen: () => void }) {
  const { data: persona, isLoading } = useActivePersona();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 pl-3 py-1.5 border-l border-white/10">
        <div className="w-6 h-6 rounded-full bg-white/10 animate-pulse" />
        <div className="w-20 h-3 rounded bg-white/10 animate-pulse" />
      </div>
    );
  }

  if (!persona) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-2 pl-3 py-1.5 border-l border-white/10 group"
        title="No active author persona. Click to set one up."
      >
        <div className="w-6 h-6 rounded-full border border-dashed border-amber-500/60 flex items-center justify-center text-amber-500 text-[10px]">?</div>
        <div className="leading-none text-left">
          <div className="text-[9px] uppercase tracking-widest text-amber-500/70">Set author</div>
          <div className="text-[11px] text-white/70 group-hover:text-white font-sketch">pick a pen name →</div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2 pl-3 py-1.5 border-l border-white/10 group"
      title={`Active author: ${persona.penName}. Click to change.`}
    >
      <div className="w-6 h-6 flex-shrink-0" dangerouslySetInnerHTML={{ __html: persona.monogramSvg }} />
      <div className="leading-none text-left">
        <div className="text-[9px] uppercase tracking-widest text-white/40">Publishing as</div>
        <div className="text-[11px] font-semibold text-white/85 group-hover:text-white" style={{ color: persona.signatureColor }}>
          {persona.penName}
        </div>
      </div>
    </button>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-white/8 bg-background/95 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 h-13 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/25 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-amber-400">
                <path d="M9.5 1.5L12.5 4.5L4.5 12.5L1 13L1.5 9.5L9.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 3L11 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="leading-none">
              <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-amber-500/50 leading-none">KDP</div>
              <div className="text-sm font-bold text-white/90 leading-tight">Puzzle Workshop</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/">Projects</NavLink>
            <NavLink href="/create">Manual</NavLink>
            <NavLink href="/agent-create">Classic AI</NavLink>
            <NavLink href="/flow" highlight>Flow</NavLink>
          </nav>
          <AuthorBadge onOpen={() => setWizardOpen(true)} />
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
      <AuthorWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
