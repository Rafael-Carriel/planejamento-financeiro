'use strict';

function client(env) {
  const base = env.ASAAS_ENV === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
  if (!['sandbox', 'production'].includes(env.ASAAS_ENV) || !env.ASAAS_API_KEY) {
    throw new Error('Configure ASAAS_ENV e ASAAS_API_KEY no servidor.');
  }
  return async function asaas(path, method = 'GET', body) {
    const response = await fetch(base + path, {
      method, redirect: 'error', headers: { access_token: env.ASAAS_API_KEY, 'Content-Type': 'application/json', 'User-Agent': 'Planeora/1.0' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    if (method === 'DELETE' && response.status === 404) return {};
    if (!response.ok) {
      // Never echo gateway responses: they can contain customer information.
      throw Object.assign(new Error('Não foi possível concluir a operação no Asaas. Tente novamente.'), { status: 502 });
    }
    return response.status === 204 ? {} : response.json();
  };
}

module.exports = { client };
