import { Link } from 'react-router-dom';
import { InstalarAplicativo } from '../componentes/InstalarAplicativo';
import '../apresentacao.css';

const planos = [
  { nome: 'Para começar', limite: 20, preco: 0, texto: 'Conheça o Planeora e organize seus primeiros lançamentos.' },
  { nome: 'Essencial', limite: 50, preco: 20, texto: 'Os 20 gratuitos + 30 lançamentos de espaço no seu plano.' },
  { nome: 'Mais espaço', limite: 80, preco: 40, texto: 'Os 20 gratuitos + 60 lançamentos de espaço no seu plano.' },
  { nome: 'Mais movimento', limite: 110, preco: 60, texto: 'Os 20 gratuitos + 90 lançamentos de espaço no seu plano.' },
];
const perguntas = [
  ['Preciso conectar minha conta bancária?', 'Não. Você cadastra suas receitas e despesas no Planeora e escolhe as categorias. O sistema organiza os lançamentos e calcula os totais para você.'],
  ['Os 20 lançamentos grátis voltam todo mês?', 'Não. O limite é acumulado, considerando as receitas e despesas que você cadastra ao longo do uso. Ele não reinicia todo mês, e excluir um lançamento não devolve uma inserção.'],
  ['E quando eu precisar de mais espaço?', 'Você escolhe um plano na área Assinatura. Cada bloco adicional de 30 lançamentos acrescenta R$ 20 à mensalidade. A cota paga é liberada após a confirmação do pagamento. Também existem opções acima de 110 lançamentos.'],
  ['Posso cancelar a assinatura?', 'Sim. O cancelamento encerra a renovação e preserva o acesso pago até o fim do período contratado. Pedidos de atendimento e os direitos previstos em lei são tratados pelo SAC.'],
  ['Funciona no celular e no computador?', 'Sim. Acesse a mesma conta pelo navegador dos seus dispositivos. Também é possível instalar o Planeora como aplicativo nos navegadores compatíveis. Os lembretes aparecem dentro do sistema enquanto você o utiliza.'],
];

