// Disposable test mailboxes through the mail.tm REST API (user decision 22 Nov 2026): invitation e-mails are read through
// the API, so activation needs no browser mailbox and no human check (YOPmail shows a Cloudflare check to automation).
// Only test addresses created here are used; nothing else is sent to the service.
//
//   const inbox = await createMailbox('e2e2611221930');          // { address, password, token }
//   const link = await waitForLink(inbox, /Accept Invite/i);      // href of the "Accept Invite" link
//
// Mailboxes created in this process are remembered by address (mailboxFor), so the activation step can find the
// mailbox of an invited user from its e-mail alone. The service limits requests per second: calls are paced.
const BASE = process.env.SCP_MAILTM_URL || 'https://api.mail.tm';
const registry = new Map();
let last = 0;
const pace = async () => { const wait = last + 1500 - Date.now(); if (wait > 0) await new Promise(r => setTimeout(r, wait)); last = Date.now(); };

async function call(path, { method = 'GET', token, body, attempts = 6 } = {}) {
  for (let i = 1; ; i++) {
    await pace();
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    if (res.ok) return text ? JSON.parse(text) : null;
    if (i >= attempts || ![429, 500, 502, 503, 504].includes(res.status)) throw new Error(`mail.tm ${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
    await new Promise(r => setTimeout(r, 2000 * i));
  }
}

// The domain lookup is what the service rate-limits most (22 Nov 2026: two runs got no domain), so the last known domain
// is kept in reports/.mailtm-domain and only looked up again when it is missing or mailbox creation with it fails.
const fs = require('fs');
const path = require('path');
const DOMAIN_FILE = path.join(__dirname, '..', 'reports', '.mailtm-domain');
let cachedDomain = null;
async function domain({ refresh = false } = {}) {
  if (!refresh && cachedDomain) return cachedDomain;
  if (!refresh) { try { const d = fs.readFileSync(DOMAIN_FILE, 'utf8').trim(); if (d) return (cachedDomain = d); } catch (e) { /* not stored yet */ } }
  for (let i = 1; i <= 5; i++) {
    const list = ((await call('/domains').catch(() => null)) || {})['hydra:member'] || [];
    const active = list.find(d => d.isActive && !d.isPrivate) || list.find(d => d.isActive);
    if (active) {
      cachedDomain = active.domain;
      try { fs.mkdirSync(path.dirname(DOMAIN_FILE), { recursive: true }); fs.writeFileSync(DOMAIN_FILE, cachedDomain); } catch (e) { /* cache only */ }
      return cachedDomain;
    }
    await new Promise(r => setTimeout(r, 5000 * i));
  }
  throw new Error('mail.tm offers no active domain (5 attempts)');
}

// Creates a mailbox "<prefix><random>@<mail.tm domain>" (lower case, letters and digits only) and signs in to it.
async function createMailbox(prefix = 'scp') {
  const local = `${String(prefix).toLowerCase().replace(/[^a-z0-9]/g, '')}${Math.random().toString(36).slice(2, 7)}`;
  const password = `Mt${Math.random().toString(36).slice(2, 12)}!7`;
  let address = `${local}@${await domain()}`;
  try {
    await call('/accounts', { method: 'POST', body: { address, password } });
  } catch (error) {
    // The stored domain may have been retired: look it up again once and retry.
    address = `${local}@${await domain({ refresh: true })}`;
    await call('/accounts', { method: 'POST', body: { address, password } });
  }
  const { token } = await call('/token', { method: 'POST', body: { address, password } });
  const inbox = { address, password, token };
  registry.set(address.toLowerCase(), inbox);
  return inbox;
}

const mailboxFor = address => registry.get(String(address || '').toLowerCase()) || null;
const isMailtmAddress = address => registry.has(String(address || '').toLowerCase());

// Polls the inbox until a message matches (subject or intro), then returns the full message (html + text).
// Default wait 3 min: shorter than the E2E's 5-minute no-progress limit, so a caller's fallback always gets its turn.
async function waitForMessage(inbox, match = /./, { timeoutMs = Number(process.env.SCP_INVITE_DELIVERY_MS || 180000), everyMs = 10000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let seen = [];
  while (Date.now() < deadline) {
    const list = (await call('/messages', { token: inbox.token }))['hydra:member'] || [];
    seen = list.map(m => m.subject);
    const hit = list.find(m => match.test(`${m.subject} ${m.intro || ''}`));
    if (hit) return call(`/messages/${hit.id}`, { token: inbox.token });
    await new Promise(r => setTimeout(r, everyMs));
  }
  throw new Error(`mail.tm: no message matching ${match} for ${inbox.address} within ${Math.round(timeoutMs / 1000)} s${seen.length ? ` (received: ${seen.join(' | ')})` : ' (inbox empty)'}`);
}

// Returns the href of the first link whose visible text matches `text` (e.g. /Accept Invite/i) in the message HTML.
function linkIn(message, text) {
  const html = [].concat(message.html || []).join('\n');
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.test(label)) return m[1].replace(/&amp;/g, '&');
  }
  return null;
}

async function waitForLink(inbox, text = /Accept Invite/i, options) {
  const message = await waitForMessage(inbox, /invit/i, options);
  const href = linkIn(message, text);
  if (!href) throw new Error(`mail.tm: message "${message.subject}" for ${inbox.address} has no link matching ${text}`);
  return { href, subject: message.subject };
}

module.exports = { createMailbox, mailboxFor, isMailtmAddress, waitForMessage, waitForLink, linkIn };
