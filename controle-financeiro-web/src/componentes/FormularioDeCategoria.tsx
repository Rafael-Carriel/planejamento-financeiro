import { useState, type FormEvent } from 'react';

import { useDados } from '../contextos/ContextoDados';
import { EMOJIS_SUGERIDOS, PALETA_DE_CORES } from '../dados/catalogoCategorias';
import type { Categoria, TipoTransacao } from '../tipos';
import { comVariaveis } from '../utilitarios/estilo';
import { Modal } from './Modal';

/// Criação e ajuste de categoria.
///
/// Na edição, o nome fica travado de propósito: o lançamento guarda a categoria
/// como texto, então renomear aqui desligaria a categoria de todo o histórico
/// que já usou o nome antigo. Quem quer outro nome cria outra categoria.

interface Propriedades {
  /// `null` cria uma categoria nova.
  categoria: Categoria | null;
  tipoInicial: TipoTransacao;
  aoFechar: () => void;
}

export function FormularioDeCategoria({ categoria, tipoInicial, aoFechar }: Propriedades) {
  const { categorias, salvarCategoria, editarCategoria } = useDados();
  const editando = categoria !== null;

  const [tipo, definirTipo] = useState<TipoTransacao>(categoria?.tipo ?? tipoInicial);
  const [nome, definirNome] = useState(categoria?.nome ?? '');
  const [emoji, definirEmoji] = useState(categoria?.emoji ?? '📌');
  const [cor, definirCor] = useState(categoria?.cor ?? PALETA_DE_CORES[0]);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    definirErro(null);

    if (editando && categoria) {
      definirSalvando(true);
      try {
        await editarCategoria(categoria.id, { emoji, cor });
        aoFechar();
      } catch (falha) {
        definirErro(falha instanceof Error ? falha.message : 'Não deu para salvar.');
      } finally {
        definirSalvando(false);
      }
      return;
    }

    const limpo = nome.trim();
    if (limpo.length === 0) {
      definirErro('Dê um nome à categoria.');
      return;
    }
    if (limpo.length > 60) {
      definirErro('O nome pode ter até 60 caracteres.');
      return;
    }

    const repetida = categorias.some(
      (existente) =>
        existente.tipo === tipo &&
        existente.nome.localeCompare(limpo, 'pt-BR', { sensitivity: 'base' }) === 0,
    );
    if (repetida) {
      definirErro(`Já existe uma categoria de ${tipo === 'entrada' ? 'entrada' : 'saída'} com esse nome.`);
      return;
    }

    definirSalvando(true);
    try {
      await salvarCategoria({ nome: limpo, tipo, emoji, cor });
      aoFechar();
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não deu para salvar.');
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <Modal
      titulo={editando ? 'Ajustar categoria' : 'Nova categoria'}
      descricao={
        editando
          ? 'Emoji e cor podem mudar. O nome fica como está para não desligar a categoria dos lançamentos antigos.'
          : undefined
      }
      aoFechar={aoFechar}
      rodape={
        <>
          <button
            type="button"
            className="botao botao-contorno"
            onClick={aoFechar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="formulario-categoria"
            className="botao botao-principal"
            disabled={salvando}
          >
            {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Criar categoria'}
          </button>
        </>
      }
    >
      <form
        id="formulario-categoria"
        className="formulario"
        onSubmit={(evento) => void enviar(evento)}
      >
        {editando ? null : (
          <div className="campo">
            <span>Tipo</span>
            <div className="alternador">
              <button
                type="button"
                className="opcao-entrada"
                aria-pressed={tipo === 'entrada'}
                onClick={() => definirTipo('entrada')}
              >
                Entrada
              </button>
              <button
                type="button"
                className="opcao-saida"
                aria-pressed={tipo === 'saida'}
                onClick={() => definirTipo('saida')}
              >
                Saída
              </button>
            </div>
          </div>
        )}

        <label className="campo">
          <span>Nome</span>
          <input
            type="text"
            maxLength={60}
            value={nome}
            disabled={editando}
            onChange={(evento) => definirNome(evento.target.value)}
            placeholder="Academia, Pets, Bônus…"
          />
          {editando ? (
            <span className="dica-campo">O nome de uma categoria criada não muda.</span>
          ) : null}
        </label>

        <div className="campo">
          <span>Emoji</span>
          <div className="grade-emojis">
            {EMOJIS_SUGERIDOS.map((opcao) => (
              <button
                key={opcao}
                type="button"
                aria-pressed={emoji === opcao}
                aria-label={`Emoji ${opcao}`}
                onClick={() => definirEmoji(opcao)}
              >
                {opcao}
              </button>
            ))}
          </div>
        </div>

        <div className="campo">
          <span>Cor</span>
          <div className="grade-cores">
            {PALETA_DE_CORES.map((opcao) => (
              <button
                key={opcao}
                type="button"
                className="amostra-cor"
                style={comVariaveis({ '--cor-amostra': opcao })}
                aria-pressed={cor === opcao}
                aria-label={`Cor ${opcao}`}
                onClick={() => definirCor(opcao)}
              />
            ))}
          </div>
        </div>

        <div className="campo">
          <span>Como vai aparecer</span>
          <div className="lancamento" style={{ border: '1px solid var(--borda)', borderRadius: 'var(--raio-pequeno)' }}>
            <span
              className="lancamento-selo"
              style={comVariaveis({
                '--cor-selo': tipo === 'entrada' ? 'var(--entrada-clara)' : 'var(--saida-clara)',
              })}
              aria-hidden="true"
            >
              {emoji}
            </span>
            <div className="lancamento-textos">
              <div className="lancamento-descricao">
                {nome.trim().length > 0 ? nome.trim() : 'Nome da categoria'}
              </div>
              <div className="lancamento-meta">
                <span className="marcador-categoria" style={comVariaveis({ '--cor-marcador': cor })} />
                <span>{tipo === 'entrada' ? 'Entrada' : 'Saída'}</span>
              </div>
            </div>
          </div>
        </div>

        {erro ? <div className="aviso aviso-erro">{erro}</div> : null}
      </form>
    </Modal>
  );
}
