import { useState } from 'react';
import { formatarMoeda } from '../utilitarios/formatadores';

export function Demonstracao() {
  const [registrado, registrar] = useState(false);
  return <section className="lp-demo lp-largura" id="demonstracao" aria-labelledby="demo-titulo">
    <div><p className="lp-etiqueta">EXPERIMENTE ANTES DE CRIAR CONTA</p><h2 id="demo-titulo">Um gasto registrado.<br/>Um mês mais claro.</h2><p>Veja uma despesa mudar o saldo. Esta demonstração usa dados fictícios e não grava nada na sua conta.</p></div>
    <div className="demo-cartao"><span>Seu mês de exemplo</span><h3>Saldo do mês</h3><strong className="demo-saldo">{formatarMoeda(registrado ? 2350 : 2400)}</strong><p>Receitas: R$ 3.000,00 · Despesas: {registrado ? 'R$ 650,00' : 'R$ 600,00'}</p>
      <button className="lp-cta" disabled={registrado} onClick={() => registrar(true)}>{registrado ? 'Despesa registrada' : 'Registrar R$ 50 de mercado'}</button>
      <p role="status">{registrado ? 'Mercado · R$ 50,00. O saldo diminuiu e a despesa ficou organizada por categoria.' : 'Toque no botão para ver o resultado.'}</p>
      {registrado && <button className="lp-link-texto" onClick={() => registrar(false)}>Recomeçar demonstração</button>}
    </div>
  </section>;
}
