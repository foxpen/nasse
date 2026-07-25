import { requireAuth } from './_lib/auth.js';
import { json, preflight } from './_lib/http.js';

const CNB_URL = 'https://www.cnb.cz/en/financial-markets/foreign-exchange-market/central-bank-exchange-rate-fixing/central-bank-exchange-rate-fixing/daily.txt';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const unauthorized = requireAuth(event);
  if (unauthorized) return unauthorized;
  try {
    const res = await fetch(CNB_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const dateMatch = lines[0]?.match(/^(\d{1,2} \w{3} \d{4})/);
    const eurLine = lines.find(l => l.split('|')[3] === 'EUR');
    if (!eurLine) throw new Error('EUR row not found in ČNB feed');
    const parts = eurLine.split('|');
    const amount = Number(parts[2]) || 1;
    const rate = Number(parts[4]);
    if (!rate) throw new Error('invalid rate parsed');
    return json(200, { rate: Math.round((rate / amount) * 1000) / 1000, date: dateMatch ? dateMatch[1] : null });
  } catch (e) {
    return json(200, { rate: null, date: null, error: String(e?.message || e) });
  }
}
