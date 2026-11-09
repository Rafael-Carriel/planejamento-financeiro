import { Icone, type NomeDeIcone } from './Icone';
import { useTema } from '../contextos/ContextoTema';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { BotaoLembrete } from './BotaoLembrete';

import { ModalDaConta } from './ModalDaConta';
import { useAssinatura } from '../contextos/ContextoAssinatura';

/// Moldura do app: navegação à esquerda no computador, barra inferior no
/// celular, e o conteúdo da página no meio.

interface ItemDeNavegacao {
  para: string;
  rotulo: string;
  rotuloCurto: string;
  icone: NomeDeIcone;
}

const ITENS: ItemDeNavegacao[] = [
  { para: '/', rotulo: 'Painel', rotuloCurto: 'Painel', icone: 'painel' },
  { para: '/receitas', rotulo: 'Receitas', rotuloCurto: 'Receitas', icone: 'receitas' },
  { para: '/despesas', rotulo: 'Despesas', rotuloCurto: 'Despesas', icone: 'despesas' },
  // "Fixas" no celular: cabe na barra de baixo e é como se fala das contas que
  // repetem todo mês.
  { para: '/recorrencias', rotulo: 'Recorrências', rotuloCurto: 'Fixas', icone: 'recorrencias' },
  { para: '/previsao', rotulo: 'Previsão', rotuloCurto: 'Previsão', icone: 'previsao' },
  { para: '/categorias', rotulo: 'Categorias', rotuloCurto: 'Categorias', icone: 'categorias' },
  { para: '/dividas', rotulo: 'Dívidas', rotuloCurto: 'Dívidas', icone: 'dividas' },
  { para: '/lembretes', rotulo: 'Lembretes', rotuloCurto: 'Avisos', icone: 'lembretes' },
  { para: '/planejamento', rotulo: 'Planejamento', rotuloCurto: 'Plano', icone: 'planejamento' },
  { para: '/historico', rotulo: 'Histórico', rotuloCurto: 'Histórico', icone: 'historico' },
  { para: '/relatorios', rotulo: 'Relatórios', rotuloCurto: 'Relatórios', icone: 'relatorios' },
  { para: '/reserva-emergencia', rotulo: 'Reserva', rotuloCurto: 'Reserva', icone: 'reserva' },
  { para: '/objetivos', rotulo: 'Objetivos', rotuloCurto: 'Objetivos', icone: 'objetivos' },
  { para: '/atendimento', rotulo: 'SAC e ajuda', rotuloCurto: 'SAC', icone: 'ajuda' },
  { para: '/instalar', rotulo: 'Instalar aplicativo', rotuloCurto: 'Instalar', icone: 'instalar' },
  { para: '/assinatura', rotulo: 'Assinatura', rotuloCurto: 'Assinatura', icone: 'assinatura' },
  { para: '/privacidade', rotulo: 'Privacidade e direitos', rotuloCurto: 'Privacidade', icone: 'reserva' },
];

function grupo(rota: string) {
  if (['/', '/previsao', '/lembretes', '/historico', '/relatorios'].includes(rota)) return 'Visão do mês';
  if (['/receitas', '/despesas', '/categorias', '/recorrencias'].includes(rota)) return 'Movimentações';
  if (['/dividas', '/planejamento', '/reserva-emergencia', '/objetivos'].includes(rota)) return 'Planejar';
  return 'Conta e ajuda';
}
const GRUPOS = ['Visão do mês', 'Movimentações', 'Planejar', 'Conta e ajuda'];
const ITENS_PRINCIPAIS = ['/', '/receitas', '/despesas', '/recorrencias'];

