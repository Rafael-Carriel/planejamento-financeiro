import { useEffect, useMemo, useState } from 'react';

import { Dinheiro } from './Dinheiro';
import { Modal } from './Modal';
import { Carregando, EstadoVazio } from './Estados';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { useDados } from '../contextos/ContextoDados';
import { useMes } from '../contextos/ContextoMes';
import { previsaoDosMeses } from '../dominio/recorrencias';
import { mensagemDeErro } from '../servicos/servicoAutenticacao';
import { lerTransacoes } from '../servicos/servicoTransacoes';
import type { Categoria, Transacao } from '../tipos';
import {
  chaveDoMes,
  inicioDoProximoMes,
  proximosMeses,
  rotuloDoMesCurto,
  ultimosMeses,
} from '../utilitarios/datas';
import { formatarMoeda } from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';

/// Detalhe de uma categoria: histórico e previsão.
///
/// Abre como modal quando o usuário clica numa categoria na tela de categorias.
/// Mostra os últimos meses de gastos (histórico) e os próximos meses previstos
/// (a partir de recorrências), filtrados pela categoria escolhida.

interface Propriedades {
  categoria: Categoria;
  aoFechar: () => void;
}

interface ResumoDoMes {
  chave: string;
  inicio: Date;
  valor: number;
}

