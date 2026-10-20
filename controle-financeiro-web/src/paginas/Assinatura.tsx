import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { useAssinatura } from '../contextos/ContextoAssinatura';
import { chamarCobranca, cobrancaConfigurada, linkPagamento, rotuloPagamento } from '../servicos/servicoAssinatura';
import { formatarMoeda as moeda } from '../utilitarios/formatadores';
import '../assinatura.css';
import { VerificacaoDaConta } from '../componentes/VerificacaoDaConta';

export function Assinatura() {
  const { assinatura: a, carregando, erro, atualizar } = useAssinatura();
  const [blocos, definirBlocos] = useState(1);
  const [documento, definirDocumento] = useState('');
  const [aceito, aceitar] = useState(false);
  const [ocupado, ocupar] = useState(false);
  const [mensagem, informar] = useState('');
  const [url, definirUrl] = useState<string | undefined>();
  const ativo = cobrancaConfigurada && a?.enabled;
  const limite = 20 + blocos * 30;
  const preco = blocos * 20;
  async function contratar() {
    ocupar(true); informar(''); definirUrl(undefined);
    try {
      const resposta = await chamarCobranca<{ url: string | null; message?: string }>('/checkout', { blocks: blocos, cpfCnpj: documento, accepted: aceito });
      definirUrl(linkPagamento(resposta.url));
      informar(resposta.message || 'Cobrança pronta. Use o botão abaixo para pagar no Asaas.');
      await atualizar();
    } catch (e) { informar(e instanceof Error ? e.message : 'Não foi possível gerar a cobrança.'); }
    finally { ocupar(false); }
  }
  async function cancelar() {
    ocupar(true); informar('');
    try { await chamarCobranca('/cancel', {}); informar('Renovação cancelada. O acesso já pago permanece até o fim da validade.'); await atualizar(); }
    catch (e) { informar(e instanceof Error ? e.message : 'Não foi possível cancelar.'); }
    finally { ocupar(false); }
  }
  return <>
    <CabecalhoDaPagina titulo="Sua assinatura" descricao="Comece grátis. Amplie conforme precisar." comSeletorDeMes={false}
      acoes={<button className="botao" disabled={carregando || !cobrancaConfigurada} onClick={() => void atualizar()}>Atualizar situação</button>} />
    <VerificacaoDaConta />
    {!ativo && <div className="assinatura-aviso" role="status">A contratação ainda não está disponível. A integração de pagamentos está sendo configurada.</div>}
    {a?.environment === 'sandbox' && <div className="assinatura-aviso">Ambiente de testes: os pagamentos não têm valor real.</div>}
    {erro && <p role="alert" className="assinatura-aviso">{erro}</p>}
    <div className="assinatura-grid">
      <section className="assinatura-card">
        <span className="assinatura-selo">Seu consumo acumulado</span>
        <h2>{a ? `${a.count} de ${a.limit}` : 'Até 20 grátis'}</h2>
        <p>Inserções de receitas e despesas. A contagem não reinicia no mês; excluir um lançamento não devolve uma inserção.</p>
        {a && <progress value={Math.min(a.count, a.limit)} max={a.limit} aria-label="Inserções utilizadas" />}
        <dl className="assinatura-detalhes">
          <div><dt>Mensalidade contratada</dt><dd>{a ? moeda(a.monthlyPrice) : '—'}</dd></div>
          <div><dt>Acesso pago válido até</dt><dd>{a?.validUntil ? new Date(a.validUntil).toLocaleDateString('pt-BR') : 'Sem período pago ativo'}</dd></div>
          <div><dt>Renovação</dt><dd>{a?.subscriptionId && !a.canceled ? 'Mensal' : 'Sem renovação ativa'}</dd></div>
        </dl>
        {a?.admin && <p>Como administrador, você pode cadastrar lançamentos sem limite.</p>}
        {a?.subscriptionId && <details className="assinatura-cancelar"><summary>Cancelar renovação</summary>
          <p>As próximas mensalidades serão canceladas. Seu histórico permanece disponível e o limite volta a 20 após o fim do período pago.</p>
          <button className="botao" disabled={ocupado} onClick={() => void cancelar()}>Confirmar cancelamento</button>
        </details>}
      </section>
      <section className="assinatura-card assinatura-destaque">
        <span className="assinatura-selo">Escolha seu limite</span>
        <h2>{moeda(preco)}<small> / mês</small></h2>
        <p><strong>{limite} inserções acumuladas</strong> — 20 grátis + {blocos * 30} do plano.</p>
        <label className="assinatura-campo">Blocos de 30 inserções
          <input type="number" min="1" max="100" step="1" value={blocos} onChange={e => { definirBlocos(Math.min(100, Math.max(1, Math.trunc(Number(e.target.value) || 1)))); aceitar(false); }} />
        </label>
        <p className="texto-miudo">21–50: R$ 20/mês · 51–80: R$ 40/mês · 81–110: R$ 60/mês. Cada novo bloco acrescenta R$ 20 à mensalidade.</p>
        <label className="assinatura-campo">CPF ou CNPJ para cobrança
          <input autoComplete="off" inputMode="numeric" maxLength={18} value={documento} onChange={e => definirDocumento(e.target.value)} disabled={!ativo || ocupado} />
        </label>
        {a?.blocks && a.subscriptionId ? <p>Ao ampliar um plano ativo, você paga a diferença integral entre os planos para o restante do período. Na próxima renovação, será cobrado o novo valor mensal.</p> : null}
        <label className="assinatura-aceite"><input type="checkbox" checked={aceito} onChange={e => aceitar(e.target.checked)} disabled={!ativo || ocupado} />
          <span>Quero contratar {limite} inserções por {moeda(preco)} por mês, até cancelar a renovação.</span></label>
        <button className="botao botao-principal" disabled={!ativo || !aceito || ocupado || blocos <= (a?.blocks || 0)} onClick={() => void contratar()}>
          {ocupado ? 'Preparando…' : 'Continuar para pagamento'}
        </button>
        <p className="texto-miudo">O limite aumenta após a confirmação do pagamento. Dados do cartão são preenchidos no ambiente do Asaas.</p>
        <p className="texto-miudo"><Link to="/termos-de-uso">Termos, cancelamento e arrependimento</Link> · <Link to="/politica-de-privacidade">Privacidade</Link></p>
        {mensagem && <p role="status">{mensagem}</p>}
        {url && <a className="botao botao-principal" href={url} target="_blank" rel="noopener noreferrer">Abrir pagamento no Asaas ↗</a>}
      </section>
    </div>
    <section className="assinatura-card assinatura-historico"><h2>Histórico de pagamentos</h2>
      <div className="assinatura-tabela"><table><thead><tr><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Cobrança</th></tr></thead>
        <tbody>{a?.payments.map(p => <tr key={p.id}><td>{p.dueDate.split('-').reverse().join('/')}</td><td>{moeda(p.value)}</td>
          <td>{rotuloPagamento(p.status)}</td><td>{linkPagamento(p.url) ? <a href={linkPagamento(p.url)} target="_blank" rel="noopener noreferrer">Ver cobrança ↗</a> : '—'}</td></tr>)}</tbody></table></div>
      {!a?.payments.length && <p>Nenhum pagamento disponível.</p>}
    </section>
  </>;
}
