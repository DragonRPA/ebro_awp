import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeHindsightTracker } from './utils/hindsightTracker'
import { AppProvider } from './context/AppContext.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { db } from './services/db'

(window as any).__DB__ = db;
initializeHindsightTracker();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="?쒖뒪???쇱떆 ?ㅻ쪟 蹂듦뎄">
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
)


