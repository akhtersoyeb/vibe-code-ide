import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    // Clerk hasn't determined auth state yet — avoid a flash-redirect to
    // sign-in for users who are actually signed in.
    return <div className="p-8 text-center text-sm text-gray-500">Loading…</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}