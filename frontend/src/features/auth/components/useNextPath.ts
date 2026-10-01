import { useSearchParams } from 'react-router-dom';

/** Safe in-app return path from ?next= (rejects absolute and protocol-relative URLs). */
export function useNextPath(): string {
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}
