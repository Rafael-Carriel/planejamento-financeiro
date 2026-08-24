import { useState, type FormEvent } from 'react';

import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { atualizarNome, mensagemDeErro } from '../servicos/servicoAutenticacao';
import { formatarData } from '../utilitarios/formatadores';
import { Modal } from './Modal';

/// Conta do usuário: trocar o nome exibido e sair.
export function ModalDaConta({ aoFechar }: { aoFechar: () => void }) {
  const { usuario, perfil, nomeParaExibir, sair, recarregarPerfil } = useAutenticacao();
  const [nome, definirNome] = useState(perfil?.nome ?? nomeParaExibir);
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvo, definirSalvo] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!usuario) return;

    const limpo = nome.trim();
    if (limpo.length === 0) {
      definirErro('O nome não pode ficar vazio.');
      return;
    }

    definirSalvando(true);
    definirErro(null);
    definirSalvo(false);
    try {
      await atualizarNome(usuario.uid, limpo);
      await recarregarPerfil();
      definirSalvo(true);
    } catch (falha) {
      definirErro(mensagemDeErro(falha));
    } finally {
      definirSalvando(false);
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
      <form className="formulario" onSubmit={(evento) => void salvar(evento)}>
        <label className="campo">
          <span>Nome</span>
          <input
            type="text"
            maxLength={80}
            value={nome}
            onChange={(evento) => {
              definirNome(evento.target.value);
              definirSalvo(false);
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

        {erro ? <div className="aviso aviso-erro">{erro}</div> : null}
        {salvo && !erro ? <div className="aviso aviso-sucesso">Nome atualizado.</div> : null}

        <button type="submit" className="botao botao-suave" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar nome'}
        </button>
      </form>
    </Modal>
  );
}
