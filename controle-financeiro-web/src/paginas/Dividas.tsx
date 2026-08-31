import { useEffect, useMemo, useState } from 'react';

import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { CartaoResumo } from '../componentes/CartaoResumo';
import { Dinheiro } from '../componentes/Dinheiro';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { Modal } from '../componentes/Modal';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import type { Divida } from '../tipos';
import { formatarData, formatarMoeda, interpretarValor } from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';
import {
  observarDividas,
  criarDivida,
  atualizarDivida,
  excluirDivida,
  registrarPagamento,
} from '../servicos/servicoDividas';

/// Dívidas que o usuário tem mas não está pagando regularmente.
///
/// Diferente de despesa recorrente: não gera lançamento mensal nem entra no
/// planejamento. É apenas um registro de quanto se deve e quanto já se pagou.

export function Dividas() {
  const { usuario } = useAutenticacao();
  const uid = usuario?.uid ?? null;

  const [dividas, definirDividas] = useState<Divida[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);

  // Modal de pagamento
  const [dividaParaPagar, definirDividaParaPagar] = useState<Divida | null>(null);
  const [valorPagamento, definirValorPagamento] = useState('');
  const [salvandoPagamento, definirSalvandoPagamento] = useState(false);
  const [erroPagamento, definirErroPagamento] = useState<string | null>(null);

  // Modal de confirmação de exclusão
  const [dividaParaExcluir, definirDividaParaExcluir] = useState<Divida | null>(null);
  const [excluindo, definirExcluindo] = useState(false);

  useEffect(() => {
    if (!uid) return;

    let vivo = true;
    definirCarregando(true);
    definirErro(null);

    const encerrar = observarDividas(
      uid,
      (lista) => {
        if (!vivo) return;
        definirDividas(lista);
        definirCarregando(false);
      },
      () => {
        if (!vivo) return;
        definirErro('Não deu para carregar as dívidas.');
        definirCarregando(false);
      },
    );

    return () => {
      vivo = false;
      encerrar();
    };
  }, [uid]);

  // --- Derivados ---

  const totalDevido = useMemo(
    () => dividas.reduce((soma, d) => soma + d.valor, 0),
    [dividas],
  );

  const totalPago = useMemo(
    () => dividas.reduce((soma, d) => soma + d.valorPago, 0),
    [dividas],
  );

  const quitadas = useMemo(
    () => dividas.filter((d) => d.valorPago >= d.valor && d.valor > 0),
    [dividas],
  );

  const abertas = useMemo(
    () => dividas.filter((d) => d.valorPago < d.valor),
    [dividas],
  );

  const hoje = new Date();

  // --- Ações ---

  async function confirmarPagamento() {
    if (!uid || !dividaParaPagar) return;

    const valor = interpretarValor(valorPagamento);
    if (valor === null || valor <= 0) {
      definirErroPagamento('Digite um valor válido maior que zero.');
      return;
    }

    const restante = dividaParaPagar.valor - dividaParaPagar.valorPago;
    if (valor > restante) {
      definirErroPagamento(`O valor não pode ser maior que o restante (${formatarMoeda(restante)}).`);
      return;
    }

    definirSalvandoPagamento(true);
    try {
      await registrarPagamento(uid, dividaParaPagar.id, valor);
      definirDividaParaPagar(null);
      definirValorPagamento('');
    } catch {
      definirErroPagamento('Não deu para registrar o pagamento.');
    } finally {
      definirSalvandoPagamento(false);
    }
  }

  async function confirmarExclusao() {
    if (!uid || !dividaParaExcluir) return;

    definirExcluindo(true);
    try {
      await excluirDivida(uid, dividaParaExcluir.id);
      definirDividaParaExcluir(null);
    } catch {
      definirErro('Não deu para excluir a dívida.');
    } finally {
      definirExcluindo(false);
    }
  }

  return (
    <>
      <CabecalhoDaPagina
        titulo="Dívidas"
        descricao="Acompanhe o que você deve e quanto já pagou"
        comSeletorDeMes={false}
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {carregando ? (
          <Carregando mensagem="Carregando suas dívidas…" />
        ) : (
          <>
            <div className="grade-resumo">
              <CartaoResumo
                rotulo="Total devido"
                valor={totalDevido - totalPago}
                cor="saida"
                corDaFaixa="var(--saida)"
                nota={
                  abertas.length === 0
                    ? 'Nenhuma dívida aberta.'
                    : `${abertas.length} dívida(s) aberta(s).`
                }
              />
              <CartaoResumo
                rotulo="Total pago"
                valor={totalPago}
                cor="entrada"
                corDaFaixa="var(--entrada)"
                nota={
                  totalDevido > 0
                    ? `${Math.min(100, Math.round((totalPago / totalDevido) * 100))}% do total.`
                    : 'Nenhum pagamento registrado.'
                }
              />
              <CartaoResumo
                rotulo="Quitadas"
                valor={quitadas.length}
                cor="saldo"
                corDaFaixa="var(--destaque)"
                nota={
                  dividas.length === 0
                    ? 'Registre sua primeira dívida.'
                    : `${quitadas.length} de ${dividas.length} quitada(s).`
                }
              />
            </div>

            {dividas.length === 0 ? (
              <div className="cartao">
                <div className="cartao-corpo">
                  <EstadoVazio
                    selo="📋"
                    titulo="Nenhuma dívida registrada"
                    descricao="Registre suas dívidas para acompanhar quanto já pagou e quanto ainda falta. As dívidas não entram no planejamento mensal — são apenas um registro."
                    acao={
                      <button type="button" className="botao botao-principal" onClick={() => {}}>
                        + Nova dívida
                      </button>
                    }
                  />
                </div>
              </div>
            ) : (
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Dívidas</h2>
                  <span className="texto-miudo">
                    {dividas.length} {dividas.length === 1 ? 'dívida' : 'dívidas'}
                  </span>
                </div>

                <div className="cartao-corpo-sem-topo" style={{ padding: 0 }}>
                  {dividas.map((divida) => {
                    const proporcao = divida.valor > 0
                      ? Math.min(1, divida.valorPago / divida.valor)
                      : 0;
                    const largura = Math.min(100, proporcao * 100);
                    const quitada = divida.valorPago >= divida.valor && divida.valor > 0;
                    const atrasada =
                      divida.dataVencimento !== null &&
                      divida.dataVencimento < hoje &&
                      !quitada;

                    let classeSelo = 'selo-situacao';
                    let rotuloSelo = quitada ? 'Quitada' : 'Em dia';
                    if (atrasada) {
                      classeSelo = 'selo-situacao selo-estourado';
                      rotuloSelo = 'Atrasada';
                    } else if (!quitada) {
                      classeSelo = 'selo-situacao selo-atencao';
                      rotuloSelo = 'Em aberto';
                    }

                    let classeTrilha = '';
                    if (atrasada) classeTrilha = 'trilha-estourada';

                    return (
                      <div className="linha-categoria" key={divida.id}>
                        <div style={{ flex: 1 }}>
                          <div className="linha-categoria-topo">
                            <span className="linha-categoria-nome">
                              <span>{divida.descricao}</span>
                              <span className={classeSelo}>{rotuloSelo}</span>
                            </span>
                            <span className="linha-categoria-valores">
                              <Dinheiro valor={divida.valorPago} cor="entrada" />
                              <span className="texto-miudo">
                                de {formatarMoeda(divida.valor)}
                              </span>
                            </span>
                          </div>

                          <div className={`trilha ${classeTrilha}`}>
                            <div
                              className="trilha-preenchida"
                              style={comVariaveis({
                                '--cor-barra': quitada
                                  ? 'var(--entrada)'
                                  : atrasada
                                    ? 'var(--saida)'
                                    : 'var(--destaque)',
                                width: `${largura}%`,
                              })}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <span className="texto-miudo">
                              {divida.credor}
                              {divida.dataVencimento
                                ? ` · Vence em ${formatarData(divida.dataVencimento)}`
                                : ''}
                            </span>

                            <div style={{ display: 'flex', gap: 4 }}>
                              {!quitada && (
                                <button
                                  type="button"
                                  className="botao botao-suave"
                                  onClick={() => {
                                    definirDividaParaPagar(divida);
                                    definirValorPagamento('');
                                    definirErroPagamento(null);
                                  }}
                                >
                                  Registrar pagamento
                                </button>
                              )}
                              {!quitada && (
                                <button
                                  type="button"
                                  className="botao-texto"
                                  onClick={() => { /* editar — será implementado com FormularioDeDivida */ }}
                                >
                                  Editar
                                </button>
                              )}
                              <button
                                type="button"
                                className="botao-texto"
                                style={{ color: 'var(--saida)' }}
                                onClick={() => definirDividaParaExcluir(divida)}
                              >
                                Excluir
                              </button>
                            </div>
                          </div>

                          {divida.observacao ? (
                            <p className="texto-miudo" style={{ margin: '4px 0 0', opacity: 0.7 }}>
                              {divida.observacao}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Modal de pagamento */}
      {dividaParaPagar && (
        <Modal
          titulo="Registrar pagamento"
          descricao={`${dividaParaPagar.descricao} — ${dividaParaPagar.credor}`}
          aoFechar={() => {
            if (!salvandoPagamento) definirDividaParaPagar(null);
          }}
          rodape={
            <>
              <button
                type="button"
                className="botao botao-contorno"
                onClick={() => definirDividaParaPagar(null)}
                disabled={salvandoPagamento}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="botao botao-principal"
                onClick={() => void confirmarPagamento()}
                disabled={salvandoPagamento}
              >
                {salvandoPagamento ? 'Salvando…' : 'Registrar'}
              </button>
            </>
          }
        >
          <div className="formulario">
            <p className="texto-miudo" style={{ marginTop: 0 }}>
              Restante:{' '}
              <strong>
                {formatarMoeda(dividaParaPagar.valor - dividaParaPagar.valorPago)}
              </strong>
            </p>
            <div className="campo-grupo">
              <label className="campo-rotulo" htmlFor="valor-pagamento">
                Valor pago (R$)
              </label>
              <input
                id="valor-pagamento"
                className="campo"
                type="text"
                inputMode="decimal"
                value={valorPagamento}
                onChange={(e) => definirValorPagamento(e.target.value)}
                placeholder="0,00"
                autoFocus
              />
            </div>
            {erroPagamento ? <div className="aviso aviso-erro">{erroPagamento}</div> : null}
          </div>
        </Modal>
      )}

      {/* Modal de confirmação de exclusão */}
      {dividaParaExcluir && (
        <Modal
          titulo="Excluir dívida"
          aoFechar={() => {
            if (!excluindo) definirDividaParaExcluir(null);
          }}
          rodape={
            <>
              <button
                type="button"
                className="botao botao-contorno"
                onClick={() => definirDividaParaExcluir(null)}
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
          <p style={{ margin: 0 }}>
            Tem certeza que deseja excluir a dívida{' '}
            <strong>{dividaParaExcluir.descricao}</strong> com{' '}
            <strong>{dividaParaExcluir.credor}</strong>?
          </p>
          <p className="texto-miudo" style={{ marginTop: 8 }}>
            Esta ação não pode ser desfeita.
          </p>
        </Modal>
      )}
    </>
  );
}
