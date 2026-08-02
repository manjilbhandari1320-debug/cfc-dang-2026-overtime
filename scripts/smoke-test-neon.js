const { spawn } = require('node:child_process');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const port = 3107;
const origin = `http://127.0.0.1:${port}`;
const email = `codex-smoke-${Date.now()}@example.com`;
const password = 'SmokeTest-Password-947!';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const child = spawn(process.execPath, ['server.js'], { cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, PORT: String(port), NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
child.stdout.on('data', chunk => { serverOutput += chunk; });
child.stderr.on('data', chunk => { serverOutput += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { if ((await fetch(`${origin}/api/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start. ${serverOutput}`);
}

async function post(path, payload, cookie) {
  const response = await fetch(`${origin}/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(payload) });
  return { response, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie };
}

(async () => {
  let organizationId;
  try {
    await waitForServer();
    const home = await fetch(`${origin}/`);
    const homeHtml = await home.text();
    const legacyConfigMarker = ['MINDMITRA', 'SUPA', 'BASE'].join('_');
    if (!home.ok || !homeHtml.includes('js/api.js') || homeHtml.includes(legacyConfigMarker)) throw new Error('The frontend is not using the Neon API client exclusively.');
    const registration = await post('/auth/register', { email, password, full_name: 'Codex Smoke Organization', role: 'organization_admin', organization_type: 'School' });
    if (registration.response.status !== 201) throw new Error(`Registration failed: ${registration.data.error}`);
    organizationId = registration.data.user.organization_id;

    const dashboard = await fetch(`${origin}/api/organization/dashboard`, { headers: { Cookie: registration.cookie } });
    const dashboardData = await dashboard.json();
    if (!dashboard.ok) throw new Error(`Organization dashboard failed: ${dashboardData.error}. ${serverOutput}`);

    const stored = await pool.query('select password_hash from users where email=$1', [email]);
    if (!stored.rowCount || stored.rows[0].password_hash === password || !stored.rows[0].password_hash.startsWith('scrypt$')) throw new Error('Password was not stored as a scrypt hash.');

    await post('/auth/logout', {}, registration.cookie);
    const rejected = await post('/auth/login', { email, password: 'Wrong-Password-947!', role: 'organization_admin' });
    if (rejected.response.status !== 401) throw new Error('Wrong password was not rejected.');

    const wrongOrganization = await post('/auth/login', { email, password, role: 'organization_admin', organization_type: 'Company' });
    if (wrongOrganization.response.status !== 403) throw new Error('A different organization type was not rejected.');

    const login = await post('/auth/login', { email, password, role: 'organization_admin', organization_type: 'School' });
    if (login.response.status !== 200 || !login.cookie) throw new Error(`Correct login failed: ${login.data.error}`);
    const me = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: login.cookie } });
    const meData = await me.json();
    if (!me.ok || meData.user.email !== email || !me.headers.get('set-cookie')) throw new Error('Authenticated session was not restored and renewed.');
    console.log('Neon register, password-hash verification, login, and session restore passed.');
  } finally {
    await pool.query('delete from users where email=$1', [email]).catch(() => {});
    if (organizationId) await pool.query('delete from organizations where id=$1', [organizationId]).catch(() => {});
    await pool.end();
    child.kill('SIGTERM');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
