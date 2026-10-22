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
  function escolherPlano(valor:number) { definirBlocos(valor); aceitar(false); informar(''); definirUrl(undefined); }
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
    <div className="pagina pagina-assinatura"><VerificacaoDaConta />
    {!ativo && <div className="assinatura-aviso" role="status">A contratação ainda não está disponível. A integração de pagamentos está sendo configurada.</div>}
    {a?.environment === 'sandbox' && <div className="assinatura-aviso">Ambiente de testes: os pagamentos não têm valor real.</div>}
    {erro && <p role="alert" className="assinatura-aviso">{erro}</p>}
    <div className="assinatura-resumo">
      <section className="assinatura-card">
        <span className="assinatura-selo">Seu consumo acumulado</span>
        <h2>{a?.admin ? 'Sem limite de inserções' : a ? `${a.count} de ${a.limit}` : 'Até 20 grátis'}</h2>
        <p>Inserções de receitas e despesas. A contagem não reinicia no mês; excluir um lançamento não devolve uma inserção.</p>
        {a && !a.admin && <progress value={Math.min(a.count, a.limit)} max={a.limit} aria-label="Inserções utilizadas" />}
        {a?.subscriptionId ? <dl className="assinatura-detalhes">
          <div><dt>Mensalidade contratada</dt><dd>{a ? moeda(a.monthlyPrice) : '—'}</dd></div>
          <div><dt>Acesso pago válido até</dt><dd>{a?.validUntil ? new Date(a.validUntil).toLocaleDateString('pt-BR') : 'Sem período pago ativo'}</dd></div>
          <div><dt>Renovação</dt><dd>{a?.subscriptionId && !a.canceled ? 'Mensal' : 'Sem renovação ativa'}</dd></div>
        </dl> : <p>Sem mensalidade contratada ou renovação ativa.</p>}
        {a?.admin && <p>Você tem acesso de administrador. {a.count} inserções contabilizadas, sem necessidade de contratar um plano.</p>}
        {a?.subscriptionId && <details className="assinatura-cancelar"><summary>Cancelar renovação</summary>
          <p>As próximas mensalidades serão canceladas. Seu histórico permanece disponível e o limite volta a 20 após o fim do período pago.</p>
          <button className="botao" disabled={ocupado} onClick={() => void cancelar()}>Confirmar cancelamento</button>
        </details>}
      </section>
    </div>
    <section className="secao-planos" aria-labelledby="titulo-planos">
      <div className="planos-introducao"><span className="assinatura-selo">PLANOS PLANEORA</span><h2 id="titulo-planos">Um plano para cada momento</h2><p>Escolha a capacidade total para seus lançamentos. Os valores abaixo são mensais.</p></div>
      <div className="planos-grade" role="group" aria-label="Escolha seu plano">
        <article className="plano-card plano-gratis"><span className="plano-nome">Gratuito</span><p className="plano-preco">R$ 0<small> / mês</small></p><h3>20 inserções</h3><p>Para começar a organizar suas finanças.</p><ul><li>Receitas e despesas</li><li>Painel e relatórios</li><li>Sem mensalidade</li></ul><span className="plano-gratis-legenda">Incluído em todos os planos</span></article>
        {[{nome:'Essencial',blocos:1},{nome:'Mais',blocos:2},{nome:'Completo',blocos:3}].map(plano=><button type="button" className={`plano-card plano-opcao${blocos===plano.blocos?' selecionado':''}`} key={plano.blocos} aria-pressed={blocos===plano.blocos} aria-label={`Plano ${plano.nome}: ${20+plano.blocos*30} inserções por ${moeda(plano.blocos*20)} por mês`} onClick={()=>escolherPlano(plano.blocos)} disabled={ocupado}>
          <span className="plano-topo"><span className="plano-nome">{plano.nome}</span><span className="plano-radio" aria-hidden="true">{blocos===plano.blocos?'✓':''}</span></span>
          <span className="plano-preco">{moeda(plano.blocos*20)}<small> / mês</small></span><span className="plano-capacidade">{20+plano.blocos*30} inserções</span><span className="plano-descricao">20 gratuitas + {plano.blocos*30} do plano</span>
          <span className="plano-vantagens">Receitas, despesas e relatórios<br/>Histórico sempre acessível<br/>Cancele a renovação quando quiser</span><span className="plano-escolha">{blocos===plano.blocos?'Plano selecionado':'Selecionar plano'}</span>
        </button>)}
      </div>
      <details className="planos-personalizar" open={blocos>3||undefined}><summary>Precisa de mais de 110 inserções?</summary><label className="assinatura-campo">Capacidade do plano<select value={blocos<=3?'':blocos} onChange={e=>{if(e.target.value)escolherPlano(Number(e.target.value));}} disabled={ocupado}><option value="" disabled>Escolha a capacidade</option>{Array.from({length:97},(_,i)=>i+4).map(n=><option value={n} key={n}>{20+n*30} inserções — {moeda(n*20)}/mês</option>)}</select></label></details>
      <p className="planos-explicacao">As inserções são acumuladas, não uma franquia mensal. A contagem não reinicia no mês e excluir lançamentos não devolve inserções. Todos os planos já incluem as 20 gratuitas.</p>
    </section>
      <section className="assinatura-card checkout-plano" aria-labelledby="titulo-contratacao">
        <div className="checkout-resumo"><span className="assinatura-selo">PLANO SELECIONADO</span><h2 id="titulo-contratacao">{limite} inserções acumuladas</h2><p className="checkout-preco">{moeda(preco)}<span> por mês</span></p><p>Capacidade total de receitas e despesas na sua conta.</p><div className="checkout-notas"><p>Pagamento seguro no Asaas.</p><p>A liberação ocorre após a confirmação do pagamento.</p><p>Você pode cancelar a renovação na sua assinatura.</p></div></div>
        <div className="checkout-formulario"><h3>Revise sua contratação</h3>
        <label className="assinatura-campo">CPF ou CNPJ para cobrança
          <input autoComplete="off" inputMode="numeric" maxLength={18} value={documento} onChange={e => definirDocumento(e.target.value)} disabled={!ativo || ocupado} />
        </label>
        {a?.blocks && a.subscriptionId ? <p>Ao ampliar um plano ativo, você paga a diferença integral entre os planos para o restante do período. Na próxima renovação, será cobrado o novo valor mensal.</p> : null}
        <label className="assinatura-aceite"><input type="checkbox" checked={aceito} onChange={e => aceitar(e.target.checked)} disabled={!ativo || ocupado} />
          <span>Quero contratar {limite} inserções por {moeda(preco)} por mês, até cancelar a renovação.</span></label>
        <button className="botao botao-principal" disabled={!ativo || !aceito || ocupado || blocos <= (a?.blocks || 0)} onClick={() => void contratar()}>
          {ocupado ? 'Preparando…' : 'Continuar para pagamento'}
        </button>
        {!ativo&&<p className="checkout-indisponivel">Você pode conhecer os planos. A contratação será liberada em breve; nenhuma cobrança será gerada agora.</p>}
        <p className="checkout-seguranca">Dados do cartão são preenchidos somente no ambiente do Asaas.</p>
        <p className="texto-miudo"><Link to="/termos-de-uso">Termos, cancelamento e arrependimento</Link> · <Link to="/politica-de-privacidade">Privacidade</Link></p>
        {mensagem && <p role="status">{mensagem}</p>}
        {url && <a className="botao botao-principal" href={url} target="_blank" rel="noopener noreferrer">Abrir pagamento no Asaas ↗</a>}
        </div>
      </section>
    <section className="assinatura-card assinatura-historico"><h2>Histórico de pagamentos</h2>
      <div className="assinatura-tabela"><table><thead><tr><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Cobrança</th></tr></thead>
        <tbody>{a?.payments.map(p => <tr key={p.id}><td>{p.dueDate.split('-').reverse().join('/')}</td><td>{moeda(p.value)}</td>
          <td>{rotuloPagamento(p.status)}</td><td>{linkPagamento(p.url) ? <a href={linkPagamento(p.url)} target="_blank" rel="noopener noreferrer">Ver cobrança ↗</a> : '—'}</td></tr>)}</tbody></table></div>
      {!a?.payments.length && <p>Nenhum pagamento disponível.</p>}
    </section></div>
  </>;
}
