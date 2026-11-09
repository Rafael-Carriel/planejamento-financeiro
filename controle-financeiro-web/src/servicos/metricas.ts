import { auth } from '../firebase/config';
type Evento = 'landing_view' | 'signup_started' | 'signup_completed' | 'activation_completed' | 'return_visit';
const CHAVE = 'planeora-medicao-v1';
const base = (import.meta.env.VITE_BILLING_API_URL || '').replace(/\/$/, '');
export const metricasDisponiveis = import.meta.env.VITE_ANALYTICS_ENABLED === 'true' && Boolean(base);
export function escolhaMetricas(): string | null { try { return localStorage.getItem(CHAVE); } catch { return null; } }
export function escolherMetricas(aceitar: boolean) {
  try { localStorage.setItem(CHAVE, aceitar ? 'sim' : 'nao'); if (!aceitar) { localStorage.removeItem('planeora-visitante'); sessionStorage.removeItem('planeora-origem'); sessionStorage.removeItem('planeora-sessao'); sessionStorage.removeItem('planeora-eventos'); } } catch { /* Storage may be blocked. */ }
  window.dispatchEvent(new Event('planeora:metricas'));
}
export async function medir(name: Evento) {
  if (!metricasDisponiveis || escolhaMetricas() !== 'sim') return;
  try {
    const visitor = localStorage.getItem('planeora-visitante') || crypto.randomUUID(); localStorage.setItem('planeora-visitante', visitor);
    const session = sessionStorage.getItem('planeora-sessao') || crypto.randomUUID(); sessionStorage.setItem('planeora-sessao', session);
    const sent: string[] = JSON.parse(sessionStorage.getItem('planeora-eventos') || '[]');
    const key = `${name}:${auth.currentUser?.uid || 'guest'}`;
    if (sent.includes(key)) return;
    const params = new URLSearchParams(location.search);
    const clean = (v: string | null) => v && /^[a-zA-Z0-9_-]{1,60}$/.test(v) ? v : undefined;
    let campaign = JSON.parse(sessionStorage.getItem('planeora-origem') || '{}');
    if (!Object.keys(campaign).length) {
      campaign = { source: clean(params.get('utm_source')), medium: clean(params.get('utm_medium')), campaign: clean(params.get('utm_campaign')) };
      sessionStorage.setItem('planeora-origem', JSON.stringify(campaign));
    }
    const data = { consent: true, name, visitor, session, device: matchMedia('(max-width: 940px)').matches ? 'mobile' : 'desktop', ...campaign };
    const token = await auth.currentUser?.getIdToken();
    const appId = import.meta.env.VITE_BACK4APP_APP_ID || '', jsKey = import.meta.env.VITE_BACK4APP_JAVASCRIPT_KEY || '';
    const parse = Boolean(appId && jsKey);
    const response = await fetch(parse ? `${base}/functions/planejaEvent` : `${base}/billing/events`, {
      method: 'POST', headers: parse ? { 'Content-Type': 'application/json', 'X-Parse-Application-Id': appId, 'X-Parse-Javascript-Key': jsKey } : { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(parse ? { data, ...(token ? { firebaseToken: token } : {}) } : data), signal: AbortSignal.timeout(5000),
    });
    if (response.ok) { const result = await response.json(); if ((parse ? result.result : result)?.accepted) sessionStorage.setItem('planeora-eventos', JSON.stringify([...sent, key])); }
  } catch { /* Measurement must never interrupt signup or saving financial records. */ }
}
