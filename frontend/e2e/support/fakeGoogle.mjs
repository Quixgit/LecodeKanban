// A stand-in for Google's OAuth and Calendar endpoints, for the integration e2e test and local trials.
// Run:   node e2e/support/fakeGoogle.mjs            (listens on 47190)
// Start the backend with:
//   LK_GOOGLE_CLIENT_ID=fake LK_GOOGLE_CLIENT_SECRET=fake LK_INTEGRATIONS_TICK=5s \
//   LK_GOOGLE_AUTH_URL=http://localhost:47190/auth LK_GOOGLE_TOKEN_URL=http://localhost:47190/token \
//   LK_GOOGLE_USERINFO_URL=http://localhost:47190/userinfo LK_GOOGLE_API_URL=http://localhost:47190
// Tests set the calendar with POST /__events [{id,title,inMinutes,attendees?}].
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_GOOGLE_PORT ?? 47190);
let events = [];

const json = (res, body, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const body = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/auth') {
    // The "consent screen" approves at once and sends the browser back with a code.
    const back = new URL(url.searchParams.get('redirect_uri'));
    back.searchParams.set('code', 'fake-code');
    back.searchParams.set('state', url.searchParams.get('state'));
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }
  if (url.pathname === '/token') {
    const form = new URLSearchParams(await body(req));
    if (form.get('grant_type') === 'authorization_code') {
      return json(res, {
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }
    return json(res, { access_token: 'at2', expires_in: 3600, token_type: 'Bearer' });
  }
  if (url.pathname === '/userinfo') return json(res, { email: 'peter@gmail.test' });
  if (url.pathname === '/calendar/v3/calendars/primary/events') {
    return json(res, {
      items: events.map((e) => ({
        id: e.id,
        status: 'confirmed',
        summary: e.title,
        htmlLink: `https://calendar.test/${e.id}`,
        hangoutLink: `https://meet.test/${e.id}`,
        start: { dateTime: new Date(e.startsAt).toISOString() },
        end: { dateTime: new Date(e.startsAt + 30 * 60_000).toISOString() },
        attendees: (e.attendees ?? []).map((email) => ({ email })),
      })),
    });
  }
  if (url.pathname === '/__events' && req.method === 'POST') {
    // Start times are fixed when the calendar is set, so repeated syncs see the same meeting.
    const now = Date.now();
    events = JSON.parse(await body(req)).map((e) => ({
      ...e,
      startsAt: now + e.inMinutes * 60_000,
    }));
    return json(res, { ok: true });
  }
  json(res, { error: 'not found' }, 404);
}).listen(PORT, () => console.log(`fake google on ${PORT}`));
