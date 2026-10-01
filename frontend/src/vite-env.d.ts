/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_TEAM_MEETING_URL?: string;
  readonly VITE_GMAIL_INBOX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
