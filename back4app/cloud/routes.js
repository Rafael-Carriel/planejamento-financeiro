'use strict';
const { timingSafeEqual, randomUUID } = require('node:crypto');
const { FREE, BLOCK_SIZE, BLOCK_PRICE, blocks, period, monthAfter, entitlement, paid, validTransactionDate } = require('./policy');

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function safeEqual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function invoiceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && ['asaas.com', 'www.asaas.com', 'sandbox.asaas.com'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
function serialize(doc) {
  const data = doc.data();
  return { id: doc.id, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v?.toDate ? v.toDate().toISOString() : v])) };
}

function mount(app, { db, auth, asaas, env, now = () => new Date() }) {
  period(now(), env.USAGE_MODE); // Fail closed until the counting rule is configured.
  const admins = new Set((env.ADMIN_UIDS || '').split(',').map(x => x.trim()).filter(Boolean));
  const origins = new Set((env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean));
  const accounts = db.collection('billingAccounts');
  const orders = db.collection('billingOrders');
  const payments = db.collection('billingPayments');
  const config = db.doc('billingSystem/config');
  const route = handler => async (req, res, next) => {
    try { await handler(req, res); } catch (error) { next(error); }
  };
  const isAdmin = user => admins.has(user.uid);

  app.disable('x-powered-by');
  app.use('/billing', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (origin && !origins.has(origin)) return res.status(403).json({ error: 'Origem não autorizada.' });
    if (origin) { res.set('Access-Control-Allow-Origin', origin); res.vary('Origin'); }
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  if (typeof app.listen === 'function') app.use(require('express').json({ limit: '32kb' }));
  app.get('/billing/health', (_req, res) => res.json({ ok: true, environment: env.ASAAS_ENV }));

  async function requireUser(req, _res, next) {
    try {
      const match = /^Bearer (\S+)$/.exec(req.get('authorization') || '');
      if (!match) fail(401, 'Entre novamente para continuar.');
      req.user = await auth.verifyIdToken(match[1]);
      // Existing Back4App identity has Firestore access but no Firebase Auth Admin role.
      // Bind the first verified owner token to its immutable UID, without listing Auth accounts.
      if (env.ADMIN_EMAIL && req.user.email_verified === true && req.user.email?.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()) {
        const owner = db.doc('billingSystem/owner');
        const ownerMatches = await db.runTransaction(async tx => {
          const data = (await tx.get(owner)).data();
          if (!data) tx.create(owner, { uid: req.user.uid, email: env.ADMIN_EMAIL, createdAt: now() });
          else if (data.uid !== req.user.uid) return false;
          return true;
        });
        if (ownerMatches) admins.add(req.user.uid);
      }
      next();
    } catch { next(Object.assign(new Error('Entre novamente para continuar.'), { status: 401 })); }
  }
  function requireAdmin(req, _res, next) {
    if (!isAdmin(req.user)) return next(Object.assign(new Error('Acesso exclusivo do administrador.'), { status: 403 }));
    next();
  }
  async function requireActive() {
    const data = (await config.get()).data();
    if (!data?.enabled || data.usageMode !== env.USAGE_MODE) fail(503, 'A cobrança ainda não foi ativada.');
  }
  async function usage(uid) {
    const key = period(now(), env.USAGE_MODE);
    const ref = db.doc(`billingAccounts/${uid}/usage/${key}`);
    const settings = (await config.get()).data();
    if (!settings?.enabled) {
      // During setup, the legacy app can still insert directly. Do not freeze
      // an initial counter before the controlled write path is activated.
      const existing = await db.collection(`usuarios/${uid}/transacoes`).get();
      return { ref, key, count: existing.size };
    }
    // Existing records are counted once on activation, including records from the old app.
    await db.runTransaction(async tx => {
      const meter = await tx.get(ref);
      const activationId = settings.activationId || 'initial';
      if (meter.exists && meter.data().activationId === activationId) return;
      let query = db.collection(`usuarios/${uid}/transacoes`);
      if (env.USAGE_MODE === 'monthly') query = query.where('criadoEm', '>=', new Date(`${key}-01T00:00:00-03:00`));
      const existing = await tx.get(query);
      tx.set(ref, { count: Math.max(existing.size, meter.data()?.count || 0), period: key, activationId, updatedAt: now() });
    });
    return { ref, key, count: (await ref.get()).data().count };
  }
  async function status(user) {
    const [account, used, settings] = await Promise.all([accounts.doc(user.uid).get(), usage(user.uid), config.get()]);
    const data = account.data() || {};
    const quantity = entitlement(data, now());
    const recent = await payments.where('uid', '==', user.uid).get();
    return {
      enabled: settings.data()?.enabled === true && settings.data()?.usageMode === env.USAGE_MODE,
      environment: env.ASAAS_ENV, usageMode: env.USAGE_MODE, admin: isAdmin(user),
      count: used.count, period: used.key, blocks: quantity, limit: FREE + quantity * BLOCK_SIZE,
      monthlyPrice: (data.subscriptionBlocks || 0) * BLOCK_PRICE,
      validUntil: data.validUntil?.toDate?.().toISOString() || null,
      subscriptionId: data.subscriptionId || null, canceled: data.canceled === true,
      payments: recent.docs.map(serialize).sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate))).slice(0, 24),
    };
  }
  app.get('/billing/me', requireUser, route(async (req, res) => res.json(await status(req.user))));

  app.post('/billing/transactions', requireUser, route(async (req, res) => {
    await requireActive();
    const input = req.body;
    if (!input || typeof input.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(input.id)) fail(400, 'Identificador inválido.');
    const d = input.data;
    if (!d || typeof d.descricao !== 'string' || !d.descricao.trim() || d.descricao.trim().length > 120 ||
      !Number.isFinite(d.valor) || d.valor <= 0 || d.valor > 100000000 || !['entrada', 'saida'].includes(d.tipo) ||
      typeof d.categoria !== 'string' || !d.categoria.trim() || d.categoria.length > 60 ||
      !validTransactionDate(d.data) ||
      (d.observacao != null && (typeof d.observacao !== 'string' || d.observacao.length > 500)) ||
      (d.recorrenciaId != null && (typeof d.recorrenciaId !== 'string' || d.recorrenciaId.length > 64))) fail(400, 'Confira os dados do lançamento.');
    const used = await usage(req.user.uid);
    const ref = db.doc(`usuarios/${req.user.uid}/transacoes/${input.id}`);
    const accountRef = accounts.doc(req.user.uid);
    await db.runTransaction(async tx => {
      const [record, meter, account] = await Promise.all([tx.get(ref), tx.get(used.ref), tx.get(accountRef)]);
      if (record.exists) return; // Stable request ID: retries and recurrence replays do not consume twice.
      const count = meter.data().count;
      const limit = FREE + entitlement(account.data(), now()) * BLOCK_SIZE;
      if (!isAdmin(req.user) && count >= limit) fail(402, `Você chegou ao limite de ${limit} inserções. Abra Assinatura para liberar mais 30.`);
      tx.create(ref, { descricao: d.descricao.trim(), valor: d.valor, tipo: d.tipo, categoria: d.categoria,
        data: new Date(d.data), observacao: d.observacao?.trim() || null, recorrenciaId: d.recorrenciaId || null,
        criadoEm: now(), atualizadoEm: now() });
      tx.update(used.ref, { count: count + 1, updatedAt: now() });
      tx.set(accountRef, { lastActivityAt: now() }, { merge: true });
    });
    res.json({ ok: true });
  }));

  async function orderResult(order) {
    let payment;
    if (order.paymentId) payment = await asaas(`/payments/${encodeURIComponent(order.paymentId)}`);
    else if (order.subscriptionId) {
      const list = await asaas(`/subscriptions/${encodeURIComponent(order.subscriptionId)}/payments?limit=100`);
      payment = list.data?.find(p => !paid(p.status) && !p.deleted) || list.data?.[0];
    }
    if (payment) {
      await orders.doc(order.id).set({ paymentId: payment.id }, { merge: true });
      await syncPayment(payment);
    }
    return { orderId: order.id, url: invoiceUrl(payment?.invoiceUrl), pending: !payment, message: payment ? undefined : 'Cobrança em processamento. Atualize em alguns instantes.' };
  }

  app.post('/billing/checkout', requireUser, route(async (req, res) => {
    await requireActive();
    const quantity = blocks(req.body.blocks);
    if (req.body.accepted !== true) fail(400, 'Confirme a contratação mensal antes de continuar.');
    const user = { ...req.user, displayName: req.user.name || '' };
    if (!user.email_verified) fail(403, 'Confirme seu e-mail antes de contratar.');
    const uid = user.uid, ref = accounts.doc(uid), orderRef = orders.doc(randomUUID());
    let selected, first = false;
    await db.runTransaction(async tx => {
      first = false; // Firestore can retry this callback after a competing checkout commits.
      const data = (await tx.get(ref)).data() || {};
      if (data.pendingOrder) {
        const pending = await tx.get(orders.doc(data.pendingOrder));
        if (pending.exists && !['paid', 'canceled'].includes(pending.data().state)) {
          selected = { id: pending.id, ...pending.data() };
          if (selected.blocks !== quantity) fail(409, 'Conclua ou cancele a cobrança pendente antes de trocar o plano.');
          return;
        }
      }
      const current = entitlement(data, now());
      if (data.subscriptionId && quantity <= Math.max(current, data.subscriptionBlocks || 0)) fail(409, 'Esse plano já está contratado. Consulte as cobranças abaixo.');
      if (data.subscriptionId && !current) fail(409, 'Regularize a mensalidade pendente antes de aumentar o plano.');
      if (!data.customerId && !/^\d{11}$|^\d{14}$/.test(String(req.body.cpfCnpj || '').replace(/\D/g, ''))) fail(400, 'Informe um CPF ou CNPJ válido para a cobrança.');
      selected = { id: orderRef.id, uid, blocks: quantity, kind: data.subscriptionId ? 'upgrade' : 'subscription',
        value: (data.subscriptionId ? quantity - current : quantity) * BLOCK_PRICE, state: 'creating', createdAt: now(),
        acceptedAt: now(), termsVersion: '2026-10-20',
        basePaymentId: data.basePaymentId || null, validUntil: data.validUntil || null,
        customerId: data.customerId || null, existingSubscriptionId: data.subscriptionId || null };
      tx.create(orderRef, selected);
      tx.set(ref, { pendingOrder: orderRef.id, email: user.email || '', name: user.displayName || '' }, { merge: true });
      first = true;
    });
    if (!first) return res.json(await orderResult(await recoverOrder(selected)));
    // Persist each external ID before proceeding. Unknown network outcomes are recovered by externalReference, never blind POST retries.
    let customerId = selected.customerId;
    if (!customerId) {
      const found = await asaas(`/customers?externalReference=${encodeURIComponent(uid)}&limit=100`);
      const customer = found.data?.find(c => c.externalReference === uid && !c.deleted) || await asaas('/customers', 'POST', {
        name: user.displayName || user.email, email: user.email, cpfCnpj: String(req.body.cpfCnpj).replace(/\D/g, ''), externalReference: uid,
      });
      customerId = customer.id;
      await ref.set({ customerId }, { merge: true });
      await orderRef.set({ customerId }, { merge: true });
    }
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(now());
    if (selected.kind === 'subscription') {
      const subscription = await asaas('/subscriptions', 'POST', { customer: customerId, billingType: 'UNDEFINED',
        value: quantity * BLOCK_PRICE, nextDueDate: today, cycle: 'MONTHLY',
        description: `Planeora: ${FREE + quantity * BLOCK_SIZE} inserções — ${quantity * BLOCK_PRICE} reais/mês`, externalReference: selected.id });
      await orderRef.set({ subscriptionId: subscription.id, state: 'pending' }, { merge: true });
      await ref.set({ subscriptionId: subscription.id, subscriptionBlocks: quantity, canceled: false }, { merge: true });
    } else {
      const payment = await asaas('/payments', 'POST', { customer: customerId, billingType: 'UNDEFINED', value: selected.value,
        dueDate: today, description: `Planeora: ampliação para ${FREE + quantity * BLOCK_SIZE} inserções no período vigente`, externalReference: selected.id });
      await orderRef.set({ paymentId: payment.id, state: 'pending' }, { merge: true });
    }
    res.json(await orderResult({ id: selected.id, ...(await orderRef.get()).data() }));
  }));

  async function recoverOrder(order) {
    if (order.subscriptionId || order.paymentId) return order;
    const account = (await accounts.doc(order.uid).get()).data() || {};
    const customerId = order.customerId || account.customerId;
    if (!customerId) return order; // Customer creation outcome requires reconciliation, not a second charge.
    const path = order.kind === 'subscription' ? 'subscriptions' : 'payments';
    const list = await asaas(`/${path}?customer=${encodeURIComponent(customerId)}&externalReference=${encodeURIComponent(order.id)}&limit=100`);
    const found = list.data?.find(p => p.externalReference === order.id && !p.deleted);
    if (!found) return order;
    const patch = { [order.kind === 'subscription' ? 'subscriptionId' : 'paymentId']: found.id, customerId, state: 'pending' };
    await orders.doc(order.id).set(patch, { merge: true });
    if (order.kind === 'subscription') await accounts.doc(order.uid).set({ subscriptionId: found.id, subscriptionBlocks: order.blocks, canceled: false }, { merge: true });
    return { ...order, ...patch };
  }

  async function syncPayment(payment) {
    let order;
    if (payment.subscription) {
      // Stored bindings survive provider cancellation/deletion. A canceled
      // subscription may no longer be available from GET /subscriptions/id.
      const mappings = await orders.where('subscriptionId', '==', payment.subscription).limit(1).get();
      let candidate = mappings.docs[0];
      if (!candidate) {
        const subscription = await asaas(`/subscriptions/${encodeURIComponent(payment.subscription)}`);
        if (!/^[A-Za-z0-9_-]{1,200}$/.test(subscription.externalReference || '')) return;
        candidate = await orders.doc(subscription.externalReference).get();
        if (!candidate.exists) return;
        await orders.doc(candidate.id).set({ subscriptionId: payment.subscription }, { merge: true });
      }
      order = { id: candidate.id, ...candidate.data() };
      if (order.kind !== 'subscription') return;
      const currentAccount = (await accounts.doc(order.uid).get()).data() || {};
      // Historical payments must never reactivate a canceled or replaced subscription.
      if (!currentAccount.canceled && (currentAccount.subscriptionId === payment.subscription || currentAccount.pendingOrder === order.id)) {
        await accounts.doc(order.uid).set({ subscriptionId: payment.subscription, subscriptionBlocks: currentAccount.subscriptionBlocks || order.blocks }, { merge: true });
      }
    } else if (payment.externalReference && /^[A-Za-z0-9_-]{1,200}$/.test(payment.externalReference)) {
      const candidate = await orders.doc(payment.externalReference).get();
      if (!candidate.exists) return;
      order = { id: candidate.id, ...candidate.data() };
      if (order.kind !== 'upgrade') return;
    } else return;
    const accountRef = accounts.doc(order.uid);
    const account = (await accountRef.get()).data() || {};
    if (payment.customer !== (order.customerId || account.customerId)) fail(409, 'Cliente divergente na cobrança.');
    const quantity = order.kind === 'subscription' ? payment.value / BLOCK_PRICE : order.blocks;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100 ||
      (order.kind === 'upgrade' && payment.value !== order.value)) fail(409, 'Valor divergente na cobrança.');
    const until = order.kind === 'upgrade' ? order.validUntil : monthAfter(payment.dueDate);
    const refundedValue = (payment.refunds || []).filter(refund => refund.status === 'DONE')
      .reduce((total, refund) => total + Number(refund.value || 0), 0);
    const ref = payments.doc(payment.id);
    await db.runTransaction(async tx => {
      const [previous, existing] = await Promise.all([tx.get(ref), tx.get(payments.where('uid', '==', order.uid))]);
      const entry = { uid: order.uid, orderId: order.id, value: payment.value, blocks: quantity,
        kind: order.kind, basePaymentId: order.basePaymentId || null, validUntil: until,
        status: payment.deleted ? 'DELETED' : refundedValue >= payment.value ? 'REFUNDED' : payment.status,
        refundedValue, dueDate: payment.dueDate,
        billingType: payment.billingType, url: invoiceUrl(payment.invoiceUrl), updatedAt: now() };
      const all = existing.docs.filter(d => d.id !== payment.id).map(d => ({ id: d.id, ...d.data() }));
      all.push({ id: payment.id, ...entry });
      const bases = all.filter(p => p.kind === 'subscription' && paid(p.status) && new Date(p.validUntil?.toDate?.() || p.validUntil) > now());
      bases.sort((a, b) => new Date(b.validUntil?.toDate?.() || b.validUntil) - new Date(a.validUntil?.toDate?.() || a.validUntil));
      const base = bases[0];
      const extras = base ? all.filter(p => p.kind === 'upgrade' && p.basePaymentId === base.id && paid(p.status)) : [];
      tx.set(ref, entry);
      tx.set(accountRef, { blocks: base ? Math.max(base.blocks, ...extras.map(p => p.blocks)) : 0,
        validUntil: base?.validUntil || null, basePaymentId: base?.id || null, updatedAt: now(),
        ...(order.kind === 'upgrade' && paid(entry.status) && !paid(previous.data()?.status) ? { syncSubscriptionBlocks: order.blocks } : {}) }, { merge: true });
      if (paid(entry.status)) tx.set(orders.doc(order.id), { state: 'paid' }, { merge: true });
    });
    await syncSubscription(order.uid);
  }

  async function syncSubscription(uid) {
    const ref = accounts.doc(uid), account = (await ref.get()).data();
    if (!account?.syncSubscriptionBlocks || !account.subscriptionId || account.canceled) return;
    const quantity = Math.max(account.syncSubscriptionBlocks, account.subscriptionBlocks || 0);
    await asaas(`/subscriptions/${encodeURIComponent(account.subscriptionId)}`, 'PUT', {
      value: quantity * BLOCK_PRICE, updatePendingPayments: false,
      description: `Planeora: ${FREE + quantity * BLOCK_SIZE} inserções — ${quantity * BLOCK_PRICE} reais/mês`,
    });
    await ref.set({ subscriptionBlocks: quantity, syncSubscriptionBlocks: null }, { merge: true });
  }

  app.post('/billing/webhook', route(async (req, res) => {
    if (!safeEqual(req.get('asaas-access-token'), env.ASAAS_WEBHOOK_TOKEN)) fail(401, 'Webhook não autorizado.');
    const event = req.body;
    if (!event || typeof event.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(event.id)) fail(400, 'Evento inválido.');
    const eventRef = db.collection('billingEvents').doc(event.id);
    if ((await eventRef.get()).data()?.processed) return res.json({ ok: true });
    // Fetch authoritative status: a delayed PAYMENT_OVERDUE cannot undo a later payment.
    if (event.payment?.id && /^[A-Za-z0-9_-]{1,200}$/.test(event.payment.id)) {
      await syncPayment(await asaas(`/payments/${event.payment.id}`));
    }
    await eventRef.set({ event: String(event.event || ''), processed: true, processedAt: now() });
    res.json({ ok: true });
  }));

  app.post('/billing/cancel', requireUser, route(async (req, res) => {
    const ref = accounts.doc(req.user.uid);
    let account = (await ref.get()).data() || {};
    if (account.pendingOrder) {
      const pending = await orders.doc(account.pendingOrder).get();
      if (pending.exists && pending.data().state === 'creating') {
        const recovered = await recoverOrder({ id: pending.id, ...pending.data() });
        if (!recovered.paymentId && !recovered.subscriptionId) fail(409, 'A criação da cobrança ainda precisa de conciliação. Aguarde antes de cancelar ou contratar novamente.');
        account = (await ref.get()).data() || {};
      }
    }
    if (account.subscriptionId && !account.canceled) {
      await asaas(`/subscriptions/${encodeURIComponent(account.subscriptionId)}`, 'DELETE');
      await ref.set({ canceled: true, subscriptionBlocks: 0 }, { merge: true });
    }
    // Cancel only unpaid orders. Paid access remains until its expiry.
    if (account.pendingOrder) {
      const order = (await orders.doc(account.pendingOrder).get()).data();
      if (order?.paymentId) {
        const payment = await asaas(`/payments/${encodeURIComponent(order.paymentId)}`);
        if (!paid(payment.status) && !payment.deleted) await asaas(`/payments/${encodeURIComponent(order.paymentId)}`, 'DELETE');
      }
      await orders.doc(account.pendingOrder).set({ state: 'canceled' }, { merge: true });
    }
    await ref.set({ subscriptionId: null, pendingOrder: null }, { merge: true });
    res.json({ ok: true });
  }));

  app.get('/billing/admin/users', requireUser, requireAdmin, route(async (req, res) => {
    let query = db.collection('usuarios').orderBy('__name__').limit(50);
    if (typeof req.query.cursor === 'string') query = query.startAfter(req.query.cursor);
    const page = await query.get();
    const users = await Promise.all(page.docs.map(async document => {
      const profile = document.data();
      const user = { uid: document.id, email: profile.email || '', displayName: profile.nome || '' };
      const [account, used] = await Promise.all([accounts.doc(user.uid).get(), usage(user.uid)]);
      const data = account.data() || {};
      return { uid: user.uid, email: user.email, name: user.displayName, disabled: false,
        createdAt: profile.criadoEm?.toDate?.().toISOString() || null, lastSignIn: null,
        admin: isAdmin(user), count: used.count, blocks: entitlement(data, now()),
        limit: FREE + entitlement(data, now()) * BLOCK_SIZE, price: (data.subscriptionBlocks || 0) * BLOCK_PRICE,
        validUntil: data.validUntil?.toDate?.().toISOString() || null, canceled: data.canceled === true };
    }));
    res.json({ users, nextCursor: page.size === 50 ? page.docs.at(-1).id : null });
  }));
  app.get('/billing/admin/asaas-status', requireUser, requireAdmin, route(async (_req, res) => {
    // Connectivity alone does not establish that Asaas has approved this account.
    // Return only approval states, never documents, identity data or credentials.
    const status = await asaas('/myAccount/status');
    const allowed = new Set(['APPROVED', 'PENDING', 'AWAITING_APPROVAL', 'REJECTED']);
    const account = Object.fromEntries(['general', 'commercialInfo', 'documentation', 'bankAccountInfo']
      .map(field => [field, allowed.has(status[field]) ? status[field] : 'UNKNOWN']));
    res.json({ connected: true, environment: env.ASAAS_ENV, account });
  }));
  app.post('/billing/admin/activate', requireUser, requireAdmin, route(async (_req, res) => {
    await config.set({ enabled: true, usageMode: 'lifetime', activationId: randomUUID(), updatedAt: now() });
    res.json({ ok: true });
  }));
  app.post('/billing/sync', requireUser, route(async (req, res) => {
    const ref = accounts.doc(req.user.uid);
    const allowed = await db.runTransaction(async tx => {
      const data = (await tx.get(ref)).data() || {};
      const last = data.lastSyncAt?.toDate?.() || data.lastSyncAt;
      if (last && new Date(last).getTime() > now().getTime() - 60000) return false;
      tx.set(ref, { lastSyncAt: now() }, { merge: true });
      return true;
    });
    if (allowed) await syncAccount(await ref.get());
    res.json({ ok: true });
  }));

  async function syncAccount(account) {
    const data = account.data() || {};
    if (data.pendingOrder) {
      const doc = await orders.doc(data.pendingOrder).get();
      if (doc.exists && !['paid', 'canceled'].includes(doc.data().state)) await orderResult(await recoverOrder({ id: doc.id, ...doc.data() }));
    }
    if (data.subscriptionId) {
      let offset = 0;
      while (true) {
        const list = await asaas(`/subscriptions/${encodeURIComponent(data.subscriptionId)}/payments?limit=100&offset=${offset}`);
        for (const p of list.data || []) await syncPayment(p);
        if (!list.hasMore) break;
        offset += 100;
        if (offset >= 1000) fail(503, 'O histórico precisa de revisão administrativa.');
      }
    }
    if (!data.subscriptionId && data.basePaymentId) await syncPayment(await asaas(`/payments/${encodeURIComponent(data.basePaymentId)}`));
    const upgrades = await payments.where('uid', '==', account.id).get();
    for (const doc of upgrades.docs) {
      const p = doc.data();
      if (p.kind === 'upgrade' && new Date(p.validUntil?.toDate?.() || p.validUntil) > now()) {
        await syncPayment(await asaas(`/payments/${encodeURIComponent(doc.id)}`));
      }
    }
    await syncSubscription(account.id);
  }
  app.get('/billing/admin/payments', requireUser, requireAdmin, route(async (req, res) => {
    // Firestore's single-field index already includes the document ID as a
    // tie-breaker. Explicit opposite ID ordering would require a new index.
    let query = payments.orderBy('updatedAt', 'desc').limit(50);
    if (typeof req.query.cursor === 'string') {
      const doc = await payments.doc(req.query.cursor).get();
      if (!doc.exists) fail(400, 'Página inválida.');
      query = query.startAfter(doc);
    }
    const result = await query.get();
    res.json({ payments: result.docs.map(serialize), nextCursor: result.size === 50 ? result.docs.at(-1).id : null });
  }));

  async function reconcile() {
    // Rotate through all accounts, so larger installations do not starve at the first page.
    const cursorRef = db.doc('billingSystem/reconcile');
    const state = (await cursorRef.get()).data() || {};
    let query = accounts.orderBy('__name__').limit(25);
    if (state.cursor) query = query.startAfter(state.cursor);
    const page = await query.get();
    let failures = 0;
    for (const account of page.docs) {
      try {
        await syncAccount(account);
      } catch { failures++; }
    }
    await cursorRef.set({ cursor: page.size === 25 ? page.docs.at(-1).id : null, lastRunAt: now(), failures });
    if (failures) throw new Error(`${failures} conta(s) precisam de nova conciliação. Consulte os registros e execute o job novamente.`);
    return { processed: page.size };
  }
  app.use('/billing', (error, _req, res, _next) => {
    const code = Number(error.status) || 500;
    if (code >= 500) console.error('Billing request failed:', error.code || error.name || 'Error');
    res.status(code).json({ error: code === 500 ? 'Não foi possível concluir. Tente novamente.' : error.message });
  });
  return { reconcile, syncPayment };
}
module.exports = { mount, safeEqual, invoiceUrl };
