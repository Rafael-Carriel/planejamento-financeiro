import { InstalarAplicativo } from '../componentes/InstalarAplicativo';
import { useState, type FormEvent } from 'react';

import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { mensagemDeErro } from '../servicos/servicoAutenticacao';
import { formatarMoeda } from '../utilitarios/formatadores';
import { Link } from 'react-router-dom';

/// Entrada no app: entrar ou criar conta, com e-mail e senha.
///
/// A coluna da esquerda mostra um extrato de exemplo em vez de uma promessa de
/// marketing: em três linhas, quem chega entende que o app soma entradas, tira
/// saídas e mostra o que sobrou.

const EXEMPLO = [
  { descricao: 'Salário', valor: 6200, tipo: 'entrada' as const },
  { descricao: 'Aluguel', valor: 1850, tipo: 'saida' as const },
  { descricao: 'Mercado do mês', valor: 940.35, tipo: 'saida' as const },
  { descricao: 'Freelance', valor: 1200, tipo: 'entrada' as const },
];

type Modo = 'entrar' | 'criar';

export function Entrada({ modoInicial = 'entrar' }: { modoInicial?: Modo }) {
  const { entrar, criarConta, redefinirSenha } = useAutenticacao();

  const [modo, definirModo] = useState<Modo>(modoInicial);
  const [nome, definirNome] = useState('');
  const [email, definirEmail] = useState('');
  const [senha, definirSenha] = useState('');
  const [erro, definirErro] = useState<string | null>(null);
  const [recado, definirRecado] = useState<string | null>(null);
  const [enviando, definirEnviando] = useState(false);
  const [aceite, aceitar] = useState(false);

  const saldoDoExemplo = EXEMPLO.reduce(
    (soma, item) => soma + (item.tipo === 'entrada' ? item.valor : -item.valor),
    0,
  );

  function trocarModo(novo: Modo) {
    definirModo(novo);
    definirErro(null);
    definirRecado(null);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    definirErro(null);
    definirRecado(null);

    if (email.trim().length === 0) {
      definirErro('Digite o e-mail.');
      return;
    }
    if (senha.length < 6) {
      definirErro('A senha precisa de pelo menos 6 caracteres.');
      return;
    }
    if (modo === 'criar' && nome.trim().length === 0) {
      definirErro('Digite seu nome.');
      return;
    }
    if (modo === 'criar' && !aceite) { definirErro('Leia e aceite os Termos de Uso para criar a conta.'); return; }

    definirEnviando(true);
    try {
      if (modo === 'entrar') await entrar(email, senha);
      else await criarConta(nome, email, senha);
      // Não é preciso navegar: o observador de sessão troca a tela sozinho.
    } catch (falha) {
      definirErro(mensagemDeErro(falha));
    } finally {
      definirEnviando(false);
    }
  }

  async function pedirNovaSenha() {
    definirErro(null);
    definirRecado(null);

    if (email.trim().length === 0) {
      definirErro('Digite o e-mail para receber o link de nova senha.');
      return;
    }

    definirEnviando(true);
    try {
      await redefinirSenha(email);
      definirRecado(`Link enviado para ${email.trim()}. Verifique a caixa de entrada e o spam.`);
    } catch (falha) {
      definirErro(mensagemDeErro(falha));
    } finally {
      definirEnviando(false);
    }
  }

  return (
    <div className="tela-entrada">
      <section className="entrada-vitrine">
        <div className="marca">
          <img src="/logo.png" alt="Logo Planeora" className="entrada-logo" />
          <div className="entrada-marca-texto"><span className="marca-nome">Planeora</span><span className="entrada-marca-sub">Seu dinheiro, com clareza.</span></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h1>O mês inteiro numa página.</h1>
          <p>
            Você lança o que entra e o que sai, escolhe uma categoria e pronto: o painel mostra o
            saldo, o planejamento avisa quando um limite aperta e o histórico compara os meses.
          </p>

          <div className="extrato-exemplo" aria-hidden="true">
            {EXEMPLO.map((item) => (
              <div className="extrato-linha" key={item.descricao}>
                <span>{item.descricao}</span>
                <span
                  className={
                    item.tipo === 'entrada'
                      ? 'extrato-valor extrato-valor-entrada'
                      : 'extrato-valor extrato-valor-saida'
                  }
                >
                  {item.tipo === 'entrada' ? '+' : '−'} {formatarMoeda(item.valor)}
                </span>
              </div>
            ))}
            <div className="extrato-total">
              <span>Saldo do mês</span>
              <span className="extrato-valor">{formatarMoeda(saldoDoExemplo)}</span>
            </div>
          </div>
        </div>

        <p className="texto-miudo" style={{ color: '#7f8ca4' }}>
          Suas finanças acompanham você. Acesse sua conta pelo celular ou computador.
        </p>
      </section>

      <section className="entrada-painel">
        <div className="entrada-caixa"><div className="entrada-boas-vindas"><h2>Bem-vindo ao Planeora</h2><p>Organize o presente. Planeje o que vem depois.</p></div>
          <div className="entrada-abas" role="group" aria-label="Entrar ou criar conta">
            <button
              type="button"
              aria-pressed={modo === 'entrar'}
              onClick={() => trocarModo('entrar')}
            >
              Entrar
            </button>
            <button
              type="button"
              aria-pressed={modo === 'criar'}
              onClick={() => trocarModo('criar')}
            >
              Criar conta
            </button>
          </div>

          <form className="formulario" onSubmit={(evento) => void enviar(evento)}>
            {modo === 'criar' ? (
              <label className="campo">
                <span>Nome</span>
                <input
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  value={nome}
                  onChange={(evento) => definirNome(evento.target.value)}
                />
              </label>
            ) : null}

            <label className="campo">
              <span>E-mail</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(evento) => definirEmail(evento.target.value)}
              />
            </label>

            <label className="campo">
              <span>Senha</span>
              <input
                type="password"
                autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
                value={senha}
                onChange={(evento) => definirSenha(evento.target.value)}
              />
              {modo === 'criar' ? (
                <span className="dica-campo">Pelo menos 6 caracteres.</span>
              ) : null}
            </label>

            {erro ? <div className="aviso aviso-erro">{erro}</div> : null}
            {recado ? <div className="aviso aviso-sucesso">{recado}</div> : null}

            {modo === 'criar' && <label className="aceite-legal"><input type="checkbox" checked={aceite} onChange={e => aceitar(e.target.checked)} />
              <span>Aceito os <Link to="/termos-de-uso" target="_blank" rel="noopener noreferrer">Termos de Uso</Link> e li a <Link to="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</Link>.</span></label>}
            <button type="submit" className="botao botao-principal" disabled={enviando}>
              {enviando
                ? 'Um instante…'
                : modo === 'entrar'
                  ? 'Entrar'
                  : 'Criar conta e começar'}
            </button>

            {modo === 'entrar' ? (
              <button
                type="button"
                className="botao-texto"
                onClick={() => void pedirNovaSenha()}
                disabled={enviando}
              >
                Esqueci minha senha
              </button>
            ) : null}
          </form>
          <InstalarAplicativo /><nav className="links-legais" aria-label="Informações legais"><Link to="/conheca">Conhecer o Planeora</Link><Link to="/atendimento">SAC e ajuda</Link><Link to="/politica-de-privacidade">Privacidade</Link><Link to="/termos-de-uso">Termos de Uso</Link></nav>
        </div>
      </section>
    </div>
  );
}
