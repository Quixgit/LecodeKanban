import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { initI18n } from '@/shared/i18n';
import '@/shared/styles/globals.css';

void initI18n();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Translations load over HTTP; render nothing until the first namespaces arrive (~1 request). */}
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </StrictMode>,
);
