import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import TermsPage from './pages/TermsPage.tsx'
import PrivacyPage from './pages/PrivacyPage.tsx'

function Root() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'

  switch (pathname) {
    case '/terms':
      return <TermsPage />

    case '/privacy':
      return <PrivacyPage />

    default:
      return <App />
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)