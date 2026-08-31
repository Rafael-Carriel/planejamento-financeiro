import { useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

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
  { para: '/relatorios', rotulo: 'Relatórios', rotuloCurto: 'Relatórios', icone: '📊' },
  { para: '/reserva-emergencia', rotulo: 'Reserva', rotuloCurto: 'Reserva', icone: '🛡' },
];

const ITENS_PRINCIPAIS = ['/', '/receitas', '/despesas', '/recorrencias', '/previsao'];

export function Layout() {
  const { nomeParaExibir, usuario, sair } = useAutenticacao();
  const [contaAberta, definirContaAberta] = useState(false);
  const [maisAberto, definirMaisAberto] = useState(false);
  const maisRef = useRef<HTMLDivElement>(null);
  const localAtual = useLocation();
  const inicial = nomeParaExibir.trim().charAt(0).toUpperCase() || '?';

  const itensPrincipais = ITENS.filter((item) => ITENS_PRINCIPAIS.includes(item.para));
  const itensSecundarios = ITENS.filter((item) => !ITENS_PRINCIPAIS.includes(item.para));
  const temAtivoSecundario = itensSecundarios.some((item) => localAtual.pathname === item.para);

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

      <nav className="barra-inferior-mobile" aria-label="Navegação principal">
        {itensPrincipais.map((item) => (
          <NavLink
            key={item.para}
            to={item.para}
            end={item.para === '/'}
            className={({ isActive }) => `item-nav-mobile${isActive ? ' ativo' : ''}`}
          >
            <span className="item-nav-mobile-icone" aria-hidden="true">
              {item.icone}
            </span>
            <span className="item-nav-mobile-rotulo">{item.rotuloCurto}</span>
          </NavLink>
        ))}

        <div className="item-nav-mais" ref={maisRef}>
          <button
            type="button"
            className={`item-nav-mobile botao-mais${maisAberto ? ' ativo' : temAtivoSecundario ? ' tem-ativo' : ''}`}
            onClick={() => definirMaisAberto(!maisAberto)}
            aria-expanded={maisAberto}
            aria-label="Mais opções"
          >
            <span className="item-nav-mobile-icone" aria-hidden="true">
              ☰
            </span>
            <span className="item-nav-mobile-rotulo">Mais</span>
          </button>

          {maisAberto && (
            <>
              <div
                className="fundo-popover"
                onClick={() => definirMaisAberto(false)}
              />
              <div className="popover-mais">
                {itensSecundarios.map((item) => (
                  <NavLink
                    key={item.para}
                    to={item.para}
                    className={({ isActive }) => `popover-item${isActive ? ' ativo' : ''}`}
                    onClick={() => definirMaisAberto(false)}
                  >
                    <span className="popover-item-icone" aria-hidden="true">
                      {item.icone}
                    </span>
                    <span className="popover-item-rotulo">{item.rotulo}</span>
                  </NavLink>
                ))}
              </div>
            </>
          )}
        </div>
      </nav>

      {contaAberta ? <ModalDaConta aoFechar={() => definirContaAberta(false)} /> : null}
    </div>
  );
}
