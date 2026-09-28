import { SignIn, SignUp } from "@clerk/clerk-react";

export function Landing() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-4xl font-bold">Build web apps by chatting with AI</h1>
      <p className="mt-4 text-gray-600">
        Describe what you want and watch it appear, live, in the browser.
      </p>
    </div>
  );
}

export function SignInPage() {
  return (
    <div className="flex justify-center py-16">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  );
}

export function SignUpPage() {
  return (
    <div className="flex justify-center py-16">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  );
}

export function Dashboard() {
  // Phase 5 replaces this with the real project list + "new project" modal.
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Your projects</h1>
      <p className="mt-2 text-gray-500">No projects yet.</p>
    </div>
  );
}

export function ProjectPage() {
  // Phase 7 replaces this with the editor + preview workspace.
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Project workspace</h1>
    </div>
  );
}