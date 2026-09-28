import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <Link to="/" className="font-semibold">
          Lovable Clone
        </Link>
        <nav className="flex items-center gap-4">
          <SignedIn>
            <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-md bg-black px-3 py-1.5 text-sm text-white">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}