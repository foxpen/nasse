import { createHmac, timingSafeEqual } from 'node:crypto';
import { json } from './http.js';

const COOKIE = 'nase_auth';
const DAY = 60 * 60 * 24;
const SESSION_TTL = DAY;
const REMEMBER_TTL = DAY * 180;

const envPassword = () => process.env.NASE_PASSWORD || process.env.APP_PASSWORD || '';
const envSecret = () => process.env.AUTH_SECRET || process.env.NASE_AUTH_SECRET || envPassword();

const b64 = value => Buffer.from(value).toString('base64url');
const unb64 = value => Buffer.from(value, 'base64url').toString('utf8');

function sign(payload) {
  return createHmac('sha256', envSecret()).update(payload).digest('base64url');
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const i = part.indexOf('=');
        return i === -1 ? [part, ''] : [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
      })
  );
}

function secureAttr(event) {
  const host = event.headers?.host || event.headers?.Host || '';
  return /localhost|127\.0\.0\.1/.test(host) ? '' : '; Secure';
}

function same(value, expected) {
  const a = Buffer.from(String(value));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function makeToken(remember = false) {
  const ttl = remember ? REMEMBER_TTL : SESSION_TTL;
  const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttl });
  const encoded = b64(payload);
  return { token: `${encoded}.${sign(encoded)}`, ttl: remember ? ttl : null };
}

export function authCookie(event, token, ttl) {
  const maxAge = ttl ? `; Max-Age=${ttl}` : '';
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${maxAge}${secureAttr(event)}`;
}

export function clearAuthCookie(event) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureAttr(event)}`;
}

export function isAuthenticated(event) {
  if (!envPassword() || !envSecret()) return false;
  const raw = event.headers?.cookie || event.headers?.Cookie || '';
  const token = parseCookies(raw)[COOKIE];
  if (!token || !token.includes('.')) return false;
  const [payload, mac] = token.split('.');
  if (!same(mac, sign(payload))) return false;
  try {
    const data = JSON.parse(unb64(payload));
    return Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function checkPassword(password) {
  const configured = envPassword();
  return configured && same(password, configured);
}

export function requireAuth(event) {
  return isAuthenticated(event) ? null : json(401, { error: 'unauthorized' });
}
