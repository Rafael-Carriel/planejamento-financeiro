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
  { para: '/dividas', rotulo: 'Dívidas', rotuloCurto: 'Dívidas', icone: '💸' },
  { para: '/planejamento', rotulo: 'Planejamento', rotuloCurto: 'Plano', icone: '◎' },
  { para: '/historico', rotulo: 'Histórico', rotuloCurto: 'Histórico', icone: '≡' },
  { para: '/relatorios', rotulo: 'Relatórios', rotuloCurto: 'Relatórios', icone: '📊' },
  { para: '/reserva-emergencia', rotulo: 'Reserva', rotuloCurto: 'Reserva', icone: '🛡' },
];

const ITENS_PRINCIPAIS = ['/', '/receitas', '/despesas', '/recorrencias', '/dividas'];

export function Layout() {
  const { nomeParaExibir, usuario, sair } = useAutenticacao();
  const [contaAberta, definirContaAberta] = useState(false);
  const [maisAberto, definirMaisAberto] = useState(false);
  const maisRef = useRef<HTMLLIElement>(null);
  const localAtual = useLocation();
  const inicial = nomeParaExibir.trim().charAt(0).toUpperCase() || '?';

  const itensPrincipais = ITENS.filter((item) => ITENS_PRINCIPAIS.includes(item.para));
  const itensSecundarios = ITENS.filter((item) => !ITENS_PRINCIPAIS.includes(item.para));
  const temAtivoSecundario = itensSecundarios.some((item) => localAtual.pathname === item.para);

  return (
    <div className="moldura">
      {/* ─── Sidebar (desktop) ─── */}
      <aside className="barra-lateral" data-gradiente="escuro">
        {/* Logo */}
        <div className="marca" role="banner">
          <div className="marca-icone" aria-hidden="true">
            <img src="/logo.png" alt="" className="marca-logo" />
          </div>
          <div className="marca-texto">
            <span className="marca-nome">Planeja</span>
            <span className="marca-subtitulo">planejamento financeiro</span>
          </div>
        </div>

        {/* Navegação principal */}
        <nav className="navegacao" aria-label="Seções do app">
          <ul className="navegacao-lista" role="list">
            {ITENS.map((item) => (
              <li key={item.para} className="navegacao-item">
                <NavLink
                  to={item.para}
                  end={item.para === '/'}
                  className={({ isActive }) =>
                    `navegacao-link${isActive ? ' ativo' : ''}`
                  }
                >
                  <span className="navegacao-icone" aria-hidden="true">
                    {item.icone}
                  </span>
                  <span className="navegacao-rotulo">{item.rotulo}</span>
                  <span className="navegacao-rotulo-curto">{item.rotuloCurto}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Rodapé da sidebar: usuário */}
        <footer className="rodape-barra">
          <button
            type="button"
            className="identificacao botao-identificacao"
            onClick={() => definirContaAberta(true)}
            aria-label="Abrir configurações da conta"
          >
            <span className="inicial" aria-hidden="true">
              {inicial}
            </span>
            <span className="identificacao-textos">
              <span className="identificacao-nome">{nomeParaExibir}</span>
              <span className="identificacao-email">{usuario?.email ?? ''}</span>
            </span>
          </button>

          <button
            type="button"
            className="botao-sair"
            onClick={() => void sair()}
            aria-label="Sair da conta"
          >
            Sair da conta
          </button>
        </footer>
      </aside>

      {/* ─── Conteúdo principal ─── */}
      <div className="conteudo-wrapper">
        {/* Barra superior mobile */}
        <header className="tira-conta" role="banner">
          <div className="tira-conta-esquerda">
            <img src="/logo.png" alt="Planeja" className="marca-logo-mini" />
            <span className="marca-nome">Planeja</span>
          </div>
          <button
            type="button"
            className="inicial"
            onClick={() => definirContaAberta(true)}
            aria-label="Sua conta"
          >
            {inicial}
          </button>
        </header>

        <main className="conteudo" role="main">
          <div className="conteudo-conteiner">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ─── Barra inferior (mobile) ─── */}
      <nav
        className="barra-inferior-mobile"
        data-gradiente="escuro"
        aria-label="Navegação principal"
      >
        <ul className="barra-inferior-lista" role="list">
          {itensPrincipais.map((item) => (
            <li key={item.para} className="barra-inferior-item">
              <NavLink
                to={item.para}
                end={item.para === '/'}
                className={({ isActive }) =>
                  `item-nav-mobile${isActive ? ' ativo' : ''}`
                }
              >
                <span className="item-nav-mobile-icone" aria-hidden="true">
                  {item.icone}
                </span>
                <span className="item-nav-mobile-rotulo">{item.rotuloCurto}</span>
              </NavLink>
            </li>
          ))}

          <li className="barra-inferior-item" ref={maisRef}>
            <button
              type="button"
              className={`item-nav-mobile botao-mais${maisAberto ? ' ativo' : temAtivoSecundario ? ' tem-ativo' : ''}`}
              onClick={() => definirMaisAberto(!maisAberto)}
              aria-expanded={maisAberto}
              aria-haspopup="true"
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
                  aria-hidden="true"
                />
                <div className="popover-mais" role="menu" aria-label="Mais seções">
                  {itensSecundarios.map((item) => (
                    <NavLink
                      key={item.para}
                      to={item.para}
                      className={({ isActive }) =>
                        `popover-item${isActive ? ' ativo' : ''}`
                      }
                      role="menuitem"
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
          </li>
        </ul>
      </nav>

      {contaAberta ? <ModalDaConta aoFechar={() => definirContaAberta(false)} /> : null}
    </div>
  );
}
