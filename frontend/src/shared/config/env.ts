/** Typed access to build-time public configuration (VITE_* variables only). */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  /** Team meeting link used by the sidebar announcement "Join Now" button. */
  gmailInboxUrl: import.meta.env.VITE_GMAIL_INBOX_URL ?? 'https://mail.google.com/mail/u/0/#inbox',
} as const;
