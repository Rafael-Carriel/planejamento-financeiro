import { useState, type FormEvent } from 'react';

import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { mensagemDeErro } from '../servicos/servicoAutenticacao';
import { formatarData } from '../utilitarios/formatadores';
import { Modal } from './Modal';

/// Abas do perfil.
type AbaPerfil = 'nome' | 'email' | 'senha';

/// Conta do usuário: trocar nome, e-mail, senha e sair.
export function ModalDaConta({ aoFechar }: { aoFechar: () => void }) {
  const { usuario, perfil, nomeParaExibir, sair, atualizarNome, atualizarEmail, atualizarSenha } =
    useAutenticacao();

  // Estado da aba selecionada.
  const [aba, definirAba] = useState<AbaPerfil>('nome');

  // Estado do formulário de nome.
  const [nome, definirNome] = useState(perfil?.nome ?? nomeParaExibir);
  const [salvandoNome, definirSalvandoNome] = useState(false);
  const [erroNome, definirErroNome] = useState<string | null>(null);
  const [salvoNome, definirSalvoNome] = useState(false);

  // Estado do formulário de e-mail.
  const [novoEmail, definirNovoEmail] = useState('');
  const [senhaAtualEmail, definirSenhaAtualEmail] = useState('');
  const [salvandoEmail, definirSalvandoEmail] = useState(false);
  const [erroEmail, definirErroEmail] = useState<string | null>(null);
  const [salvoEmail, definirSalvoEmail] = useState(false);

  // Estado do formulário de senha.
  const [senhaAtualSenha, definirSenhaAtualSenha] = useState('');
  const [novaSenha, definirNovaSenha] = useState('');
  const [confirmarSenha, definirConfirmarSenha] = useState('');
  const [salvandoSenha, definirSalvandoSenha] = useState(false);
  const [erroSenha, definirErroSenha] = useState<string | null>(null);
  const [salvoSenha, definirSalvoSenha] = useState(false);

  // Salvar nome.
  async function salvarNome(evento: FormEvent) {
    evento.preventDefault();

    const limpo = nome.trim();
    if (limpo.length === 0) {
      definirErroNome('O nome não pode ficar vazio.');
      return;
    }

    definirSalvandoNome(true);
    definirErroNome(null);
    definirSalvoNome(false);
    try {
      await atualizarNome(limpo);
      definirSalvoNome(true);
    } catch (falha) {
      definirErroNome(mensagemDeErro(falha));
    } finally {
      definirSalvandoNome(false);
    }
  }

  // Salvar e-mail.
  async function salvarEmail(evento: FormEvent) {
    evento.preventDefault();

    const emailLimpo = novoEmail.trim();
    if (emailLimpo.length === 0) {
      definirErroEmail('Digite o novo e-mail.');
      return;
    }
    if (senhaAtualEmail.length === 0) {
      definirErroEmail('Digite a senha atual para confirmar.');
      return;
    }

    definirSalvandoEmail(true);
    definirErroEmail(null);
    definirSalvoEmail(false);
    try {
      await atualizarEmail(emailLimpo, senhaAtualEmail);
      definirSalvoEmail(true);
      definirNovoEmail('');
      definirSenhaAtualEmail('');
    } catch (falha) {
      definirErroEmail(mensagemDeErro(falha));
    } finally {
      definirSalvandoEmail(false);
    }
  }

  // Salvar senha.
  async function salvarSenha(evento: FormEvent) {
    evento.preventDefault();

    if (novaSenha.length < 6) {
      definirErroSenha('A nova senha precisa de pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      definirErroSenha('As senhas não conferem.');
      return;
    }
    if (senhaAtualSenha.length === 0) {
      definirErroSenha('Digite a senha atual para confirmar.');
      return;
    }

    definirSalvandoSenha(true);
    definirErroSenha(null);
    definirSalvoSenha(false);
    try {
      await atualizarSenha(senhaAtualSenha, novaSenha);
      definirSalvoSenha(true);
      definirNovaSenha('');
      definirConfirmarSenha('');
      definirSenhaAtualSenha('');
    } catch (falha) {
      definirErroSenha(mensagemDeErro(falha));
    } finally {
      definirSalvandoSenha(false);
    }
  }

  return (
    <Modal
      titulo="Sua conta"
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="botao botao-contorno" onClick={() => void sair()}>
            Sair da conta
          </button>
          <button type="button" className="botao botao-principal" onClick={aoFechar}>
            Fechar
          </button>
        </>
      }
    >
      {/* Abas */}
      <div className="abas-perfil" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'nome'}
          className={`aba${aba === 'nome' ? ' ativa' : ''}`}
          onClick={() => definirAba('nome')}
        >
          Nome
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'email'}
          className={`aba${aba === 'email' ? ' ativa' : ''}`}
          onClick={() => definirAba('email')}
        >
          E-mail
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'senha'}
          className={`aba${aba === 'senha' ? ' ativa' : ''}`}
          onClick={() => definirAba('senha')}
        >
          Senha
        </button>
      </div>

      {/* Aba: Nome */}
      {aba === 'nome' && (
        <form className="formulario" onSubmit={(evento) => void salvarNome(evento)}>
          <label className="campo">
            <span>Nome</span>
            <input
              type="text"
              maxLength={80}
              value={nome}
              onChange={(evento) => {
                definirNome(evento.target.value);
                definirSalvoNome(false);
              }}
            />
            <span className="dica-campo">É o nome que aparece no canto da tela.</span>
          </label>

          <div className="campo">
            <span>E-mail</span>
            <p className="texto-apoio">{usuario?.email ?? '—'}</p>
          </div>

          {perfil?.criadoEm ? (
            <p className="texto-miudo">Conta criada em {formatarData(perfil.criadoEm)}.</p>
          ) : null}

          {erroNome ? <div className="aviso aviso-erro">{erroNome}</div> : null}
          {salvoNome && !erroNome ? (
            <div className="aviso aviso-sucesso">Nome atualizado.</div>
          ) : null}

          <button type="submit" className="botao botao-suave" disabled={salvandoNome}>
            {salvandoNome ? 'Salvando…' : 'Salvar nome'}
          </button>
        </form>
      )}

      {/* Aba: E-mail */}
      {aba === 'email' && (
        <form className="formulario" onSubmit={(evento) => void salvarEmail(evento)}>
          <div className="campo">
            <span>E-mail atual</span>
            <p className="texto-apoio">{usuario?.email ?? '—'}</p>
          </div>

          <label className="campo">
            <span>Novo e-mail</span>
            <input
              type="email"
              value={novoEmail}
              onChange={(evento) => {
                definirNovoEmail(evento.target.value);
                definirSalvoEmail(false);
              }}
              placeholder="novo@email.com"
            />
          </label>

          <label className="campo">
            <span>Senha atual</span>
            <input
              type="password"
              value={senhaAtualEmail}
              onChange={(evento) => {
                definirSenhaAtualEmail(evento.target.value);
                definirSalvoEmail(false);
              }}
              placeholder="Sua senha atual"
            />
            <span className="dica-campo">
              Por segurança, digite sua senha atual para confirmar a troca.
            </span>
          </label>

          {erroEmail ? <div className="aviso aviso-erro">{erroEmail}</div> : null}
          {salvoEmail && !erroEmail ? (
            <div className="aviso aviso-sucesso">E-mail atualizado com sucesso.</div>
          ) : null}

          <button type="submit" className="botao botao-suave" disabled={salvandoEmail}>
            {salvandoEmail ? 'Salvando…' : 'Salvar e-mail'}
          </button>
        </form>
      )}

      {/* Aba: Senha */}
      {aba === 'senha' && (
        <form className="formulario" onSubmit={(evento) => void salvarSenha(evento)}>
          <label className="campo">
            <span>Senha atual</span>
            <input
              type="password"
              value={senhaAtualSenha}
              onChange={(evento) => {
                definirSenhaAtualSenha(evento.target.value);
                definirSalvoSenha(false);
              }}
              placeholder="Sua senha atual"
            />
          </label>

          <label className="campo">
            <span>Nova senha</span>
            <input
              type="password"
              value={novaSenha}
              onChange={(evento) => {
                definirNovaSenha(evento.target.value);
                definirSalvoSenha(false);
              }}
              placeholder="Mínimo 6 caracteres"
            />
            <span className="dica-campo">Mínimo de 6 caracteres.</span>
          </label>

          <label className="campo">
            <span>Confirmar nova senha</span>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(evento) => {
                definirConfirmarSenha(evento.target.value);
                definirSalvoSenha(false);
              }}
              placeholder="Digite a nova senha novamente"
            />
          </label>

          {erroSenha ? <div className="aviso aviso-erro">{erroSenha}</div> : null}
          {salvoSenha && !erroSenha ? (
            <div className="aviso aviso-sucesso">Senha atualizada com sucesso.</div>
          ) : null}

          <button type="submit" className="botao botao-suave" disabled={salvandoSenha}>
            {salvandoSenha ? 'Salvando…' : 'Salvar senha'}
          </button>
        </form>
      )}
    </Modal>
  );
}