export function Apresentacao() {
  function ir(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
  return <div className="landing">
    <a className="lp-pular" href="#conteudo-apresentacao" onClick={e => { e.preventDefault(); document.getElementById('conteudo-apresentacao')?.focus(); }}>Pular para o conteúdo</a>
    <header className="lp-topo lp-largura">
      <Link className="lp-marca" to="/conheca" aria-label="Planeora, apresentação"><img src="/logo-192.png" alt="" width="38" height="38" /><span>Planeora<span className="lp-ponto">.</span></span></Link>
      <nav className="lp-nav" aria-label="Conheça o Planeora"><button onClick={() => ir('por-dentro')}>Por dentro</button><button onClick={() => ir('planos')}>Planos</button><button onClick={() => ir('duvidas')}>Dúvidas</button></nav>
      <Link className="lp-entrar" to="/entrar">Entrar <span aria-hidden="true">↗</span></Link>
    </header>
    <main id="conteudo-apresentacao" tabIndex={-1}>
      <section className="lp-hero lp-largura" aria-labelledby="lp-titulo">
        <div className="lp-hero-texto"><p className="lp-sobretitulo"><span /> SEU DINHEIRO, ÀS CLARAS</p>
          <h1 id="lp-titulo">O que entra.<br />O que sai.<br /><em>O que fica.</em></h1>
          <p className="lp-intro">O salário, o mercado, o café de todo dia. Junte as peças e entenda seu mês com o Planeora.</p>
          <div className="lp-hero-acoes"><Link className="lp-cta" to="/criar-conta">Começar grátis <span aria-hidden="true">↗</span></Link><button className="lp-link" onClick={() => ir('por-dentro')}>Ver como funciona <span aria-hidden="true">↓</span></button></div>
          <p className="lp-micro">20 primeiros lançamentos grátis. Sem cartão para começar.</p>
        </div>
        <div className="lp-vitrine"><div className="lp-vitrine-legenda"><span>UM MÊS. UMA VISÃO COMPLETA.</span><span aria-hidden="true">01 — 31</span></div>
          <div className="lp-janela"><div className="lp-janela-barra"><span aria-hidden="true">● ● ●</span><span>Planeora / seu painel</span><span aria-hidden="true">↗</span></div><img src="/apresentacao/painel.webp" width="1600" height="1111" alt="Painel real do Planeora com saldo, entradas, saídas e gráfico do movimento do mês. Exemplo com dados fictícios." fetchPriority="high" /></div>
          <div className="lp-vitrine-rodape"><span>Receitas, despesas e saldo.<br /><strong>Finalmente na mesma página.</strong></span><span className="lp-selo" aria-hidden="true">P.</span></div>
          <p className="lp-exemplo">Tela real do sistema. Valores demonstrativos.</p>
        </div>
      </section>
      <div className="lp-faixa"><div className="lp-largura"><span>Organização no dia a dia</span><span aria-hidden="true">/</span><span>Visão do mês</span><span aria-hidden="true">/</span><span>Planos para o que vem depois</span></div></div>
      <section className="lp-secao lp-largura" id="por-dentro" aria-labelledby="lp-por-dentro">
        <div className="lp-titulo-secao"><p className="lp-sobretitulo">01 / POR DENTRO</p><h2 id="lp-por-dentro">Menos conta de cabeça.<br />Mais visão do mês.</h2><p>Registrar é só o começo. O Planeora ajuda você a enxergar o que os números estão dizendo.</p></div>
        <div className="lp-recursos">
          <article><span className="lp-numero">01</span><h3>Seu dinheiro tem endereço.</h3><p>Separe os gastos por categoria e descubra quanto foi para alimentação, moradia, transporte e o que mais faz parte da sua rotina.</p><span className="lp-recurso-nota">Receitas e despesas organizadas</span></article>
          <article><span className="lp-numero">02</span><h3>As contas entram no plano.</h3><p>Organize contas recorrentes, acompanhe dívidas e defina limites de gastos. Consulte os lembretes ao abrir o sistema.</p><span className="lp-recurso-nota">Planejamento que acompanha o mês</span></article>
          <article><span className="lp-numero">03</span><h3>O próximo mês tem contexto.</h3><p>Compare seu histórico, consulte relatórios e acompanhe objetivos e reserva de emergência com uma visão do que já aconteceu.</p><span className="lp-recurso-nota">Histórico, relatórios e objetivos</span></article>
        </div>
      </section>
      <section className="lp-rotina"><div className="lp-largura lp-rotina-grid"><div className="lp-celular"><img src="/apresentacao/celular.webp" width="585" height="1266" loading="lazy" alt="Versão mobile do painel do Planeora, com valores demonstrativos de saldo, entradas e saídas." /><span>O mesmo Planeora. Onde você estiver.</span></div>
        <div className="lp-rotina-texto"><p className="lp-sobretitulo">DO SEU JEITO, NO SEU RITMO</p><h2>Uma rotina pequena.<br />Uma visão bem maior.</h2><p>Não precisa esperar o fim do mês para descobrir quanto sobrou.</p><ol><li><span>01</span><div><h3>Entrou ou saiu? Registre.</h3><p>Informe o valor, a data e a categoria do lançamento.</p></div></li><li><span>02</span><div><h3>Confira o seu painel.</h3><p>Veja o saldo e a distribuição dos gastos no mesmo lugar.</p></div></li><li><span>03</span><div><h3>Ajuste o que vem pela frente.</h3><p>Use seus números para organizar limites, contas e objetivos.</p></div></li></ol><Link className="lp-link" to="/criar-conta">Organizar meu primeiro lançamento <span aria-hidden="true">↗</span></Link></div>
      </div></section>
      <section className="lp-secao lp-largura" id="planos" aria-labelledby="lp-planos"><div className="lp-titulo-secao"><p className="lp-sobretitulo">02 / UM COMEÇO SEM COMPROMISSO</p><h2 id="lp-planos">Comece pequeno.<br />Amplie quando precisar.</h2><p>Os primeiros 20 lançamentos são gratuitos. Depois, escolha o espaço que faz sentido para você.</p></div>
        <div className="lp-planos">{planos.map(plano => <article key={plano.limite} className={plano.preco === 20 ? 'lp-plano lp-plano-principal' : 'lp-plano'}><p className="lp-plano-nome">{plano.nome}</p><h3>{plano.limite}<span>lançamentos no total</span></h3><div className="lp-preco">R$ {plano.preco}<span>{plano.preco ? '/mês' : 'para começar'}</span></div><p className="lp-plano-texto">{plano.texto}</p><Link className={plano.preco === 20 ? 'lp-cta' : 'lp-plano-link'} to="/criar-conta">{plano.preco ? 'Conhecer o plano' : 'Criar conta grátis'} <span aria-hidden="true">↗</span></Link></article>)}</div>
        <div className="lp-regra-planos"><strong>Importante: o limite é acumulado.</strong><p>Os lançamentos não reiniciam a cada mês. Cada receita ou despesa cadastrada conta como uma inserção, mesmo se for excluída depois. Os planos pagos têm renovação mensal e mantêm a cota contratada durante o período pago. Cada bloco adicional de 30 lançamentos acrescenta R$ 20 à mensalidade.</p></div>
      </section>
      <section className="lp-duvidas lp-largura" id="duvidas" aria-labelledby="lp-faq"><div><p className="lp-sobretitulo">03 / ANTES DE COMEÇAR</p><h2 id="lp-faq">Tudo claro?</h2><p>Se faltar alguma resposta,<br /><Link to="/atendimento">fale com o nosso SAC ↗</Link></p></div><div className="lp-faq">{perguntas.map(([pergunta,resposta]) => <details key={pergunta}><summary>{pergunta}<span aria-hidden="true">+</span></summary><p>{resposta}</p></details>)}</div></section>
      <section className="lp-fecho"><div className="lp-largura"><p className="lp-sobretitulo">O PRIMEIRO PASSO CABE NO SEU DIA.</p><h2>Seu próximo mês<br />começa com mais clareza.</h2><Link className="lp-cta" to="/criar-conta">Começar meus 20 lançamentos grátis <span aria-hidden="true">↗</span></Link><p>Já usa o Planeora? <Link to="/entrar">Entre na sua conta.</Link></p></div></section>
    </main>
    <footer className="lp-rodape lp-largura"><div className="lp-rodape-topo"><div><Link className="lp-marca" to="/conheca"><img src="/logo-192.png" alt="" width="34" height="34" /><span>Planeora.</span></Link><p>Seu dinheiro, com clareza.</p></div><nav aria-label="Informações do Planeora"><Link to="/atendimento">SAC e ajuda</Link><Link to="/politica-de-privacidade">Privacidade</Link><Link to="/termos-de-uso">Termos de Uso</Link></nav></div><div className="lp-rodape-base"><span>© {new Date().getFullYear()} Planeora</span><div className="lp-instalar"><InstalarAplicativo /></div></div></footer>
  </div>;
}
