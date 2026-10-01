import { useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { createAppRouter } from './router';

export function App() {
  const [router] = useState(createAppRouter);
  return (
    <AppProviders>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </AppProviders>
  );
}
