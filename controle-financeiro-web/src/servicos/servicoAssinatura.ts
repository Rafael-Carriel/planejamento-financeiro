import { auth } from '../firebase/config';
import type { DadosDeTransacao } from '../tipos';

const base = (import.meta.env.VITE_BILLING_API_URL || '').replace(/\/$/, '');
const appId = import.meta.env.VITE_BACK4APP_APP_ID || '';
const javascriptKey = import.meta.env.VITE_BACK4APP_JAVASCRIPT_KEY || '';
const usaParse = Boolean(appId && javascriptKey);
export const cobrancaConfigurada = Boolean(base);

export interface Pagamento {
  id: string; uid: string; value: number; status: string; dueDate: string;
  billingType: string; url: string | null; blocks: number; updatedAt: string;
}
export interface Assinatura {
  enabled: boolean; environment: 'sandbox' | 'production'; usageMode: 'monthly' | 'lifetime';
  admin: boolean; count: number; period: string; blocks: number; limit: number;
  monthlyPrice: number; validUntil: string | null; subscriptionId: string | null;
  canceled: boolean; payments: Pagamento[];
}
export interface UsuarioAdministrado {
  uid: string; email: string; name: string; disabled: boolean; createdAt: string;
  lastSignIn: string | null; admin: boolean; count: number; blocks: number; limit: number;
  price: number; validUntil: string | null; canceled: boolean;
}

export async function chamarCobranca<T>(path: string, body?: unknown): Promise<T> {
  if (!base) throw new Error('A integração de pagamentos ainda não foi conectada.');
  const user = auth.currentUser;
  if (!user) throw new Error('Entre na sua conta para continuar.');
  const [resource, search] = path.split('?');
  const operations: Record<string, string> = { '/me': 'planejaMe', '/checkout': 'planejaCheckout', '/transactions': 'planejaCreateTransaction',
    '/cancel': 'planejaCancel', '/sync': 'planejaSync', '/admin/users': 'planejaAdminUsers', '/admin/payments': 'planejaAdminPayments',
    '/admin/asaas-status': 'planejaAsaasStatus' };
  const token = await user.getIdToken();
  const response = await fetch(usaParse ? `${base}/functions/${operations[resource]}` : `${base}/billing${path}`, {
    method: usaParse || body !== undefined ? 'POST' : 'GET',
    headers: usaParse ? { 'X-Parse-Application-Id': appId, 'X-Parse-Javascript-Key': javascriptKey, 'Content-Type': 'application/json' }
      : { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: usaParse ? JSON.stringify({ firebaseToken: token, data: body || {}, query: Object.fromEntries(new URLSearchParams(search)) })
      : body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível consultar a assinatura.');
  return (usaParse ? data.result : data) as T;
}

export async function criarTransacaoComCota(id: string, dados: DadosDeTransacao) {
  await chamarCobranca('/transactions', { id, data: { ...dados, data: dados.data.toISOString() } });
  window.dispatchEvent(new Event('planeja:consumo'));
}

export async function insercoesControladas(): Promise<boolean> {
  if (!cobrancaConfigurada) return false;
  return (await chamarCobranca<Assinatura>('/me')).enabled;
}

export function rotuloPagamento(status: string): string {
  return ({ PENDING: 'Aguardando pagamento', RECEIVED: 'Recebido', CONFIRMED: 'Confirmado',
    RECEIVED_IN_CASH: 'Recebido', OVERDUE: 'Vencido', REFUNDED: 'Estornado',
    REFUND_REQUESTED: 'Estorno solicitado', CHARGEBACK_REQUESTED: 'Pagamento contestado',
    CHARGEBACK_DISPUTE: 'Contestação em análise', AWAITING_CHARGEBACK_REVERSAL: 'Contestação em análise',
    DELETED: 'Cancelado', DUNNING_REQUESTED: 'Em recuperação', DUNNING_RECEIVED: 'Recuperado',
  } as Record<string, string>)[status] || 'Em análise';
}

export function linkPagamento(url: string | null): string | undefined {
  try {
    const parsed = new URL(url || '');
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port && ['asaas.com', 'www.asaas.com', 'sandbox.asaas.com'].includes(parsed.hostname) ? parsed.href : undefined;
  } catch { return undefined; }
}
