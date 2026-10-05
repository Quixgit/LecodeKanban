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
   While the app is in _Testing_ mode, add your colleagues under **Test users**. For wider use, Google
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

## GitHub

Connected once per workspace by an owner or administrator, with an access token. Projects are linked to
repositories; pull requests and issues that mention task keys appear on the tasks, and the two sides
follow each other.

Setup (administrator):

1. On GitHub create a personal access token: classic with scopes `repo` and `admin:repo_hook`, or
   fine-grained with read & write for _Issues_, _Pull requests_ and _Webhooks_ and read for _Contents_ and
   _Metadata_, on the repositories you will link.
2. Integrations → GitHub → **Connect**, paste the token. It is checked against GitHub and stored
   encrypted (AES-GCM, with `LK_ENCRYPTION_KEY`).
3. Link each project to its repository. A webhook is registered on the repository automatically; it
   delivers to `<LK_PUBLIC_URL>/api/v1/integrations/github/webhook`, so `LK_PUBLIC_URL` must be the
   address GitHub can reach (not `localhost`). Deliveries are verified with an HMAC secret.

What happens:

| On GitHub                                                                                       | In LecodeKanban                                                              |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Pull request opened / ready for review that mentions `PLT-12` in its title, branch name or body | the task links the PR and moves to **In review** (never backwards from Done) |
| Pull request merged                                                                             | the task moves to **Done**                                                   |
| Issue opened                                                                                    | a new task in the linked project (unless it was created from a task)         |
| Issue closed / reopened                                                                         | the task moves to **Done** / back to **To Do**                               |

| In LecodeKanban                      | On GitHub                                              |
| ------------------------------------ | ------------------------------------------------------ |
| Task moved to **Done** / out of Done | its linked issue is closed / reopened                  |
| Task moved                           | a comment with a link on its open pull requests        |
| **Create GitHub issue** on a task    | an issue in the project's repository, linked both ways |

Each rule is a switch in Settings. Changes made by the rules show up as made by the person who connected
GitHub. The task window also suggests a branch name (`plt-12-short-title`) to copy.

Not covered: several repositories per project, GitHub Enterprise on another host (set `LK_GITHUB_API_URL`),
syncing comments or labels, GitHub Apps / OAuth instead of a token.
