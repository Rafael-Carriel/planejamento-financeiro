import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDados } from '../contextos/ContextoDados';
import { descricaoDaOcorrencia } from '../dominio/recorrencias';
import type { OcorrenciaPrevista } from '../tipos';
import { rotuloDoMesCurto } from '../utilitarios/datas';
import { formatarData, formatarMoeda } from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';
import { Dinheiro } from './Dinheiro';

interface Propriedades {
  ocorrencias: OcorrenciaPrevista[];
  comMes?: boolean;
  semAcoes?: boolean;
  comSelecao?: boolean;
  aoLancar?: (ocorrencias: OcorrenciaPrevista[]) => void | Promise<void>;
}

export function ListaDePrevistos({
  ocorrencias,
  comMes = false,
  semAcoes = false,
  comSelecao = false,
  aoLancar,
}: Propriedades) {
  const { descreverCategoria, lancarPrevisto, lancarPrevistos } = useDados();
  const [lancando, definirLancando] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [selecionadas, definirSelecionadas] = useState<Set<string>>(new Set());
  // A escrita no Firestore termina antes de algumas consultas refletirem o
  // novo documento. Esconder a ocorrência confirmada localmente evita que o
  // botão volte a ficar disponível nesse intervalo e elimina a necessidade de
  // travar a rolagem da página inteira.
  const [lancadasLocalmente, definirLancadasLocalmente] = useState<Set<string>>(
    new Set(),
  );

  const pendentes = useMemo(
    () =>
      ocorrencias.filter(
        (ocorrencia) =>
          ocorrencia.situacao !== 'lancada' &&
          !lancadasLocalmente.has(ocorrencia.chave),
      ),
    [ocorrencias, lancadasLocalmente],
  );

  const acionaveis = useMemo(
    () => pendentes.filter((ocorrencia) => ocorrencia.modoLancamento === 'confirmar'),
    [pendentes],
  );

  // Assim que a fonte de dados confirmar o lançamento, o marcador provisório
  // deixa de ser necessário. Se a transação for excluída depois, a previsão
  // pode reaparecer normalmente em vez de ficar escondida para sempre.
  useEffect(() => {
    const confirmadas = new Set(
      ocorrencias
        .filter((ocorrencia) => ocorrencia.situacao === 'lancada')
        .map((ocorrencia) => ocorrencia.chave),
    );
    if (confirmadas.size === 0) return;

    definirLancadasLocalmente((anteriores) => {
      const proximas = new Set(
        [...anteriores].filter((chave) => !confirmadas.has(chave)),
      );
      return proximas.size === anteriores.size ? anteriores : proximas;
    });
  }, [ocorrencias]);

  // Uma atualização externa pode lançar uma ocorrência que estava marcada.
  // Só as chaves ainda visíveis participam dos totais e da ação em lote.
  const selecionadasValidas = useMemo(() => {
    const chavesPendentes = new Set(acionaveis.map((ocorrencia) => ocorrencia.chave));
    return new Set([...selecionadas].filter((chave) => chavesPendentes.has(chave)));
  }, [acionaveis, selecionadas]);

  const alternarSelecao = useCallback((chave: string) => {
    definirSelecionadas((anterior) => {
      const proximo = new Set(anterior);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  }, []);

  const selecionarTudo = useCallback(() => {
    definirSelecionadas(new Set(acionaveis.map((o) => o.chave)));
  }, [acionaveis]);

  const limparSelecao = useCallback(() => {
    definirSelecionadas(new Set());
  }, []);

  const todasSelecionadas =
    acionaveis.length > 0 && selecionadasValidas.size === acionaveis.length;

  async function lancarUma(ocorrencia: OcorrenciaPrevista) {
    if (ocorrencia.modoLancamento === 'automatico') return;
    definirLancando(ocorrencia.chave);
    definirErro(null);
    try {
      await lancarPrevisto(ocorrencia);
      definirLancadasLocalmente((anteriores) => {
        const proximas = new Set(anteriores);
        proximas.add(ocorrencia.chave);
        return proximas;
      });
      await aoLancar?.([ocorrencia]);
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : 'Não deu para lançar. Tente de novo.',
      );
    } finally {
      definirLancando(null);
    }
  }

  async function lancarSelecionadas() {
    const alvo =
      selecionadasValidas.size > 0
        ? acionaveis.filter((o) => selecionadasValidas.has(o.chave))
        : acionaveis;
    if (alvo.length === 0) return;
    definirLancando('batch');
    definirErro(null);
    try {
      await lancarPrevistos(alvo);
      definirLancadasLocalmente((anteriores) => {
        const proximas = new Set(anteriores);
        for (const ocorrencia of alvo) proximas.add(ocorrencia.chave);
        return proximas;
      });
      definirSelecionadas(new Set());
      await aoLancar?.(alvo);
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : 'Não deu para lançar. Tente de novo.',
      );
    } finally {
      definirLancando(null);
    }
  }

  const valoresSelecionados = acionaveis
    .filter((o) => selecionadasValidas.has(o.chave))
    .reduce(
      (acc, o) => acc + (o.tipo === 'entrada' ? o.valor : -o.valor),
      0,
    );

  return (
    <>
      {erro ? <div className="aviso aviso-erro">{erro}</div> : null}

      {comSelecao && acionaveis.length > 0 && (
        <div className="previstos-barra-acoes">
          <div className="previstos-selecao-info">
            <label className="previstos-checkbox-label">
              <input
                type="checkbox"
                className="previstos-checkbox"
                checked={todasSelecionadas}
                onChange={todasSelecionadas ? limparSelecao : selecionarTudo}
              />
              {todasSelecionadas ? 'Desmarcar tudo' : 'Selecionar tudo'}
            </label>
            {selecionadasValidas.size > 0 && (
              <span className="previstos-selecao-resumo">
                {selecionadasValidas.size} selecionado{selecionadasValidas.size > 1 ? 's' : ''}{' '}
                · {formatarMoeda(Math.abs(valoresSelecionados))}
              </span>
            )}
          </div>
          <button
            type="button"
            className="botao botao-principal"
            onClick={() => void lancarSelecionadas()}
            disabled={lancando !== null}
          >
            {lancando === 'batch'
              ? 'Lançando…'
              : selecionadasValidas.size > 0
                ? `Lançar ${selecionadasValidas.size} selecionado${selecionadasValidas.size > 1 ? 's' : ''}`
                : `Lançar tudo (${acionaveis.length})`}
          </button>
        </div>
      )}

      <ul className="lista-lancamentos">
        {pendentes.map((ocorrencia) => {
          const categoria = descreverCategoria(ocorrencia.categoria);
          const ehEntrada = ocorrencia.tipo === 'entrada';
          const estaSelecionada = selecionadasValidas.has(ocorrencia.chave);

          return (
            <li
              className={[
                'lancamento',
                'lancamento-com-acao',
                'lancamento-previsto',
                comSelecao && estaSelecionada && 'lancamento-selecionado',
              ]
                .filter(Boolean)
                .join(' ')}
              key={ocorrencia.chave}
            >
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
                <div className="lancamento-descricao">
                  {descricaoDaOcorrencia(ocorrencia)}
                </div>
                <div className="lancamento-meta">
                  <span
                    className="marcador-categoria"
                    style={comVariaveis({ '--cor-marcador': categoria.cor })}
                  />
                  <span>{ocorrencia.categoria}</span>
                  <span>· {formatarData(ocorrencia.data)}</span>
                  {comMes ? <span>· {rotuloDoMesCurto(ocorrencia.data)}</span> : null}
                  <span className={
                    ocorrencia.situacao === 'atrasada'
                      ? 'selo-situacao selo-estourado'
                      : 'selo-situacao selo-sem-limite'
                  }>{ocorrencia.situacao === 'atrasada' ? 'venceu' : 'a vencer'}</span>
                </div>
              </div>

              <Dinheiro
                valor={ehEntrada ? ocorrencia.valor : -ocorrencia.valor}
                cor={ehEntrada ? 'entrada' : 'saida'}
                comSinal
                className="lancamento-valor"
              />

              <div className="lancamento-acao">
                {semAcoes ? null : ocorrencia.modoLancamento === 'automatico' ? (
                  <span
                    className="selo-situacao selo-sem-limite"
                    title="Será lançado automaticamente na data prevista"
                  >
                    automático
                  </span>
                ) : comSelecao ? (
                  <input
                    type="checkbox"
                    className="previstos-checkbox-item"
                    checked={estaSelecionada}
                    onChange={() => alternarSelecao(ocorrencia.chave)}
                  />
                ) : (
                  <button
                    type="button"
                    className="botao-texto"
                    onClick={() => void lancarUma(ocorrencia)}
                    disabled={lancando !== null}
                    title={
                      ehEntrada
                        ? 'Registrar que este dinheiro entrou'
                        : 'Registrar que esta conta foi paga'
                    }
                  >
                    {lancando === ocorrencia.chave ? 'Lançando…' : 'Lançar'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
