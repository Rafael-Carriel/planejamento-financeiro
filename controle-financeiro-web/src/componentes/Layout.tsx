import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { ModalDaConta } from './ModalDaConta';

/// Moldura do app: navegação à esquerda no computador, barra inferior no
/// celular, e o conteúdo da página no meio.

interface ItemDeNavegacao {
  para: string;
  rotulo: string;
  rotuloCurto: string;
  icone: string;
}

const ITENS: ItemDeNavegacao[] = [
  { para: '/', rotulo: 'Painel', rotuloCurto: 'Painel', icone: '◧' },
  { para: '/receitas', rotulo: 'Receitas', rotuloCurto: 'Receitas', icone: '↑' },
  { para: '/despesas', rotulo: 'Despesas', rotuloCurto: 'Despesas', icone: '↓' },
  // "Fixas" no celular: cabe na barra de baixo e é como se fala das contas que
  // repetem todo mês.
  { para: '/recorrencias', rotulo: 'Recorrências', rotuloCurto: 'Fixas', icone: '⟳' },
  { para: '/previsao', rotulo: 'Previsão', rotuloCurto: 'Previsão', icone: '◔' },
  { para: '/categorias', rotulo: 'Categorias', rotuloCurto: 'Categorias', icone: '⬢' },
  { para: '/planejamento', rotulo: 'Planejamento', rotuloCurto: 'Plano', icone: '◎' },
  { para: '/historico', rotulo: 'Histórico', rotuloCurto: 'Histórico', icone: '≡' },
];

export function Layout() {
  const { nomeParaExibir, usuario, sair } = useAutenticacao();
  const [contaAberta, definirContaAberta] = useState(false);
  const inicial = nomeParaExibir.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="moldura">
      <aside className="barra-lateral">
        <div className="marca">
          <img src="/logo.png" alt="Planeja" className="marca-logo" />
          <span className="marca-nome">
            Planeja
            <span>planejamento financeiro</span>
          </span>
        </div>

        <nav className="navegacao" aria-label="Seções do app">
          {ITENS.map((item) => (
            <NavLink
              key={item.para}
              to={item.para}
              end={item.para === '/'}
              className={({ isActive }) => (isActive ? 'ativo' : undefined)}
            >
              <span className="navegacao-icone" aria-hidden="true">
                {item.icone}
              </span>
              <span className="navegacao-rotulo">{item.rotulo}</span>
              <span className="navegacao-rotulo-curto">{item.rotuloCurto}</span>
            </NavLink>
          ))}
        </nav>

        <div className="rodape-barra">
          <button
            type="button"
            className="identificacao botao-identificacao"
            onClick={() => definirContaAberta(true)}
          >
            <span className="inicial" aria-hidden="true">
              {inicial}
            </span>
            <span className="identificacao-textos">
              <span className="identificacao-nome">{nomeParaExibir}</span>
              <span className="identificacao-email">{usuario?.email ?? ''}</span>
            </span>
          </button>

          <button type="button" className="botao-sair" onClick={() => void sair()}>
            Sair da conta
          </button>
        </div>
      </aside>

      <main className="conteudo">
        {/* Tira só do celular: no telefone a barra lateral virou barra inferior
            e perdeu o rodapé, então a conta precisa de outro caminho. */}
        <div className="tira-conta">
          <img src="/logo.png" alt="Planeja" className="marca-logo-mini" />
          <span className="marca-nome">Planeja</span>
          <button
            type="button"
            className="inicial"
            onClick={() => definirContaAberta(true)}
            aria-label="Sua conta"
          >
            {inicial}
          </button>
        </div>

        <Outlet />
      </main>

      {contaAberta ? <ModalDaConta aoFechar={() => definirContaAberta(false)} /> : null}
    </div>
  );
}
