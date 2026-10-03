import { lazy } from 'react';

export type { PageEditorProps } from './components/PageEditor';

/** The editor is large (TipTap, lowlight, KaTeX): it loads only when a page is opened. */
export const PageEditor = lazy(() => import('./components/PageEditor'));
