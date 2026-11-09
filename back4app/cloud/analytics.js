'use strict';
const { createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
const EVENTS = new Set(['landing_view', 'signup_started', 'signup_completed', 'return_visit']);
const LABEL = /^[a-zA-Z0-9_-]{1,60}$/;

// Anonymous observations are consented, best-effort measurements, never billing evidence.
function mountAnalytics(app, { db, auth, env, now, requireUser, requireAdmin, route, fail }) {
  const windows = new Map();
  app.post('/billing/events', route(async (req, res) => {
    if (env.ANALYTICS_ENABLED !== 'true') return res.json({ accepted: false });
    const input = req.body;
    if (!input || input.consent !== true || !EVENTS.has(input.name) || !/^[a-f0-9-]{36}$/i.test(input.visitor || '') ||
      !/^[a-f0-9-]{36}$/i.test(input.session || '') || !['mobile', 'desktop'].includes(input.device) ||
      Object.keys(input).some(k => !['consent','name','visitor','session','device','campaign','source','medium'].includes(k))) fail(400, 'Evento inválido.');
    for (const k of ['campaign','source','medium']) if (input[k] && !LABEL.test(input[k])) fail(400, 'Identificador de campanha inválido.');
    const minute = Math.floor(now().getTime() / 60000);
    const ipKey = hash(String(req.ip || 'unknown'));
    if (windows.size > 1000) windows.clear();
    const window = windows.get(ipKey);
    const count = window?.minute === minute ? window.count + 1 : 1;
    windows.set(ipKey, { minute, count });
    if (count > 60) fail(429, 'Aguarde antes de enviar outro evento.');
    const token = /^Bearer (\S+)$/.exec(req.get('authorization') || '')?.[1];
    let uid;
    if (token) { try { uid = (await auth.verifyIdToken(token)).uid; } catch { fail(401, 'Sessão inválida.'); } }
    if (!['landing_view', 'signup_started'].includes(input.name) && !uid) fail(401, 'Sessão necessária.');
    const visitor = hash(input.visitor), day = now().toISOString().slice(0,10);
    const id = hash(input.name === 'signup_completed' ? `${uid}:signup_completed` : `${visitor}:${input.session}:${input.name}`);
    const ref = db.doc(`productEvents/${id}`), meter = db.doc(`productEventLimits/${visitor}-${day}`);
    await db.runTransaction(async tx => {
      const accountRef = uid ? db.doc(`billingAccounts/${uid}`) : null;
      const [existing, used, account] = await Promise.all([tx.get(ref), tx.get(meter), accountRef ? tx.get(accountRef) : null]);
      if (existing.exists) return;
      if ((used.data()?.count || 0) >= 40) fail(429, 'Limite diário de medições atingido.');
      const expiresAt = new Date(now().getTime() + 90 * 86400000);
      tx.create(ref, { name: input.name, visitor, actor: uid ? hash(uid) : null, device: input.device,
        campaign: input.campaign || 'direct', source: input.source || 'direct', medium: input.medium || 'none',
        consentVersion: '2026-11-07', createdAt: now(), expiresAt, origin: 'browser' });
      tx.set(meter, { count: (used.data()?.count || 0) + 1, expiresAt });
      const first = account?.data()?.firstTransactionAt;
      const firstDate = first ? new Date(first.toDate?.() || first) : null;
      const localDay = date => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(date);
      if (accountRef && input.name === 'return_visit' && firstDate && account.data().totalCreated >= 3 &&
        localDay(firstDate) !== localDay(now()) && now() - firstDate <= 7 * 86400000 && !account.data().activatedAt) {
        tx.set(accountRef, { activatedAt: now() }, { merge: true });
        tx.set(db.doc(`productEvents/activation-${hash(uid)}`), { name: 'activation_completed', actor: hash(uid), origin: 'server', createdAt: now(), expiresAt });
      }
    });
    res.json({ accepted: true });
  }));
  app.get('/billing/admin/funnel', requireUser, requireAdmin, route(async (_req, res) => {
    const since = new Date(now().getTime() - 30 * 86400000);
    const result = await db.collection('productEvents').where('createdAt', '>=', since).limit(5001).get();
    const groups = {}, totals = {}, seen = new Set();
    for (const doc of result.docs.slice(0,5000)) {
      const e = doc.data();
      const group = `${e.source || 'direct'} / ${e.campaign || 'direct'}`;
      groups[group] ||= {};
      const unique = `${e.name}:${e.origin === 'server' ? doc.id : e.visitor || e.actor}`;
      if (seen.has(unique)) continue;
      seen.add(unique);
      totals[e.name] = (totals[e.name] || 0) + 1;
      groups[group][e.name] = (groups[group][e.name] || 0) + 1;
    }
    res.json({ enabled: env.ANALYTICS_ENABLED === 'true', since: since.toISOString(), totals, groups, truncated: result.size > 5000,
      notice: 'Eventos do navegador incluem apenas consentimentos e não provam receita. Pagamentos confirmados vêm do servidor. Contagens por campanha não representam atribuição causal.' });
  }));
}
module.exports = { mountAnalytics, hash };
