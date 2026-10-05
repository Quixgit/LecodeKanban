const KEY = 'lk-pending-invite';

/**
 * The invitation a person opened and has not accepted yet. If they end up inside the app first (signing in with a
 * provider, confirming an email), the app sends them back to it rather than offering to set up a workspace of their own.
 */
export const pendingInvite = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(KEY, token);
    } catch {
      /* storage unavailable: the person simply follows the link again */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  },
};