export function DetalheCategoria({ categoria, aoFechar }: Propriedades) {
  const { usuario } = useAutenticacao();
  const { mes } = useMes();
  const { recorrencias } = useDados();
  const uid = usuario?.uid ?? null;

  const [transacoes, definirTransacoes] = useState<Transacao[]>([]);
  const [carregando, definirCarregando] = useState(true);

  const mesesHistorico = useMemo(() => ultimosMeses(mes, 6), [mes]);
  const mesesPrevisao = useMemo(() => proximosMeses(mes, 6), [mes]);

  // Busca as transações que cobrem o período de histórico e previsão.
  useEffect(() => {
    if (!uid) return;

    const primeiro = mesesHistorico[0];
    const ultimo = mesesPrevisao[mesesPrevisao.length - 1];
    const inicio = primeiro;
    const fim = inicioDoProximoMes(ultimo);

    let vivo = true;
    definirCarregando(true);

    lerTransacoes(uid, inicio, fim)
      .then((recebidas) => {
        if (!vivo) return;
        definirTransacoes(recebidas);
        definirCarregando(false);
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        console.error('Falha ao carregar detalhes da categoria.', falha);
        definirCarregando(false);
      });

    return () => {
      vivo = false;
    };
  }, [uid, mesesHistorico, mesesPrevisao]);

  // Filtra transações pelo nome da categoria.
  const transacoesDaCategoria = useMemo(
    () => transacoes.filter((t) => t.categoria === categoria.nome),
    [transacoes, categoria.nome],
  );

  // Monta o resumo do histórico: quanto gastou em cada mês passado.
  const historico = useMemo<ResumoDoMes[]>(() => {
    return mesesHistorico.map((mesInicio) => {
      const chave = chaveDoMes(mesInicio);
      const valor = transacoesDaCategoria
        .filter((t) => chaveDoMes(t.data) === chave)
        .reduce((soma, t) => soma + t.valor, 0);
      return { chave, inicio: mesInicio, valor };
    });
  }, [mesesHistorico, transacoesDaCategoria]);

  // Previsão: usa `previsaoDosMeses` e filtra pela categoria.
  const previsao = useMemo(() => {
    const projetado = previsaoDosMeses(recorrencias, mesesPrevisao, transacoes);

    return projetado.map((mesPrevisto) => {
      const saidasCategoria = mesPrevisto.ocorrencias
        .filter((o) => o.tipo === 'saida' && o.categoria === categoria.nome)
        .reduce((soma, o) => soma + o.valor, 0);

      const saidasLancadasCategoria = transacoesDaCategoria
        .filter(
          (t) =>
            chaveDoMes(t.data) === mesPrevisto.chave && t.tipo === 'saida',
        )
        .reduce((soma, t) => soma + t.valor, 0);

      return {
        chave: mesPrevisto.chave,
        inicio: mesPrevisto.inicio,
        valor: saidasLancadasCategoria + saidasCategoria,
      };
    });
  }, [recorrencias, mesesPrevisao, transacoes, transacoesDaCategoria, categoria.nome]);

  // Total gasto no histórico.
  const totalHistorico = useMemo(
    () => historico.reduce((soma, m) => soma + m.valor, 0),
    [historico],
  );

  // Média mensal (conta apenas meses com valor).
  const mesesComGasto = historico.filter((m) => m.valor > 0).length;
  const mediaMensal = mesesComGasto > 0 ? totalHistorico / mesesComGasto : 0;

  // Previsão total dos próximos meses.
  const totalPrevisao = useMemo(
    () => previsao.reduce((soma, m) => soma + m.valor, 0),
    [previsao],
  );

  // Maior valor entre histórico e previsão (para dimensionar as barras).
  const maiorValor = useMemo(() => {
    let maior = 0;
    for (const m of historico) {
      if (m.valor > maior) maior = m.valor;
    }
    for (const m of previsao) {
      if (m.valor > maior) maior = m.valor;
    }
    return maior;
  }, [historico, previsao]);

  function altura(valor: number): string {
    if (valor <= 0 || maiorValor <= 0) return '2px';
    return `${Math.max(2, (valor / maiorValor) * 100)}%`;
  }

  const temDados = totalHistorico > 0 || totalPrevisao > 0;

  return (
    <Modal
      titulo={`${categoria.emoji} ${categoria.nome}`}
      descricao={`Histórico e previsão de ${categoria.nome.toLowerCase()}`}
      aoFechar={aoFechar}
      largo
    >
      <div
        className="detalhe-categoria"
        style={comVariaveis({ '--cor-categoria': categoria.cor })}
      >
        {carregando ? (
          <Carregando mensagem="Carregando dados da categoria…" />
        ) : !temDados ? (
          <EstadoVazio
            selo={categoria.emoji}
            titulo={`Sem dados de ${categoria.nome.toLowerCase()}`}
            descricao="Não há lançamentos nem previsões para esta categoria nos meses selecionados."
          />
        ) : (
          <>
            {/* Resumo */}
            <div className="grade-resumo">
              <div className="cartao cartao-resumo">
                <span className="etiqueta">Total no histórico</span>
                <Dinheiro
                  valor={totalHistorico}
                  cor={categoria.tipo === 'entrada' ? 'entrada' : 'saida'}
                  className="cartao-resumo-valor"
                />
                <p className="cartao-resumo-nota">
                  Nos últimos {mesesHistorico.length} meses.
                </p>
              </div>

              <div className="cartao cartao-resumo">
                <span className="etiqueta">Média mensal</span>
                <Dinheiro
                  valor={mediaMensal}
                  cor={categoria.tipo === 'entrada' ? 'entrada' : 'saida'}
                  className="cartao-resumo-valor"
                />
                <p className="cartao-resumo-nota">
                  {mesesComGasto > 0
                    ? `Considerando ${mesesComGasto} ${mesesComGasto === 1 ? 'mês' : 'meses'} com movimento.`
                    : 'Nenhum mês com gasto.'}
                </p>
              </div>

              <div className="cartao cartao-resumo">
                <span className="etiqueta">Previsão próx. meses</span>
                <Dinheiro
                  valor={totalPrevisao}
                  cor={categoria.tipo === 'entrada' ? 'entrada' : 'saida'}
                  className="cartao-resumo-valor"
                />
                <p className="cartao-resumo-nota">
                  {previsao.length > 0
                    ? `Nos próximos ${previsao.length} meses.`
                    : 'Sem previsão disponível.'}
                </p>
              </div>
            </div>

            {/* Histórico */}
            <section className="cartao">
              <div className="cartao-cabeca">
                <h2>Histórico</h2>
                <span className="texto-miudo">
                  {mesesHistorico.length} meses · maior: {formatarMoeda(maiorValor)}
                </span>
              </div>
              <div className="cartao-corpo">
                <div className="grafico-meses">
                  {historico.map((mesDados) => (
                    <div
                      key={mesDados.chave}
                      className="coluna-mes"
                      title={`${rotuloDoMesCurto(mesDados.inicio)} · ${formatarMoeda(mesDados.valor)}`}
                    >
                      <div className="coluna-par">
                        <div
                          className="coluna-barra"
                          style={{
                            height: altura(mesDados.valor),
                            background: categoria.cor,
                          }}
                        />
                      </div>
                      <span className="coluna-rotulo">
                        {rotuloDoMesCurto(mesDados.inicio)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {historico.some((m) => m.valor > 0) ? (
                <div className="cartao-corpo-sem-topo" style={{ padding: 0 }}>
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map((mesDados) => (
                        <tr key={mesDados.chave}>
                          <td>{rotuloDoMesCurto(mesDados.inicio)}</td>
                          <td>
                            <Dinheiro
                              valor={mesDados.valor}
                              cor={categoria.tipo === 'entrada' ? 'entrada' : 'saida'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            {/* Previsão */}
            <section className="cartao">
              <div className="cartao-cabeca">
                <h2>Previsão</h2>
                <span className="texto-miudo">
                  Próximos {previsao.length} meses
                </span>
              </div>
              <div className="cartao-corpo">
                {previsao.every((m) => m.valor === 0) ? (
                  <p className="texto-miudo" style={{ margin: 0 }}>
                    Nenhuma previsão de gasto para esta categoria nos próximos meses.
                  </p>
                ) : (
                  <div className="grafico-meses">
                    {previsao.map((mesDados) => (
                      <div
                        key={mesDados.chave}
                        className="coluna-mes"
                        title={`${rotuloDoMesCurto(mesDados.inicio)} · ${formatarMoeda(mesDados.valor)}`}
                      >
                        <div className="coluna-par">
                          <div
                            className="coluna-barra"
                            style={{
                              height: altura(mesDados.valor),
                              background: categoria.cor,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                        <span className="coluna-rotulo">
                          {rotuloDoMesCurto(mesDados.inicio)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {previsao.some((m) => m.valor > 0) ? (
                <div className="cartao-corpo-sem-topo" style={{ padding: 0 }}>
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Valor previsto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previsao.map((mesDados) => (
                        <tr key={mesDados.chave}>
                          <td>{rotuloDoMesCurto(mesDados.inicio)}</td>
                          <td>
                            <Dinheiro
                              valor={mesDados.valor}
                              cor={categoria.tipo === 'entrada' ? 'entrada' : 'saida'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
