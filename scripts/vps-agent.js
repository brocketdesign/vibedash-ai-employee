#!/usr/bin/env node
/**
 * VibeDash VPS Management Agent
 * Handles WordPress provisioning and static site deployment.
 *
 * Env: MGMT_SECRET  BASE_DOMAIN  PORT  SITES_ROOT
 */
'use strict';

const http = require('http');
const https = require('https');
const { execFileSync, execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const httpPost = (url, body, headers) => new Promise((resolve, reject) => {
  const parsed = new URL(url);
  const mod = parsed.protocol === 'https:' ? https : http;
  const data = JSON.stringify(body);
  const req = mod.request({
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
  }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', reject);
  req.setTimeout(10_000, () => { req.destroy(new Error('timeout')); });
  req.write(data);
  req.end();
});

const PORT        = parseInt(process.env.PORT || '7854', 10);
const SECRET      = process.env.MGMT_SECRET;
const BASE_DOMAIN = process.env.BASE_DOMAIN;
const SITES_ROOT  = process.env.SITES_ROOT  || '/var/www/sites';
const STATIC_ROOT = process.env.STATIC_ROOT || '/var/www/static';

if (!SECRET) { console.error('ERROR: MGMT_SECRET env var is required'); process.exit(1); }
if (!BASE_DOMAIN) { console.error('ERROR: BASE_DOMAIN env var is required'); process.exit(1); }

// ── Helpers ─────────────────────────────────────────────────────────────────

function assertSafeSubdomain(value) {
  if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(value)) throw new Error('Invalid subdomain');
}
function assertNonEmpty(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${name} must be a non-empty string`);
}
function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(a); const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) { crypto.timingSafeEqual(aBuf, aBuf); return false; }
  return crypto.timingSafeEqual(aBuf, bBuf);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

// ── WordPress provisioning ───────────────────────────────────────────────────

function provision({ subdomain, siteTitle, adminUser, adminPassword, adminEmail, dbPassword, force = false }) {
  assertSafeSubdomain(subdomain);
  assertNonEmpty(siteTitle,      'siteTitle');
  assertNonEmpty(adminUser,      'adminUser');
  assertNonEmpty(adminPassword,  'adminPassword');
  assertNonEmpty(adminEmail,     'adminEmail');
  assertNonEmpty(dbPassword,     'dbPassword');

  const slug    = subdomain.replace(/-/g, '_');
  const siteUrl = `http://${subdomain}.${BASE_DOMAIN}`;
  const webRoot = path.join(SITES_ROOT, subdomain);
  const dbName  = `wp_${slug}`;
  const dbUser  = `wp_${slug.slice(0, 32)}`;

  let phpFpmSocket = '/run/php/php-fpm.sock';
  try {
    const sockets = fs.readdirSync('/run/php').filter(f => f.endsWith('-fpm.sock'));
    if (sockets.length > 0) phpFpmSocket = `/run/php/${sockets[0]}`;
  } catch { /* ignore */ }

  const env = {
    ...process.env, DEBIAN_FRONTEND: 'noninteractive',
    WP_SUBDOMAIN: subdomain, WP_SLUG: slug, WP_SITE_URL: siteUrl, WP_SITE_TITLE: siteTitle,
    WP_ADMIN_USER: adminUser, WP_ADMIN_PASS: adminPassword, WP_ADMIN_EMAIL: adminEmail,
    WP_DB_NAME: dbName, WP_DB_USER: dbUser, WP_DB_PASS: dbPassword,
    WP_ROOT: webRoot, PHP_FPM_SOCK: phpFpmSocket,
  };

  const run = (cmd, args = []) => {
    console.log(`[agent:${subdomain}] exec: ${cmd} ${args.join(' ').slice(0, 120)}`);
    try {
      const out = execFileSync(cmd, args, { env, stdio: 'pipe' });
      if (out?.length) console.log(`[agent:${subdomain}]   stdout: ${out.toString().trim().slice(0, 300)}`);
    } catch (err) {
      console.error(`[agent:${subdomain}]   FAILED (status=${err.status})`);
      if (err.stdout) console.error(`[agent:${subdomain}]   stdout: ${err.stdout.toString().trim().slice(0, 300)}`);
      if (err.stderr) console.error(`[agent:${subdomain}]   stderr: ${err.stderr.toString().trim().slice(0, 500)}`);
      throw err;
    }
  };
  const sh = (script) => {
    console.log(`[agent:${subdomain}] sh: ${script.slice(0, 120)}`);
    try {
      const out = execSync(script, { env, stdio: 'pipe' });
      if (out?.length) console.log(`[agent:${subdomain}]   stdout: ${out.toString().trim().slice(0, 300)}`);
    } catch (err) {
      console.error(`[agent:${subdomain}]   sh FAILED cmd=${script.slice(0, 80)}`);
      if (err.stdout) console.error(`[agent:${subdomain}]   stdout: ${err.stdout.toString().trim().slice(0, 300)}`);
      if (err.stderr) console.error(`[agent:${subdomain}]   stderr: ${err.stderr.toString().trim().slice(0, 500)}`);
      throw err;
    }
  };

  const mysql = (sql) => execFileSync('mysql', ['-e', sql], { env, stdio: 'pipe' });
  const nginxConf    = `/etc/nginx/sites-available/${subdomain}.${BASE_DOMAIN}`;
  const nginxSymlink = `/etc/nginx/sites-enabled/${subdomain}.${BASE_DOMAIN}`;

  if (force) {
    console.log(`[agent:${subdomain}] step 0 — force cleanup`);
    mysql(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
    mysql(`DROP USER IF EXISTS '${dbUser}'@'localhost';`);
    if (fs.existsSync(webRoot)) fs.rmSync(webRoot, { recursive: true, force: true });
    if (fs.existsSync(nginxSymlink)) fs.unlinkSync(nginxSymlink);
    if (fs.existsSync(nginxConf))    fs.unlinkSync(nginxConf);
    console.log(`[agent:${subdomain}] step 0 ✓`);
  }

  fs.mkdirSync(webRoot, { recursive: true });

  if (!fs.existsSync(path.join(webRoot, 'wp-load.php'))) {
    run('wp', ['core', 'download', `--path=${webRoot}`, '--allow-root', '--quiet']);
  }

  mysql(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  mysql(`CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPassword.replace(/'/g, "\\'")}';`);
  mysql(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost'; FLUSH PRIVILEGES;`);

  if (!fs.existsSync(path.join(webRoot, 'wp-config.php'))) {
    run('wp', ['config', 'create', `--dbname=${dbName}`, `--dbuser=${dbUser}`, `--dbpass=${dbPassword}`,
      '--dbhost=localhost', `--path=${webRoot}`, '--allow-root', '--quiet']);
  }

  run('wp', ['core', 'install', `--url=${siteUrl}`, `--title=${siteTitle}`,
    `--admin_user=${adminUser}`, `--admin_password=${adminPassword}`, `--admin_email=${adminEmail}`,
    '--skip-email', `--path=${webRoot}`, '--allow-root']);

  sh(`chown -R www-data:www-data ${webRoot}`);

  fs.writeFileSync(nginxConf, `server {
    listen 80;
    server_name ${subdomain}.${BASE_DOMAIN};
    root ${webRoot};
    index index.php index.html;

    location / { try_files $uri $uri/ /index.php?$args; }

    location ~ \\.php$ {
        fastcgi_pass unix:${phpFpmSocket};
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    location ~ /\\.ht { deny all; }
}
`);
  if (!fs.existsSync(nginxSymlink)) fs.symlinkSync(nginxConf, nginxSymlink);
  sh('nginx -t');
  sh('nginx -s reload');

  try {
    sh(`certbot --nginx -d ${subdomain}.${BASE_DOMAIN} --non-interactive --agree-tos --email admin@${BASE_DOMAIN} --redirect --quiet`);
    console.log(`[agent:${subdomain}] SSL enabled`);
  } catch (err) {
    console.error(`[agent:${subdomain}] certbot failed (non-fatal): ${err.message?.slice(0, 200)}`);
  }

  console.log(`[agent:${subdomain}] ✓ provisioning complete — ${subdomain}.${BASE_DOMAIN}`);
}

// ── Static site helpers ──────────────────────────────────────────────────────

function staticNginxConf(subdomain) {
  return `server {
    listen 80;
    server_name ${subdomain}.${BASE_DOMAIN};
    root ${STATIC_ROOT}/${subdomain};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf|webp|mp4|webm|pdf)$ {
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }
}
`;
}

// ── WordPress theme editing (WP-CLI) ─────────────────────────────────────────

/** Resolve a managed site's webroot, asserting it holds a real WordPress install. */
function wpRoot(subdomain) {
  assertSafeSubdomain(subdomain);
  const webRoot = path.join(SITES_ROOT, subdomain);
  if (!fs.existsSync(path.join(webRoot, 'wp-load.php'))) {
    throw new Error(`No WordPress install found for "${subdomain}"`);
  }
  return webRoot;
}

/** Run a WP-CLI command (array args, no shell) against a site and return trimmed stdout. */
function wpCli(webRoot, args) {
  return execFileSync('wp', [...args, '--allow-root', `--path=${webRoot}`], {
    encoding: 'utf8', stdio: 'pipe', env: { ...process.env },
  }).trim();
}

/** Run a list-style WP-CLI command with --format=json and parse the result. */
function wpCliJson(webRoot, args) {
  const out = wpCli(webRoot, [...args, '--format=json']);
  return out ? JSON.parse(out) : null;
}

/** Identifiers passed to WP-CLI as values that could otherwise be read as flags. */
function assertSafeKey(value, name) {
  assertNonEmpty(value, name);
  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(value)) throw new Error(`Invalid ${name}: "${value}"`);
}
function assertNoLeadingDash(value, name) {
  assertNonEmpty(value, name);
  if (value.startsWith('-')) throw new Error(`${name} may not start with "-"`);
}

/** Gather current theme/menu/customizer state so the agent can edit deliberately. */
function themeInfo(subdomain) {
  const webRoot = wpRoot(subdomain);
  const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
  return {
    stylesheet: safe(() => wpCli(webRoot, ['option', 'get', 'stylesheet']), null),
    template:   safe(() => wpCli(webRoot, ['option', 'get', 'template']), null),
    themes:     safe(() => wpCliJson(webRoot, ['theme', 'list', '--fields=name,status,title,version']), []),
    menus:      safe(() => wpCliJson(webRoot, ['menu', 'list', '--fields=term_id,name,slug,locations,count']), []),
    locations:  safe(() => wpCliJson(webRoot, ['menu', 'location', 'list']), []),
    mods:       safe(() => wpCliJson(webRoot, ['theme', 'mod', 'list']), {}),
  };
}

/** Apply a single theme-editing operation. Returns a small result summary. */
function editTheme(subdomain, op, body) {
  const webRoot = wpRoot(subdomain);

  switch (op) {
    case 'set-theme-mods': {
      const mods = body.mods && typeof body.mods === 'object' ? body.mods : {};
      const keys = Object.keys(mods);
      if (keys.length === 0) throw new Error('mods object is required');
      for (const key of keys) {
        assertSafeKey(key, 'mod key');
        wpCli(webRoot, ['theme', 'mod', 'set', key, String(mods[key])]);
      }
      return { set: keys };
    }

    case 'set-options': {
      const options = body.options && typeof body.options === 'object' ? body.options : {};
      const keys = Object.keys(options);
      if (keys.length === 0) throw new Error('options object is required');
      for (const key of keys) {
        assertSafeKey(key, 'option key');
        wpCli(webRoot, ['option', 'update', key, String(options[key])]);
      }
      return { updated: keys };
    }

    case 'set-custom-css': {
      assertNonEmpty(body.css, 'css');
      const tmp = path.join(os.tmpdir(), `vibedash-css-${crypto.randomBytes(6).toString('hex')}.css`);
      fs.writeFileSync(tmp, body.css, 'utf8');
      try {
        // file_get_contents on a path we control; the CSS itself never touches the command line.
        wpCli(webRoot, ['eval', `wp_update_custom_css_post(file_get_contents(${JSON.stringify(tmp)}));`]);
      } finally {
        try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      }
      return { bytes: Buffer.byteLength(body.css) };
    }

    case 'create-menu': {
      assertNoLeadingDash(body.name, 'name');
      const items = Array.isArray(body.items) ? body.items : [];

      const existing = (wpCliJson(webRoot, ['menu', 'list', '--fields=term_id,name']) || [])
        .find((m) => m.name === body.name);
      const menuId = existing
        ? String(existing.term_id)
        : wpCli(webRoot, ['menu', 'create', body.name, '--porcelain']);

      if (body.replace && existing) {
        const dbIds = (wpCliJson(webRoot, ['menu', 'item', 'list', menuId, '--fields=db_id']) || [])
          .map((i) => String(i.db_id));
        if (dbIds.length) wpCli(webRoot, ['menu', 'item', 'delete', ...dbIds]);
      }

      let added = 0;
      for (const item of items) {
        if (item && item.type === 'custom') {
          assertNoLeadingDash(item.title, 'menu item title');
          assertNoLeadingDash(item.url, 'menu item url');
          wpCli(webRoot, ['menu', 'item', 'add-custom', menuId, item.title, item.url]);
          added++;
        } else if (item && item.type === 'page') {
          let pageId = item.pageId ? String(item.pageId) : '';
          if (!pageId && item.pageSlug) {
            assertSafeKey(item.pageSlug, 'pageSlug');
            pageId = wpCli(webRoot, ['post', 'list', '--post_type=page', `--name=${item.pageSlug}`, '--field=ID']).split('\n')[0].trim();
          }
          if (!pageId) throw new Error('page menu item requires pageId or an existing pageSlug');
          wpCli(webRoot, ['menu', 'item', 'add-post', menuId, pageId]);
          added++;
        } else {
          throw new Error('each menu item needs type "page" or "custom"');
        }
      }

      if (body.location) {
        assertSafeKey(body.location, 'location');
        wpCli(webRoot, ['menu', 'location', 'assign', menuId, body.location]);
      }
      return { menuId: Number(menuId), itemsAdded: added, assignedLocation: body.location || null };
    }

    case 'delete-menu': {
      assertNoLeadingDash(body.name, 'name');
      wpCli(webRoot, ['menu', 'delete', body.name]);
      return { deleted: body.name };
    }

    default:
      throw new Error(`Unknown edit-theme op: "${op}"`);
  }
}

// ── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/health') {
    return json(res, 200, { ok: true, domain: BASE_DOMAIN });
  }

  if (!timingSafeEqual(req.headers['x-secret'] || '', SECRET)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  try {
    // ── POST /provision ─────────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/provision') {
      const params = await readBody(req);
      const { callbackUrl, ...provisionParams } = params;
      json(res, 202, { ok: true, started: true });
      setImmediate(async () => {
        const tag = `[agent:${provisionParams.subdomain}]`;
        try {
          provision(provisionParams);
          if (callbackUrl) await httpPost(callbackUrl, { ok: true, subdomain: provisionParams.subdomain }, { 'X-Secret': SECRET }).catch(() => {});
        } catch (err) {
          console.error(`${tag} ✗ ${err.message}`);
          if (callbackUrl) await httpPost(callbackUrl, { ok: false, subdomain: provisionParams.subdomain, error: err.message }, { 'X-Secret': SECRET }).catch(() => {});
        }
      });
      return;
    }

    // ── POST /create-app-password ───────────────────────────────────────────
    if (req.method === 'POST' && url === '/create-app-password') {
      const { subdomain, appName = 'VibeDash' } = await readBody(req);
      assertSafeSubdomain(subdomain);
      const webRoot = path.join(SITES_ROOT, subdomain);
      const password = execFileSync(
        'wp', ['--allow-root', `--path=${webRoot}`, 'user', 'application-password', 'create', '1', appName, '--porcelain'],
        { encoding: 'utf8' }
      ).trim();
      return json(res, 200, { ok: true, password });
    }


    // ── POST /install-theme ──────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/install-theme') {
      const ALLOWED_THEMES = new Set(['astra', 'generatepress', 'kadence', 'blocksy', 'oceanwp']);
      const { subdomain, themeSlug } = await readBody(req);
      assertSafeSubdomain(subdomain);
      if (!themeSlug || !ALLOWED_THEMES.has(themeSlug)) return json(res, 400, { error: 'Invalid theme slug' });
      const webRoot = path.join(SITES_ROOT, subdomain);
      if (!fs.existsSync(path.join(webRoot, 'wp-load.php'))) return json(res, 404, { error: 'WordPress not found' });
      execFileSync(
        'wp', ['--allow-root', `--path=${webRoot}`, 'theme', 'install', themeSlug, '--activate'],
        { stdio: 'pipe', timeout: 60000 }
      );
      console.log(`[agent] install-theme ✓ ${subdomain} → ${themeSlug}`);
      return json(res, 200, { ok: true, themeSlug });
    }

    // ── POST /delete-site ───────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/delete-site') {
      const { subdomain } = await readBody(req);
      assertSafeSubdomain(subdomain);
      const slug    = subdomain.replace(/-/g, '_');
      const dbName  = `wp_${slug}`;
      const dbUser  = `wp_${slug.slice(0, 32)}`;
      const webRoot = path.join(SITES_ROOT, subdomain);
      const nginxConf    = `/etc/nginx/sites-available/${subdomain}.${BASE_DOMAIN}`;
      const nginxSymlink = `/etc/nginx/sites-enabled/${subdomain}.${BASE_DOMAIN}`;
      const mysql = (sql) => execFileSync('mysql', ['-e', sql], { stdio: 'pipe' });
      try { mysql(`DROP DATABASE IF EXISTS \`${dbName}\`;`); } catch(_) {}
      try { mysql(`DROP USER IF EXISTS '${dbUser}'@'localhost';`); } catch(_) {}
      if (fs.existsSync(webRoot))       fs.rmSync(webRoot, { recursive: true, force: true });
      if (fs.existsSync(nginxSymlink))  fs.unlinkSync(nginxSymlink);
      if (fs.existsSync(nginxConf))     fs.unlinkSync(nginxConf);
      try { execSync('nginx -s reload', { stdio: 'pipe' }); } catch(_) {}
      console.log(`[agent] delete-site ✓ ${subdomain}`);
      return json(res, 200, { ok: true });
    }

    // ── POST /create-static ─────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/create-static') {
      const { subdomain } = await readBody(req);
      assertSafeSubdomain(subdomain);
      const webroot      = path.join(STATIC_ROOT, subdomain);
      const nginxConf    = `/etc/nginx/sites-available/static-${subdomain}`;
      const nginxSymlink = `/etc/nginx/sites-enabled/static-${subdomain}`;
      fs.mkdirSync(webroot, { recursive: true });
      execFileSync('chown', ['-R', 'www-data:www-data', webroot]);
      fs.writeFileSync(nginxConf, staticNginxConf(subdomain));
      if (!fs.existsSync(nginxSymlink)) fs.symlinkSync(nginxConf, nginxSymlink);
      execSync('nginx -t', { stdio: 'pipe' });
      execSync('nginx -s reload', { stdio: 'pipe' });
      try {
        execSync(
          `certbot --nginx -d ${subdomain}.${BASE_DOMAIN} --non-interactive --agree-tos --email admin@${BASE_DOMAIN} --redirect --quiet`,
          { stdio: 'pipe' }
        );
        console.log(`[agent] create-static SSL ✓ ${subdomain}`);
      } catch (err) {
        console.error(`[agent] create-static certbot failed (non-fatal): ${err.message?.slice(0, 200)}`);
      }
      console.log(`[agent] create-static ✓ ${subdomain}`);
      return json(res, 200, { ok: true });
    }

    // ── POST /deploy-static-file ────────────────────────────────────────────
    if (req.method === 'POST' && url === '/deploy-static-file') {
      const { subdomain, path: filePath, content } = await readBody(req);
      assertSafeSubdomain(subdomain);
      if (!filePath || !content) return json(res, 400, { error: 'Missing fields' });
      const safe = filePath.replace(/\.\./g, '').replace(/^\/+/, '').replace(/\\/g, '/');
      if (!safe) return json(res, 400, { error: 'Invalid path' });
      const fullPath = path.join(STATIC_ROOT, subdomain, safe);
      if (!fullPath.startsWith(path.join(STATIC_ROOT, subdomain) + path.sep)) {
        return json(res, 400, { error: 'Path traversal detected' });
      }
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, Buffer.from(content, 'base64'));
      execFileSync('chown', ['-R', 'www-data:www-data', path.join(STATIC_ROOT, subdomain)]);
      return json(res, 200, { ok: true, path: safe });
    }

    // ── POST /get-static-file ───────────────────────────────────────────────
    if (req.method === 'POST' && url === '/get-static-file') {
      const { subdomain, path: filePath } = await readBody(req);
      assertSafeSubdomain(subdomain);
      if (!filePath) return json(res, 400, { error: 'Missing path' });
      const safe = filePath.replace(/\.\./g, '').replace(/^\/+/, '').replace(/\\/g, '/');
      const fullPath = path.join(STATIC_ROOT, subdomain, safe);
      if (!fullPath.startsWith(path.join(STATIC_ROOT, subdomain) + path.sep)) {
        return json(res, 400, { error: 'Path traversal detected' });
      }
      if (!fs.existsSync(fullPath)) return json(res, 404, { error: 'File not found on VPS' });
      const content = fs.readFileSync(fullPath);
      return json(res, 200, { content: content.toString('base64') });
    }

    // ── POST /delete-static-file ────────────────────────────────────────────
    if (req.method === 'POST' && url === '/delete-static-file') {
      const { subdomain, path: filePath } = await readBody(req);
      assertSafeSubdomain(subdomain);
      if (!filePath) return json(res, 400, { error: 'Missing path' });
      const safe = filePath.replace(/\.\./g, '').replace(/^\/+/, '').replace(/\\/g, '/');
      const fullPath = path.join(STATIC_ROOT, subdomain, safe);
      if (!fullPath.startsWith(path.join(STATIC_ROOT, subdomain) + path.sep)) {
        return json(res, 400, { error: 'Path traversal detected' });
      }
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      console.log(`[agent] delete-static-file ✓ ${subdomain}/${safe}`);
      return json(res, 200, { ok: true });
    }

    // ── POST /delete-static ─────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/delete-static') {
      const { subdomain } = await readBody(req);
      assertSafeSubdomain(subdomain);
      const webroot      = path.join(STATIC_ROOT, subdomain);
      const nginxConf    = `/etc/nginx/sites-available/static-${subdomain}`;
      const nginxSymlink = `/etc/nginx/sites-enabled/static-${subdomain}`;
      if (fs.existsSync(webroot))       fs.rmSync(webroot, { recursive: true, force: true });
      if (fs.existsSync(nginxSymlink))  fs.unlinkSync(nginxSymlink);
      if (fs.existsSync(nginxConf))     fs.unlinkSync(nginxConf);
      try { execSync('nginx -s reload', { stdio: 'pipe' }); } catch(_) {}
      console.log(`[agent] delete-static ✓ ${subdomain}`);
      return json(res, 200, { ok: true });
    }

    // ── POST /inject-chatbot ────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/inject-chatbot') {
      const { subdomain, publicKey, apiBase } = await readBody(req);
      assertSafeSubdomain(subdomain);
      assertNonEmpty(publicKey, 'publicKey');
      assertNonEmpty(apiBase, 'apiBase');
      if (!/^[A-Za-z0-9_]+$/.test(publicKey)) return json(res, 400, { error: 'Invalid publicKey' });
      if (!/^https?:\/\/[A-Za-z0-9.:/_-]+$/.test(apiBase)) return json(res, 400, { error: 'Invalid apiBase' });
      const webRoot = path.join(SITES_ROOT, subdomain);
      if (!fs.existsSync(path.join(webRoot, 'wp-load.php'))) return json(res, 404, { error: 'WordPress not found' });
      const muDir = path.join(webRoot, 'wp-content', 'mu-plugins');
      fs.mkdirSync(muDir, { recursive: true });
      const base = apiBase.replace(/\/+$/, '');
      const php = '<?php\n'
        + '/**\n'
        + ' * Plugin Name: VibeDash Chatbot\n'
        + ' * Description: Embeds the chat widget site-wide. Managed by VibeDash - do not edit.\n'
        + ' */\n'
        + "if (!defined('ABSPATH')) { exit; }\n"
        + "add_action('wp_footer', function () {\n"
        + '    $key  = ' + JSON.stringify(publicKey) + ';\n'
        + '    $base = ' + JSON.stringify(base) + ';\n'
        + '    printf(\n'
        + '        \'<script src="%s/chatbot-widget.js" data-bot-key="%s" data-api-base="%s" async></script>\',\n'
        + '        esc_url($base), esc_attr($key), esc_url($base)\n'
        + '    );\n'
        + '}, 99);\n';
      fs.writeFileSync(path.join(muDir, 'vibedash-chatbot.php'), php);
      try { execFileSync('chown', ['-R', 'www-data:www-data', muDir], { stdio: 'pipe' }); } catch (_) {}
      console.log(`[agent] inject-chatbot ✓ ${subdomain}`);
      return json(res, 200, { ok: true, url: `https://${subdomain}.${BASE_DOMAIN}/` });
    }

    // ── POST /remove-chatbot ────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/remove-chatbot') {
      const { subdomain } = await readBody(req);
      assertSafeSubdomain(subdomain);
      const muPlugin = path.join(SITES_ROOT, subdomain, 'wp-content', 'mu-plugins', 'vibedash-chatbot.php');
      if (fs.existsSync(muPlugin)) fs.unlinkSync(muPlugin);
      console.log(`[agent] remove-chatbot ✓ ${subdomain}`);
      return json(res, 200, { ok: true });
    }

    // ── POST /theme-info ────────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/theme-info') {
      const { subdomain } = await readBody(req);
      return json(res, 200, { ok: true, ...themeInfo(subdomain) });
    }

    // ── POST /edit-theme ────────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/edit-theme') {
      const body = await readBody(req);
      const { subdomain, op } = body;
      assertNonEmpty(op, 'op');
      const result = editTheme(subdomain, op, body);
      console.log(`[agent] edit-theme ✓ ${subdomain} op=${op}`);
      return json(res, 200, { ok: true, op, result });
    }

    res.writeHead(404); res.end('Not found');
  } catch (err) {
    console.error('[agent] error:', err.message);
    json(res, 500, { error: (err.message || '').slice(0, 300) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[agent] VibeDash VPS agent listening on port ${PORT} (domain: ${BASE_DOMAIN})`);
});
