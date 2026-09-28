import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequiredAuth";
import { Landing, SignInPage, SignUpPage, Dashboard, ProjectPage } from "./pages";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/project/:id"
          element={
            <RequireAuth>
              <ProjectPage />
            </RequireAuth>
          }
        />
      </Routes>
    </Layout>
  );
}