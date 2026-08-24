import { useState } from 'react';

import { useDados } from '../contextos/ContextoDados';
import { descricaoDaOcorrencia } from '../dominio/recorrencias';
import type { OcorrenciaPrevista } from '../tipos';
import { rotuloDoMesCurto } from '../utilitarios/datas';
import { formatarData } from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';
import { Dinheiro } from './Dinheiro';

/// Lista de ocorrências previstas — o que a recorrência diz que vai acontecer.
///
/// Reaproveita a mesma linha do extrato de propósito: previsto e lançado ficam
/// visualmente irmãos, e a diferença é a borda tracejada mais o selo de
/// situação. O botão "Lançar" é o que transforma a previsão em dinheiro de
/// verdade — nada é gravado sem esse clique.

interface Propriedades {
  ocorrencias: OcorrenciaPrevista[];
  /// Mostra o mês na linha. Ligado na previsão, onde a lista atravessa meses.
  comMes?: boolean;
  /// Esconde o botão de lançar (útil quando a lista é só informativa).
  semAcoes?: boolean;
  /// Avisa depois de lançar. A previsão usa para reler o período: o lançamento
  /// pode cair num mês que não é o assinado ao vivo, e sem isto a linha ficaria
  /// como "a vencer" mesmo já tendo sido lançada.
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
  aoLancar,
}: Propriedades) {
  const { descreverCategoria, lancarPrevisto } = useDados();
  const [lancando, definirLancando] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  async function lancar(ocorrencia: OcorrenciaPrevista) {
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
    }
  }

  return (
    <>
      {erro ? <div className="aviso aviso-erro">{erro}</div> : null}

      <ul className="lista-lancamentos">
        {ocorrencias.map((ocorrencia) => {
          const categoria = descreverCategoria(ocorrencia.categoria);
          const ehEntrada = ocorrencia.tipo === 'entrada';
          const selo = SELO_DA_SITUACAO[ocorrencia.situacao];
          const jaLancada = ocorrencia.situacao === 'lancada';

          return (
            <li
              className={
                jaLancada
                  ? 'lancamento lancamento-com-acao'
                  : 'lancamento lancamento-com-acao lancamento-previsto'
              }
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

              {/* Classe própria, não `.lancamento-acoes`: aquela desaparece no
                  celular (os ícones de editar/excluir cabem no toque longo), e o
                  "Lançar" é a ação principal desta lista — precisa aparecer em
                  qualquer tela. */}
              <div className="lancamento-acao">
                {jaLancada || semAcoes ? null : (
                  <button
                    type="button"
                    className="botao-texto"
                    onClick={() => void lancar(ocorrencia)}
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
