import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { validateWebEnv } from "@vibe-code-ide/shared"
import './index.css'
import App from './App.tsx'

const env = validateWebEnv(import.meta.env);


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
)
