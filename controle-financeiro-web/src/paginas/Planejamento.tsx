import { useMemo, useState } from 'react';

import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { CartaoResumo } from '../componentes/CartaoResumo';
import { Dinheiro } from '../componentes/Dinheiro';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { useDados } from '../contextos/ContextoDados';
import { useMes } from '../contextos/ContextoMes';
import { linhasDePlanejamento } from '../dominio/calculos';
import { situacaoDoLimite } from '../dominio/situacao';
import type { LinhaDePlanejamento } from '../tipos';
import {
  formatarMoeda,
  formatarNumero,
  formatarPorcentagem,
  interpretarValor,
} from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';

/// Planejamento do mês: um limite por categoria de saída.
///
/// Os limites são por mês, não perpétuos — dezembro não se planeja como
/// fevereiro. Para não obrigar a redigitar tudo todo mês, existe o botão que
/// copia os limites do mês anterior.

export function Planejamento() {
  const { rotulo, ehMesAtual } = useMes();
  const {
    transacoes,
    carregando,
    erro,
    orcamento,
    categoriasDoTipo,
    descreverCategoria,
    definirLimite,
    copiarPlanejamentoDoMesAnterior,
  } = useDados();

  // Só existe rascunho para o campo que está sendo editado agora. Ausente
  // (undefined) significa "mostre o que está no Firestore" — por isso o tipo é
  // explicitamente anulável, e não Record<string, string>.
  const [rascunhos, definirRascunhos] = useState<Record<string, string | undefined>>({});
  const [salvando, definirSalvando] = useState<string | null>(null);
  const [copiando, definirCopiando] = useState(false);
  const [recado, definirRecado] = useState<string | null>(null);
  const [erroLocal, definirErroLocal] = useState<string | null>(null);
  const [novaCategoria, definirNovaCategoria] = useState('');

  const linhas = useMemo(
    () => linhasDePlanejamento(transacoes, orcamento.limites),
    [transacoes, orcamento.limites],
  );

  const comLimite = linhas.filter((linha) => linha.limite > 0);
  const semLimite = linhas.filter((linha) => linha.limite <= 0);

  const totalPlanejado = comLimite.reduce((soma, linha) => soma + linha.limite, 0);
  const gastoNoPlanejado = comLimite.reduce((soma, linha) => soma + linha.gasto, 0);
  const gastoForaDoPlanejado = semLimite.reduce((soma, linha) => soma + linha.gasto, 0);

  // Categorias de saída que ainda não estão na tela — as que nem têm limite,
  // nem tiveram gasto no mês, nem foram acrescentadas agora pelo seletor.
  const disponiveis = useMemo(() => {
    const jaListadas = new Set([...linhas.map((linha) => linha.categoria), ...Object.keys(rascunhos)]);
    return categoriasDoTipo('saida').filter((categoria) => !jaListadas.has(categoria.nome));
  }, [linhas, rascunhos, categoriasDoTipo]);

  function textoDoCampo(linha: LinhaDePlanejamento): string {
    const rascunho = rascunhos[linha.categoria];
    if (rascunho !== undefined) return rascunho;
    return linha.limite > 0 ? formatarNumero(linha.limite) : '';
  }

  function soltarRascunho(categoria: string) {
    definirRascunhos((atual) => {
      const proximo = { ...atual };
      delete proximo[categoria];
      return proximo;
    });
  }

  async function aplicar(linha: LinhaDePlanejamento, texto: string) {
    definirErroLocal(null);
    definirRecado(null);

    const valor = texto.trim().length === 0 ? 0 : (interpretarValor(texto) ?? 0);

    // Sair do campo sem mudar nada é o caso mais comum (inclusive ao adicionar
    // uma categoria e clicar fora). Não vale uma escrita no Firestore.
    if (valor === linha.limite) {
      soltarRascunho(linha.categoria);
      return;
    }

    definirSalvando(linha.categoria);
    try {
      await definirLimite(linha.categoria, valor);
      // Solta o rascunho: daqui para frente o valor vem do Firestore.
      soltarRascunho(linha.categoria);
    } catch (falha) {
      definirErroLocal(
        falha instanceof Error ? falha.message : 'Não deu para salvar o limite.',
      );
    } finally {
      definirSalvando(null);
    }
  }

  async function copiar() {
    definirErroLocal(null);
    definirRecado(null);
    definirCopiando(true);
    try {
      const quantidade = await copiarPlanejamentoDoMesAnterior();
      definirRecado(
        quantidade === 0
          ? 'O mês anterior não tinha limites para copiar.'
          : `${quantidade} limite(s) copiados do mês anterior. O que você já havia ajustado aqui foi mantido.`,
      );
    } catch (falha) {
      definirErroLocal(falha instanceof Error ? falha.message : 'Não deu para copiar.');
    } finally {
      definirCopiando(false);
    }
  }

  function adicionar(nome: string) {
    definirNovaCategoria('');
    if (nome.length === 0) return;
    // Entra na tela com o campo em foco lógico (rascunho vazio) em vez de já
    // gravar um limite zerado no Firestore.
    definirRascunhos((atual) => ({ ...atual, [nome]: '' }));
  }

  /// As linhas mostradas: as calculadas mais as que o usuário acabou de
  /// adicionar pelo seletor e ainda não têm limite nem gasto.
  const linhasVisiveis = useMemo<LinhaDePlanejamento[]>(() => {
    const conhecidas = new Set(linhas.map((linha) => linha.categoria));
    const acrescentadas = Object.keys(rascunhos)
      .filter((categoria) => !conhecidas.has(categoria))
      .map((categoria) => ({
        categoria,
        limite: 0,
        gasto: 0,
        proporcao: 0,
        restante: 0,
      }));
    return [...linhas, ...acrescentadas];
  }, [linhas, rascunhos]);

  return (
    <>
      <CabecalhoDaPagina
        titulo="Planejamento"
        descricao={ehMesAtual ? `${rotulo} · mês em curso` : rotulo}
        acoes={
          <button
            type="button"
            className="botao botao-contorno"
            onClick={() => void copiar()}
            disabled={copiando}
          >
            {copiando ? 'Copiando…' : 'Copiar do mês anterior'}
          </button>
        }
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}
        {erroLocal ? <FaixaDeErro mensagem={erroLocal} /> : null}

        {carregando ? (
          <Carregando mensagem="Carregando o planejamento…" />
        ) : (
          <>
            {recado ? <div className="aviso aviso-sucesso">{recado}</div> : null}

            <div className="grade-resumo">
              <CartaoResumo
                rotulo="Planejado"
                valor={totalPlanejado}
                cor="saldo"
                corDaFaixa="var(--destaque)"
                nota={
                  comLimite.length === 0
                    ? 'Nenhum limite definido ainda.'
                    : `${comLimite.length} categoria(s) com limite.`
                }
              />
              <CartaoResumo
                rotulo="Gasto no planejado"
                valor={gastoNoPlanejado}
                cor="saida"
                corDaFaixa="var(--saida)"
                nota={
                  totalPlanejado > 0
                    ? `${formatarPorcentagem(gastoNoPlanejado / totalPlanejado)} do que foi planejado.`
                    : 'Defina um limite para acompanhar.'
                }
              />
              <CartaoResumo
                rotulo="Ainda cabe"
                valor={totalPlanejado - gastoNoPlanejado}
                cor="saldo"
                corDaFaixa={
                  totalPlanejado - gastoNoPlanejado < 0 ? 'var(--saida)' : 'var(--entrada)'
                }
                nota={
                  gastoForaDoPlanejado > 0
                    ? `Fora do planejamento: ${formatarMoeda(gastoForaDoPlanejado)}.`
                    : 'Todo o gasto do mês está dentro do planejamento.'
                }
              />
            </div>

            <section className="cartao">
              <div className="cartao-cabeca">
                <h2>Limites por categoria</h2>
                <span className="texto-miudo">valores em reais</span>
              </div>

              {linhasVisiveis.length === 0 ? (
                <div className="cartao-corpo">
                  <EstadoVazio
                    selo="◎"
                    titulo="Nenhum limite neste mês"
                    descricao="Escolha uma categoria abaixo e diga quanto pretende gastar nela. Quando o gasto chegar a 80% do limite, o painel avisa."
                  />
                </div>
              ) : (
                <div className="cartao-corpo-sem-topo" style={{ padding: 0 }}>
                  {linhasVisiveis.map((linha) => {
                    const situacao = situacaoDoLimite(linha);
                    const categoria = descreverCategoria(linha.categoria);
                    const largura = Math.min(100, linha.proporcao * 100);

                    return (
                      <div className="linha-planejamento" key={linha.categoria}>
                        <div>
                          <div className="linha-categoria-topo">
                            <span className="linha-categoria-nome">
                              <span aria-hidden="true">{categoria.emoji}</span>
                              <span>{linha.categoria}</span>
                              <span className={situacao.classeDoSelo}>{situacao.rotulo}</span>
                            </span>
                            <span className="linha-categoria-valores">
                              <Dinheiro valor={linha.gasto} cor="saida" />
                              {linha.limite > 0 ? (
                                <span className="texto-miudo">
                                  de {formatarMoeda(linha.limite)}
                                </span>
                              ) : null}
                            </span>
                          </div>

                          {linha.limite > 0 ? (
                            <>
                              <div className={`trilha ${situacao.classeDaTrilha}`}>
                                <div
                                  className="trilha-preenchida"
                                  style={{
                                    ...comVariaveis({ '--cor-barra': categoria.cor }),
                                    width: `${largura}%`,
                                  }}
                                />
                              </div>
                              <span className="texto-miudo">
                                {linha.restante >= 0
                                  ? `${formatarPorcentagem(linha.proporcao)} usado · ainda cabem ${formatarMoeda(linha.restante)}`
                                  : `${formatarPorcentagem(linha.proporcao)} usado · passou ${formatarMoeda(-linha.restante)}`}
                              </span>
                            </>
                          ) : (
                            <span className="texto-miudo">
                              {linha.gasto > 0
                                ? 'Gasto sem limite definido. Digite um valor para acompanhar.'
                                : 'Digite quanto pretende gastar nesta categoria.'}
                            </span>
                          )}
                        </div>

                        <label className="campo-limite">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={textoDoCampo(linha)}
                            aria-label={`Limite de ${linha.categoria}`}
                            placeholder="sem limite"
                            disabled={salvando === linha.categoria}
                            onChange={(evento) => {
                              const texto = evento.target.value;
                              definirRascunhos((atual) => ({
                                ...atual,
                                [linha.categoria]: texto,
                              }));
                            }}
                            onBlur={(evento) => {
                              if (rascunhos[linha.categoria] === undefined) return;
                              void aplicar(linha, evento.target.value);
                            }}
                            onKeyDown={(evento) => {
                              if (evento.key === 'Enter') {
                                evento.preventDefault();
                                evento.currentTarget.blur();
                              }
                            }}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="cartao-corpo">
                {disponiveis.length > 0 ? (
                  <div className="barra-filtros">
                    <select
                      className="selecao"
                      value={novaCategoria}
                      onChange={(evento) => adicionar(evento.target.value)}
                      aria-label="Adicionar categoria ao planejamento"
                    >
                      <option value="">+ Adicionar categoria ao planejamento</option>
                      {disponiveis.map((categoria) => (
                        <option key={categoria.id} value={categoria.nome}>
                          {categoria.emoji} {categoria.nome}
                        </option>
                      ))}
                    </select>
                    <span className="texto-miudo">
                      Limite vazio ou zero remove a categoria do planejamento.
                    </span>
                  </div>
                ) : (
                  <p className="texto-miudo" style={{ margin: 0 }}>
                    Todas as categorias de saída já estão no planejamento deste mês.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
