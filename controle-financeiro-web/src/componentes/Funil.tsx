import { useState } from 'react';
import { chamarCobranca } from '../servicos/servicoAssinatura';
type Dados = { enabled: boolean; totals: Record<string, number>; groups: Record<string, Record<string,number>>; truncated: boolean; notice: string; since: string };
const nomes: Record<string,string> = { landing_view:'Visitantes que permitiram medição',signup_started:'Início de cadastro (medido)',signup_completed:'Cadastro concluído (medido)',first_transaction_created:'Primeiro registro confirmado',return_visit:'Retorno autenticado (medido)',activation_completed:'Ativação em até 7 dias',subscription_paid:'Primeiro pagamento confirmado',subscription_renewed:'Renovações confirmadas',subscription_canceled:'Renovações canceladas' };
export function Funil() {
  const [dados, definir] = useState<Dados>(); const [erro, falhar] = useState(''); const [ocupado, ocupar] = useState(false);
  async function carregar() { ocupar(true); falhar(''); try { definir(await chamarCobranca<Dados>('/admin/funnel')); } catch { falhar('Não foi possível consultar o funil. Confira se a versão do servidor está atualizada.'); } finally { ocupar(false); } }
  return <section className="assinatura-card assinatura-historico"><h2>Aquisição e uso — últimos 30 dias</h2><p>Compare observações de uso com pagamentos confirmados. Usuários que recusam medição não aparecem nas visitas; não use essas contagens como taxa global de conversão.</p><button className="botao" disabled={ocupado} onClick={() => void carregar()}>{ocupado ? 'Consultando…' : 'Consultar funil'}</button>{erro && <p role="alert">{erro}</p>}{dados && <>
    {!dados.enabled && <p role="status">Medição opcional de visitas desativada no servidor.</p>}{dados.truncated && <p role="alert">Amostra limitada a 5.000 eventos. Exporte a base por uma rotina administrativa antes de tomar decisões de escala.</p>}
    <dl className="assinatura-detalhes">{Object.entries(nomes).map(([k,n]) => <div key={k}><dt>{n}</dt><dd>{dados.totals[k] || 0}</dd></div>)}</dl>
    <details><summary>Eventos por origem e campanha</summary><p>Pagamentos sem vínculo de campanha são exibidos sem atribuição; não associamos uma venda a um anúncio por suposição.</p><div className="assinatura-tabela"><table><thead><tr><th>Origem / campanha</th><th>Visitas</th><th>Cadastros medidos</th></tr></thead><tbody>{Object.entries(dados.groups).map(([k,v]) => <tr key={k}><td>{k}</td><td>{v.landing_view || 0}</td><td>{v.signup_completed || 0}</td></tr>)}</tbody></table></div></details><p>{dados.notice}</p>
  </>}</section>;
}
