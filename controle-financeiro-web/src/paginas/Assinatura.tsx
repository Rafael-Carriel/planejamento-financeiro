import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { VerificacaoDaConta } from '../componentes/VerificacaoDaConta';
import { useAssinatura } from '../contextos/ContextoAssinatura';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { chamarCobranca, cobrancaConfigurada, linkPagamento, rotuloPagamento } from '../servicos/servicoAssinatura';
import { formatarMoeda as moeda } from '../utilitarios/formatadores';
import { PLANO } from '../planos';
import { AssinaturaLegada } from './AssinaturaLegada';
import '../assinatura.css';

export function Assinatura() {
  const { assinatura: a, carregando, erro, atualizar } = useAssinatura();
  const { usuario } = useAutenticacao();
  const [documento, definirDocumento] = useState('');
  const [aceito, aceitar] = useState(false);
  const [ocupado, ocupar] = useState(false);
  const [mensagem, informar] = useState('');
  const [url, definirUrl] = useState<string>();
  const ativo = cobrancaConfigurada && a?.enabled && a.planVersion === PLANO.id;
  const contratado = Boolean(a?.subscriptionId && !a?.canceled);
  async function contratar() {
    if (ocupado || !aceito || !ativo) return;
    ocupar(true); informar('');
    try {
      const resposta = await chamarCobranca<{url: string | null; message?: string}>('/checkout', { planId: PLANO.id, cpfCnpj: documento, accepted: true });
      definirUrl(linkPagamento(resposta.url)); informar(resposta.message || 'Cobrança criada. Conclua no Asaas e volte para consultar a confirmação.'); await atualizar();
    } catch (e) { informar(e instanceof Error ? e.message : 'Não foi possível consultar a cobrança. Atualize a situação antes de tentar novamente.'); }
    finally { ocupar(false); }
  }
  async function consultar() {
    ocupar(true);
    try { await chamarCobranca('/sync', {}); await atualizar(); informar('Situação consultada. Pagamentos podem levar algum tempo para confirmar.'); }
    catch { informar('Não foi possível consultar agora. Sua cobrança foi preservada; tente novamente em instantes.'); }
    finally { ocupar(false); }
  }
  async function cancelar() {
    ocupar(true);
    try { await chamarCobranca('/cancel', {}); await atualizar(); informar('Renovação cancelada. O acesso já pago continua até a data informada.'); definirUrl(undefined); aceitar(false); }
    catch (e) { informar(e instanceof Error ? e.message : 'Não foi possível cancelar. Tente novamente ou fale com o suporte.'); }
    finally { ocupar(false); }
  }
  if (a?.legacy) return <><div className="assinatura-aviso">Você tem um plano anterior. Suas condições foram preservadas. Para contratar o Ilimitado por R$19,90/mês, cancele a renovação e aguarde o período pago terminar. <Link to="/atendimento">Preciso de ajuda</Link></div><AssinaturaLegada /></>;
  return <>
    <CabecalhoDaPagina titulo="Sua assinatura" descricao="Um preço fixo para organizar seu mês." comSeletorDeMes={false} acoes={<button className="botao" disabled={ocupado || carregando || !cobrancaConfigurada} onClick={() => void consultar()}>Atualizar situação</button>} />
    <div className="pagina pagina-assinatura"><VerificacaoDaConta />
      {erro && <p role="alert" className="assinatura-aviso">{erro}</p>}
      {a?.environment === 'sandbox' && <p className="assinatura-aviso">Ambiente de testes: pagamentos sem valor real.</p>}
      {!ativo && !carregando && !erro && <p role="status" className="assinatura-aviso">A contratação do novo plano ainda não está disponível. Consulte o suporte para mais informações.</p>}
      <section className="assinatura-card"><h2>{a?.admin ? 'Acesso de administrador' : a?.unlimited ? 'Ilimitado ativo' : 'Seu plano gratuito'}</h2>
        <p>{a?.unlimited || a?.admin ? 'Você pode registrar suas movimentações sem limite de lançamentos.' : `${a?.count ?? 0} de 20 lançamentos usados neste mês. A cota renova no primeiro dia do próximo mês, no horário de Brasília.`}</p>
        {!a?.unlimited && !a?.admin && <progress value={Math.min(a?.count ?? 0, 20)} max={20} aria-label="Lançamentos gratuitos utilizados no mês" />}
        <p>Seu histórico continua disponível para consulta, edição e exportação.</p>
        {a?.validUntil && <p>Acesso pago até {new Date(a.validUntil).toLocaleDateString('pt-BR')}.</p>}
        {contratado && <p>Renovação mensal: {moeda(a?.monthlyPrice ?? PLANO.preco)}. {a?.unlimited ? '' : 'Aguardando confirmação de pagamento.'}</p>}
        {a?.canceled && <p>Renovação cancelada. Ao terminar o período pago, volta a valer a cota gratuita do mês.</p>}
        {contratado && <details><summary>Cancelar renovação</summary><p>As próximas mensalidades serão canceladas. Seus registros permanecem acessíveis.</p><button className="botao botao-contorno" disabled={ocupado} onClick={() => void cancelar()}>Confirmar cancelamento</button></details>}
      </section>
      <section className="assinatura-card checkout-plano" aria-labelledby="titulo-contratacao">
        <div className="checkout-resumo"><span className="assinatura-selo">PLANEORA ILIMITADO</span><h2 id="titulo-contratacao">Registre sem contar lançamentos</h2><p className="checkout-preco">{moeda(PLANO.preco)}<span>por mês, até cancelar</span></p><ul><li>Receitas e despesas sem limite de registros</li><li>Planejamento, recorrências e objetivos</li><li>Relatórios e exportação do histórico</li><li>Mesma conta no celular e computador</li></ul><p>Registro manual, sem conexão bancária automática.</p></div>
        <div className="checkout-formulario"><h3>{contratado ? 'Sua contratação' : 'Revise sua contratação'}</h3>
          {contratado ? <p>Consulte a cobrança existente no histórico abaixo. Não é necessário contratar novamente para confirmar um pagamento.</p> : <>
            <label className="assinatura-campo">CPF ou CNPJ para cobrança<input inputMode="numeric" autoComplete="off" maxLength={18} value={documento} onChange={e => definirDocumento(e.target.value)} disabled={!ativo || ocupado || a?.admin} /></label>
            <label className="assinatura-aceite"><input type="checkbox" checked={aceito} onChange={e => aceitar(e.target.checked)} disabled={!ativo || ocupado || a?.admin} /><span>Quero contratar o Ilimitado por R$19,90/mês, com renovação mensal até cancelar.</span></label>
            <button className="botao botao-principal" disabled={!ativo || !aceito || ocupado || !usuario?.emailVerified || a?.admin} onClick={() => void contratar()}>{ocupado ? 'Consultando…' : 'Continuar para pagamento'}</button>
          </>}
          <p>O acesso é liberado após a confirmação. Dados do cartão são preenchidos somente no ambiente do Asaas.</p><Link to="/termos-de-uso">Termos, cancelamento e arrependimento</Link>
          {mensagem && <p role="status">{mensagem}</p>}{url && <a className="botao botao-principal" href={url} target="_blank" rel="noopener noreferrer">Abrir pagamento no Asaas ↗</a>}
        </div>
      </section>
      <section className="assinatura-card assinatura-historico"><h2>Histórico de pagamentos</h2><div className="assinatura-tabela"><table><thead><tr><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Cobrança</th></tr></thead><tbody>{a?.payments.map(p => <tr key={p.id}><td>{p.dueDate.split('-').reverse().join('/')}</td><td>{moeda(p.value)}</td><td>{rotuloPagamento(p.status)}</td><td>{linkPagamento(p.url) ? <a href={linkPagamento(p.url)} target="_blank" rel="noopener noreferrer">Ver cobrança ↗</a> : '—'}</td></tr>)}</tbody></table></div>{!a?.payments.length && <p>Nenhum pagamento disponível.</p>}</section>
    </div>
  </>;
}
