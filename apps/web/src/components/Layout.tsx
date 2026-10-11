import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber font-mono text-[15px] font-bold text-ink">
        &gt;_
      </span>
      <span className="font-display text-[17px] font-semibold tracking-tight text-paper">
        Tachi
      </span>
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    // No background here on purpose — the dark header is shared by every
    // page, but each page's own content controls its own background
    // (Landing goes full-bleed dark; Dashboard/the workspace stay light).
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="flex items-center gap-5">
            <SignedIn>
              <Link
                to="/dashboard"
                className="text-sm text-paper-muted transition hover:text-paper"
              >
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="rounded-full bg-amber px-4 py-1.5 text-sm font-medium text-ink transition hover:bg-amber-dim">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}