# Integrations

The **Integrations** page (sidebar → Workspace → Integrations) shows every connectable service as a card.
Each card has an **Active** switch (pause or resume without disconnecting) and a **Settings** button that
opens the panel with that service's options. A card that says **Needs setup** means the server
administrator has not added the provider's credentials yet; **How to set up** shows the exact steps and
the address to register.

## Google Calendar

Shows your next meeting in the sidebar card, reminds you before it starts (pop-up, sound, bell) and can post
the reminder in a chat channel.

One-time server setup (administrator):

1. Google Cloud console → your project → **APIs & Services → Library** → enable **Google Calendar API**.
2. **OAuth consent screen** → add the scope `https://www.googleapis.com/auth/calendar.events.readonly`.
   While the app is in *Testing* mode, add your colleagues under **Test users**. For wider use, Google
   requires app verification for calendar scopes.
3. **Credentials** → your OAuth client (the same one used for "Sign in with Google") → add this
   **Authorised redirect URI**:

   ```
   <LK_PUBLIC_URL>/api/v1/integrations/google_calendar/callback
   ```

4. In the server environment (`.env`): `LK_GOOGLE_CLIENT_ID`, `LK_GOOGLE_CLIENT_SECRET`, and `LK_PUBLIC_URL`
   set to the address people use. Run `make deploy`.
5. Each person opens Integrations → Google Calendar → **Connect**.

Optional: `LK_INTEGRATIONS_TICK` (default `30s`) is how often meetings are re-synced and reminders checked.

Design notes: ADR 0019.
