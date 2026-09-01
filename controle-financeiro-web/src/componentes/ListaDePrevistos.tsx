import { useCallback, useState } from 'react';

import { useDados } from '../contextos/ContextoDados';
import { descricaoDaOcorrencia } from '../dominio/recorrencias';
import type { OcorrenciaPrevista } from '../tipos';
import { rotuloDoMesCurto } from '../utilitarios/datas';
import { formatarData, formatarMoeda } from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';
import { Dinheiro } from './Dinheiro';

let _scrollAntesDeLancar: number | null = null;

function restaurarScroll() {
  if (_scrollAntesDeLancar !== null) {
    const y = _scrollAntesDeLancar;
    _scrollAntesDeLancar = null;
    window.scrollTo({ top: y, behavior: 'instant' });
  }
}

interface Propriedades {
  ocorrencias: OcorrenciaPrevista[];
  comMes?: boolean;
  semAcoes?: boolean;
  comSelecao?: boolean;
  aoLancar?: () => void;
}

const SELO_DA_SITUACAO: Record<
  OcorrenciaPrevista['situacao'],
  { classe: string; rotulo: string }
> = {
  lancada: { classe: 'selo-situacao selo-tranquilo', rotulo: 'lançado' },
  atrasada: { classe: 'selo-situacao selo-estourado', rotulo: 'venceu' },
  aVencer: { classe: 'selo-situacao selo-sem-limite', rotulo: 'a vencer' },
};

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

  const pendentes = ocorrencias.filter((o) => o.situacao !== 'lancada');

  const alternarSelecao = useCallback((chave: string) => {
    definirSelecionadas((anterior) => {
      const proximo = new Set(anterior);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  }, []);

  const selecionarTudo = useCallback(() => {
    definirSelecionadas(new Set(pendentes.map((o) => o.chave)));
  }, [pendentes]);

  const limparSelecao = useCallback(() => {
    definirSelecionadas(new Set());
  }, []);

  const todasSelecionadas =
    pendentes.length > 0 && selecionadas.size === pendentes.length;

  async function lancarUma(ocorrencia: OcorrenciaPrevista) {
    _scrollAntesDeLancar = window.scrollY;
    definirLancando(ocorrencia.chave);
    definirErro(null);
    try {
      await lancarPrevisto(ocorrencia);
      aoLancar?.();
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : 'Não deu para lançar. Tente de novo.',
      );
    } finally {
      definirLancando(null);
      setTimeout(restaurarScroll, 0);
    }
  }

  async function lancarSelecionadas() {
    const alvo =
      selecionadas.size > 0
        ? pendentes.filter((o) => selecionadas.has(o.chave))
        : pendentes;
    if (alvo.length === 0) return;
    _scrollAntesDeLancar = window.scrollY;
    definirLancando('batch');
    definirErro(null);
    try {
      await lancarPrevistos(alvo);
      definirSelecionadas(new Set());
      aoLancar?.();
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : 'Não deu para lançar. Tente de novo.',
      );
    } finally {
      definirLancando(null);
      setTimeout(restaurarScroll, 0);
    }
  }

  const valoresSelecionados = pendentes
    .filter((o) => selecionadas.has(o.chave))
    .reduce(
      (acc, o) => acc + (o.tipo === 'entrada' ? o.valor : -o.valor),
      0,
    );

  return (
    <>
      {erro ? <div className="aviso aviso-erro">{erro}</div> : null}

      {comSelecao && pendentes.length > 0 && (
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
            {selecionadas.size > 0 && (
              <span className="previstos-selecao-resumo">
                {selecionadas.size} selecionado{selecionadas.size > 1 ? 's' : ''}{' '}
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
              : selecionadas.size > 0
                ? `Lançar ${selecionadas.size} selecionado${selecionadas.size > 1 ? 's' : ''}`
                : `Lançar tudo (${pendentes.length})`}
          </button>
        </div>
      )}

      <ul className="lista-lancamentos">
        {ocorrencias.map((ocorrencia) => {
          const categoria = descreverCategoria(ocorrencia.categoria);
          const ehEntrada = ocorrencia.tipo === 'entrada';
          const selo = SELO_DA_SITUACAO[ocorrencia.situacao];
          const jaLancada = ocorrencia.situacao === 'lancada';
          const estaSelecionada = selecionadas.has(ocorrencia.chave);

          return (
            <li
              className={[
                'lancamento',
                'lancamento-com-acao',
                !jaLancada && 'lancamento-previsto',
                comSelecao && !jaLancada && estaSelecionada && 'lancamento-selecionado',
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
                  <span className={selo.classe}>{selo.rotulo}</span>
                </div>
              </div>

              <Dinheiro
                valor={ehEntrada ? ocorrencia.valor : -ocorrencia.valor}
                cor={ehEntrada ? 'entrada' : 'saida'}
                comSinal
                className="lancamento-valor"
              />

              <div className="lancamento-acao">
                {jaLancada || semAcoes ? null : comSelecao ? (
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
