import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { initI18n } from '@/shared/i18n';
import { reloadOnce } from '@/shared/lib/reload';
import '@/shared/styles/globals.css';

// A tab opened before a deployment asks for chunks that no longer exist: fetch the new bundle.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadOnce()) e.preventDefault();
});

void initI18n();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Translations load over HTTP; render nothing until the first namespaces arrive (~1 request). */}
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </StrictMode>,
);
