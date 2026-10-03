// A stand-in for the GitHub REST API, for the GitHub integration e2e test and local trials.
// Run:   node e2e/support/fakeGitHub.mjs          (listens on 47191)
// Start the backend with LK_GITHUB_API_URL=http://localhost:47191
// GET /__state shows what the app asked GitHub to do; POST /__reset clears it.
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_GITHUB_PORT ?? 47191);
const fresh = () => ({
  hooks: [],
  issues: [],
  states: [],
  comments: [],
  nextHook: 1,
  nextIssue: 40,
});
let state = fresh();

const json = (res, body, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const read = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data ? JSON.parse(data) : {}));
  });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  if (path === '/__state') return json(res, state);
  if (path === '/__reset') {
    state = fresh();
    return json(res, { ok: true });
  }
  if (!String(req.headers.authorization ?? '').startsWith('Bearer ghp_'))
    return json(res, { message: 'Bad credentials' }, 401);
  let m;
  if (path === '/user') return json(res, { login: 'octo-admin' });
  if (path === '/user/repos')
    return json(res, [
      { full_name: 'acme/web', private: true },
      { full_name: 'acme/api', private: false },
    ]);
  if ((m = path.match(/^\/repos\/([^/]+\/[^/]+)\/hooks$/)) && req.method === 'POST') {
    const body = await read(req);
    const hook = {
      id: state.nextHook++,
      repo: m[1],
      url: body.config?.url,
      secret: body.config?.secret,
      events: body.events,
    };
    state.hooks.push(hook);
    return json(res, { id: hook.id }, 201);
  }
  if ((m = path.match(/^\/repos\/([^/]+\/[^/]+)\/hooks\/(\d+)$/)) && req.method === 'DELETE') {
    state.hooks = state.hooks.filter((h) => h.id !== Number(m[2]));
    res.writeHead(204);
    return res.end();
  }
  if ((m = path.match(/^\/repos\/([^/]+\/[^/]+)\/issues$/)) && req.method === 'POST') {
    const body = await read(req);
    const number = state.nextIssue++;
    state.issues.push({ repo: m[1], number, title: body.title, body: body.body });
    return json(
      res,
      {
        number,
        title: body.title,
        html_url: `https://github.test/${m[1]}/issues/${number}`,
        state: 'open',
      },
      201,
    );
  }
  if ((m = path.match(/^\/repos\/([^/]+\/[^/]+)\/issues\/(\d+)$/)) && req.method === 'PATCH') {
    const body = await read(req);
    state.states.push({ repo: m[1], number: Number(m[2]), state: body.state });
    return json(res, { number: Number(m[2]), state: body.state });
  }
  if (
    (m = path.match(/^\/repos\/([^/]+\/[^/]+)\/issues\/(\d+)\/comments$/)) &&
    req.method === 'POST'
  ) {
    const body = await read(req);
    state.comments.push({ repo: m[1], number: Number(m[2]), body: body.body });
    return json(res, { id: 1 }, 201);
  }
  json(res, { message: 'Not Found' }, 404);
}).listen(PORT, () => console.log(`fake github on ${PORT}`));
