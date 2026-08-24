import { useMemo, useState } from 'react';

import { useDados } from '../contextos/ContextoDados';
import { useLancamento } from '../contextos/ContextoLancamento';
import type { Transacao } from '../tipos';
import { chaveDoMes } from '../utilitarios/datas';
import {
  formatarData,
  formatarDiaDaSemana,
  formatarMoeda,
} from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';
import { Dinheiro } from './Dinheiro';
import { Modal } from './Modal';

/// Lista de lançamentos agrupada por dia.
///
/// O agrupamento por dia é o que faz a lista parecer um extrato: o cabeçalho de
/// cada dia mostra o saldo daquele dia, então dá para ver o efeito de um dia
/// inteiro sem somar de cabeça.

interface Propriedades {
  transacoes: Transacao[];
  /// Quando `true`, mostra a data completa em cada linha em vez de agrupar por
  /// dia. Serve para listas que atravessam meses, como a do histórico.
  comDataNaLinha?: boolean;
}

interface GrupoDoDia {
  chave: string;
  data: Date;
  itens: Transacao[];
  saldo: number;
}

function agruparPorDia(transacoes: Transacao[]): GrupoDoDia[] {
  const grupos = new Map<string, GrupoDoDia>();

  for (const transacao of transacoes) {
    const chave = `${chaveDoMes(transacao.data)}-${String(transacao.data.getDate()).padStart(2, '0')}`;
    const grupo = grupos.get(chave) ?? {
      chave,
      data: transacao.data,
      itens: [],
      saldo: 0,
    };
    grupo.itens.push(transacao);
    grupo.saldo += transacao.tipo === 'entrada' ? transacao.valor : -transacao.valor;
    grupos.set(chave, grupo);
  }

  // As transações já chegam do Firestore em ordem decrescente de data, então a
  // ordem de inserção dos grupos já é a ordem certa.
  return [...grupos.values()];
}

export function ListaDeLancamentos({ transacoes, comDataNaLinha = false }: Propriedades) {
  const { descreverCategoria, removerTransacao } = useDados();
  const { abrirEdicao } = useLancamento();
  const [paraExcluir, definirParaExcluir] = useState<Transacao | null>(null);
  const [excluindo, definirExcluindo] = useState(false);
  const [erroAoExcluir, definirErroAoExcluir] = useState<string | null>(null);

  const grupos = useMemo(() => agruparPorDia(transacoes), [transacoes]);

  async function confirmarExclusao() {
    if (!paraExcluir) return;
    definirExcluindo(true);
    definirErroAoExcluir(null);
    try {
      await removerTransacao(paraExcluir.id);
      definirParaExcluir(null);
    } catch (erro) {
      definirErroAoExcluir(
        erro instanceof Error ? erro.message : 'Não deu para excluir. Tente de novo.',
      );
    } finally {
      definirExcluindo(false);
    }
  }

  function linha(transacao: Transacao) {
    const categoria = descreverCategoria(transacao.categoria);
    const ehEntrada = transacao.tipo === 'entrada';

    return (
      <li className="lancamento" key={transacao.id}>
        <span
          className="lancamento-selo"
          style={comVariaveis({
            '--cor-selo': ehEntrada ? 'var(--entrada-clara)' : 'var(--saida-clara)',
          })}
          aria-hidden="true"
        >
          {categoria.emoji}
        </span>

        <div className="lancamento-textos">
          <div className="lancamento-descricao">{transacao.descricao}</div>
          <div className="lancamento-meta">
            <span
              className="marcador-categoria"
              style={comVariaveis({ '--cor-marcador': categoria.cor })}
            />
            <span>{transacao.categoria}</span>
            {comDataNaLinha ? <span>· {formatarData(transacao.data)}</span> : null}
            {transacao.observacao ? <span>· {transacao.observacao}</span> : null}
          </div>
        </div>

        <Dinheiro
          valor={ehEntrada ? transacao.valor : -transacao.valor}
          cor={ehEntrada ? 'entrada' : 'saida'}
          comSinal
          className="lancamento-valor"
        />

        <div className="lancamento-acoes">
          <button
            type="button"
            className="acao-miuda"
            onClick={() => abrirEdicao(transacao)}
            aria-label={`Editar ${transacao.descricao}`}
            title="Editar"
          >
            ✎
          </button>
          <button
            type="button"
            className="acao-miuda acao-miuda-perigo"
            onClick={() => definirParaExcluir(transacao)}
            aria-label={`Excluir ${transacao.descricao}`}
            title="Excluir"
          >
            🗑
          </button>
        </div>
      </li>
    );
  }

  return (
    <>
      {comDataNaLinha ? (
        <ul className="lista-lancamentos">{transacoes.map(linha)}</ul>
      ) : (
        grupos.map((grupo) => (
          <div className="grupo-dia" key={grupo.chave}>
            <div className="grupo-dia-cabeca">
              <span className="grupo-dia-data">
                {formatarData(grupo.data)} · {formatarDiaDaSemana(grupo.data)}
              </span>
              <Dinheiro valor={grupo.saldo} cor="saldo" comSinal className="texto-miudo" />
            </div>
            <ul className="lista-lancamentos">{grupo.itens.map(linha)}</ul>
          </div>
        ))
      )}

      {paraExcluir ? (
        <Modal
          titulo="Excluir lançamento"
          aoFechar={() => (excluindo ? undefined : definirParaExcluir(null))}
          rodape={
            <>
              <button
                type="button"
                className="botao botao-contorno"
                onClick={() => definirParaExcluir(null)}
                disabled={excluindo}
              >
                Manter
              </button>
              <button
                type="button"
                className="botao botao-perigo"
                onClick={() => void confirmarExclusao()}
                disabled={excluindo}
              >
                {excluindo ? 'Excluindo…' : 'Excluir'}
              </button>
            </>
          }
        >
          <div className="formulario">
            <p>
              Excluir <strong>{paraExcluir.descricao}</strong>, de{' '}
              {formatarMoeda(paraExcluir.valor)}, lançado em {formatarData(paraExcluir.data)}?
            </p>
            <p className="texto-miudo">
              O lançamento sai do mês e dos totais. Não há como desfazer.
            </p>
            {erroAoExcluir ? <div className="aviso aviso-erro">{erroAoExcluir}</div> : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