export function Layout() {
  const { assinatura } = useAssinatura();
  const itens: ItemDeNavegacao[] = assinatura?.admin ? [...ITENS, { para: '/admin', rotulo: 'Administração', rotuloCurto: 'Admin', icone: 'admin' }] : ITENS;
  const { nomeParaExibir, usuario, sair } = useAutenticacao();
  const [contaAberta, definirContaAberta] = useState(false);
  const [maisAberto, definirMaisAberto] = useState(false);
  const maisRef = useRef<HTMLLIElement>(null);
  const localAtual = useLocation();
  const inicial = nomeParaExibir.trim().charAt(0).toUpperCase() || '?';

  const {tema,alternarTema} = useTema();

  useEffect(() => { definirMaisAberto(false); window.scrollTo(0, 0); }, [localAtual.pathname]);
  useEffect(() => {
    if (!maisAberto) return;
    const menu = document.getElementById('menu-mais');
    const rolagemAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menu?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') { definirMaisAberto(false); maisRef.current?.querySelector('button')?.focus(); }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => { window.removeEventListener('keydown', aoTeclar); document.body.style.overflow = rolagemAnterior; };
  }, [maisAberto]);

  const itensPrincipais = itens.filter((item) => ITENS_PRINCIPAIS.includes(item.para));
  const itensSecundarios = itens.filter((item) => !ITENS_PRINCIPAIS.includes(item.para));
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
            <span className="marca-nome">Planeora</span><span className="marca-subtitulo">Suas finanças, com clareza</span>
          </div>
        </div>

        {/* Navegação principal */}
        <nav className="navegacao" aria-label="Seções do app">
          <ul className="navegacao-lista" role="list">
            {GRUPOS.map(nome => <Fragment key={nome}><li className="navegacao-grupo">{nome}</li>{itens.filter(item => grupo(item.para) === nome).map((item) => (
              <li key={item.para} className="navegacao-item">
                <NavLink
                  to={item.para}
                  end={item.para === '/'}
                  className={({ isActive }) =>
                    `navegacao-link${isActive ? ' ativo' : ''}`
                  }
                >
                  <span className="navegacao-icone" aria-hidden="true">
                    <Icone nome={item.icone} />
                  </span>
                  <span className="navegacao-rotulo">{item.rotulo}</span>
                  <span className="navegacao-rotulo-curto">{item.rotuloCurto}</span>
                </NavLink>
              </li>
            ))}</Fragment>)}
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
            className="botao-tema"
            onClick={alternarTema}
            aria-label={tema === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            <Icone nome={tema === 'dark' ? 'sol' : 'lua'} />
            {tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>

          <BotaoLembrete comRotulo />

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
            <img src="/logo.png" alt="Planeora" className="marca-logo-mini" />
            <span className="marca-nome">Planeora</span>
          </div>
          <div className="tira-conta-acoes">
            <BotaoLembrete />

            <button
              type="button"
              className="botao-tema"
              onClick={alternarTema}
              aria-label={tema === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              <Icone nome={tema === 'dark' ? 'sol' : 'lua'} />
            </button>
            <button
              type="button"
              className="inicial"
              onClick={() => definirContaAberta(true)}
              aria-label="Sua conta"
            >
              {inicial}
            </button>
          </div>
        </header>

        <main className="conteudo" role="main">
          <div className="conteudo-conteiner">
            {assinatura?.enabled && !assinatura.admin && assinatura.limit !== null && assinatura.count >= assinatura.limit && <div className="assinatura-aviso" role="status">
              Você utilizou os {assinatura.limit} lançamentos disponíveis{assinatura.usageMode === "monthly" ? " neste mês" : " no seu plano"}. <Link to="/assinatura">Conhecer minha assinatura</Link>
            </div>}
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
                  <Icone nome={item.icone} />
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
              aria-haspopup="menu"
              aria-controls={maisAberto ? "menu-mais" : undefined}
              aria-label="Mais opções"
            >
              <span className="item-nav-mobile-icone" aria-hidden="true">
                <Icone nome="mais" />
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
                <div className="popover-mais" id="menu-mais" role="menu" aria-label="Mais seções"><div className="menu-mais-titulo">Seu espaço financeiro</div>
                  {GRUPOS.map(nome => <Fragment key={nome}><div className="menu-grupo" role="presentation">{nome}</div>{itensSecundarios.filter(item => grupo(item.para) === nome).map((item) => (
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
                        <Icone nome={item.icone} />
                      </span>
                      <span className="popover-item-rotulo">{item.rotulo}</span>
                    </NavLink>
                  ))}</Fragment>)}
                  <div className="popover-configuracoes">
                    <button type="button" className="popover-item" role="menuitem" onClick={() => { definirMaisAberto(false); definirContaAberta(true); }}>
                      <Icone nome="conta" /> Perfil e configurações
                    </button>
                    <button type="button" className="popover-item" role="menuitem" onClick={alternarTema}>
                      <Icone nome={tema === 'dark' ? 'sol' : 'lua'} /> {tema === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
                    </button>
                    <button type="button" className="popover-item" role="menuitem" onClick={() => void sair()}>Sair da conta</button>
                  </div>
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
