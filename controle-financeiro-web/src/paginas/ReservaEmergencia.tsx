import { useEffect, useMemo, useState } from 'react';

import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { CartaoResumo } from '../componentes/CartaoResumo';
import { Dinheiro } from '../componentes/Dinheiro';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { Modal } from '../componentes/Modal';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { useDados } from '../contextos/ContextoDados';
import { formatarMoeda, formatarPorcentagem, interpretarValor } from '../utilitarios/formatadores';
import {
  type DadosDaReserva,
  type MovimentacaoReserva,
  adicionarMovimentacao,
  definirMeta,
  lerReserva,
  ultimasMovimentacoes,
} from '../servicos/servicoReserva';
import { formatarData } from '../utilitarios/formatadores';

/// Reserva de Emergência: colchão financeiro para imprevistos.
///
/// O ideal é ter de 3 a 6 meses de despesas guardados. Esta página ajuda
/// o usuário a acompanhar e gerenciar essa reserva de forma simples.

export function ReservaEmergencia() {
  const { usuario } = useAutenticacao();
  const { resumo } = useDados();
  const uid = usuario?.uid ?? null;

  const [reserva, definirReserva] = useState<DadosDaReserva | null>(null);
  const [movimentacoes, definirMovimentacoes] = useState<MovimentacaoReserva[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);

  const [modalAberto, definirModalAberto] = useState<'entrada' | 'saida' | null>(null);
  const [valorRascunho, definirValorRascunho] = useState('');
  const [descricaoRascunho, definirDescricaoRascunho] = useState('');
  const [salvando, definirSalvando] = useState(false);
  const [erroLocal, definirErroLocal] = useState<string | null>(null);

  const [editandoMeta, definirEditandoMeta] = useState(false);
  const [metaRascunho, definirMetaRascunho] = useState('');
  const [salvandoMeta, definirSalvandoMeta] = useState(false);

  useEffect(() => {
    if (!uid) return;

    let vivo = true;
    definirCarregando(true);
    definirErro(null);

    Promise.all([lerReserva(uid), ultimasMovimentacoes(uid)])
      .then(([reservaDados, movDados]) => {
        if (!vivo) return;
        definirReserva(reservaDados);
        definirMovimentacoes(movDados);
        definirCarregando(false);
      })
      .catch(() => {
        if (!vivo) return;
        definirErro('Não deu para carregar a reserva de emergência.');
        definirCarregando(false);
      });

    return () => { vivo = false; };
  }, [uid]);

  // Meta automática: 6 meses de despesas (editável)
  const metaAutomatica = resumo.saidas * 6;
  const metaFinal = reserva?.meta ?? metaAutomatica;
  const valorAtual = reserva?.valorAtual ?? 0;
  const progresso = metaFinal > 0 ? Math.min(valorAtual / metaFinal, 1) : 0;
  const mesesCobertos = resumo.saidas > 0 ? valorAtual / resumo.saidas : 0;
  const falta = Math.max(0, metaFinal - valorAtual);

  async function salvarMeta() {
    if (!uid) return;
    const valor = interpretarValor(metaRascunho);
    if (valor === null || valor < 0) {
      definirErroLocal('Digite um valor válido.');
      return;
    }
    definirSalvandoMeta(true);
    try {
      await definirMeta(uid, valor);
      const atualizada = await lerReserva(uid);
      definirReserva(atualizada);
      definirEditandoMeta(false);
    } catch {
      definirErroLocal('Não deu para salvar.');
    } finally {
      definirSalvandoMeta(false);
    }
  }

  async function confirmarMovimentacao() {
    if (!uid || !modalAberto) return;
    const valor = interpretarValor(valorRascunho);
    if (valor === null || valor <= 0) {
      definirErroLocal('Digite um valor válido maior que zero.');
      return;
    }
    if (!descricaoRascunho.trim()) {
      definirErroLocal('Digite uma descrição.');
      return;
    }
    if (modalAberto === 'saida' && valor > valorAtual) {
      definirErroLocal('Valor maior que o disponível.');
      return;
    }

    definirSalvando(true);
    try {
      await adicionarMovimentacao(uid, {
        tipo: modalAberto,
        valor,
        descricao: descricaoRascunho.trim(),
      });
      const [r, m] = await Promise.all([lerReserva(uid), ultimasMovimentacoes(uid)]);
      definirReserva(r);
      definirMovimentacoes(m);
      definirModalAberto(null);
      definirValorRascunho('');
      definirDescricaoRascunho('');
    } catch {
      definirErroLocal('Não deu para registrar.');
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <>
      <CabecalhoDaPagina
        titulo="Reserva de Emergência"
        descricao="Seu colchão financeiro para imprevistos"
        acoes={
          <div className="botoes">
            <button type="button" className="botao botao-entrada" onClick={() => { definirModalAberto('entrada'); definirErroLocal(null); }}>
              + Depositar
            </button>
            <button type="button" className="botao botao-saida" onClick={() => { definirModalAberto('saida'); definirErroLocal(null); }} disabled={valorAtual <= 0}>
              - Retirar
            </button>
          </div>
        }
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {carregando ? (
          <Carregando mensagem="Carregando sua reserva…" />
        ) : (
          <>
            {/* Tutorial */}
            <section className="cartao">
              <div className="cartao-corpo">
                <p className="texto-apoio" style={{ margin: 0 }}>
                  💡 <strong>O que é a reserva de emergência?</strong> É um dinheiro guardado para
                  imprevistos como perda de emprego, problemas de saúde ou reparos urgentes. O ideal
                  é ter de <strong>3 a 6 meses</strong> das suas despesas guardados. Comece com o
                  que puder — todo valor ajuda!
                </p>
              </div>
            </section>

            {/* Status Atual */}
            <section className="cartao">
              <div className="cartao-cabeca">
                <h2>Como está sua reserva</h2>
                <button
                  type="button"
                  className="botao-texto"
                  onClick={() => {
                    definirEditandoMeta(true);
                    definirMetaRascunho(String(metaFinal).replace('.', ','));
                    definirErroLocal(null);
                  }}
                >
                  Alterar meta
                </button>
              </div>
              <div className="cartao-corpo">
                {/* Barra de progresso */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{formatarMoeda(valorAtual)}</span>
                    <span className="texto-miudo" style={{ color: 'var(--tinta-fraca)' }}>
                      Meta: {formatarMoeda(metaFinal)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 32,
                      borderRadius: 16,
                      background: 'var(--cinza-claro)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${progresso * 100}%`,
                        height: '100%',
                        background: progresso >= 1 ? 'var(--entrada)' : progresso >= 0.5 ? 'var(--destaque)' : 'var(--atencao)',
                        transition: 'width 0.5s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {progresso > 0.15 && (
                        <span style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem' }}>
                          {(progresso * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span className="texto-miudo" style={{ color: 'var(--tinta-fraca)' }}>0</span>
                    <span className="texto-miudo" style={{ color: 'var(--tinta-fraca)' }}>{formatarMoeda(metaFinal)}</span>
                  </div>
                </div>

                {/* Cards informativos */}
                <div className="grade-resumo" style={{ marginTop: 0 }}>
                  <CartaoResumo
                    rotulo="Cobertura"
                    valor={mesesCobertos}
                    cor="saldo"
                    corDaFaixa="var(--destaque)"
                    nota={mesesCobertos >= 6 ? '✅ Meta atingida!' : mesesCobertos >= 3 ? '📊 Bom progresso' : '⚠️ Continue guardando'}
                  />
                  <CartaoResumo
                    rotulo="Faltante"
                    valor={falta}
                    cor="saida"
                    corDaFaixa="var(--saida)"
                    nota={falta === 0 ? 'Parabéns!' : `Para atingir a meta`}
                  />
                  <CartaoResumo
                    rotulo="Sua meta"
                    valor={metaFinal}
                    cor="saldo"
                    corDaFaixa="var(--tinta-fraca)"
                    nota={`${formatarMoeda(resumo.saidas)} × 6 meses`}
                  />
                </div>

                {/* Dicas */}
                {falta > 0 && (
                  <div style={{
                    marginTop: 16,
                    padding: 12,
                    background: 'var(--fundo)',
                    borderRadius: 8,
                  }}>
                    <p className="texto-miudo" style={{ margin: 0, color: 'var(--tinta-fraca)' }}>
                      💡 <strong>Dica:</strong> Guarde pelo menos {formatarMoeda(falta / 12)} por mês
                      para atingir sua reserva em 12 meses. Ou {formatarMoeda(falta / 6)} por mês em 6 meses.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Editar Meta */}
            {editandoMeta && (
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Alterar meta</h2>
                </div>
                <div className="cartao-corpo">
                  <p className="texto-miudo" style={{ marginTop: 0 }}>
                    O valor ideal é 6 meses de despesas ({formatarMoeda(metaAutomatica)}), mas você
                    pode definir qualquer meta.
                  </p>
                  <div className="campo-grupo">
                    <label className="campo-rotulo" htmlFor="meta-reserva">
                      Nova meta (R$)
                    </label>
                    <input
                      id="meta-reserva"
                      className="campo"
                      type="text"
                      inputMode="decimal"
                      value={metaRascunho}
                      onChange={(e) => definirMetaRascunho(e.target.value)}
                      placeholder={String(metaFinal).replace('.', ',')}
                    />
                  </div>
                  {erroLocal && <div className="aviso aviso-erro">{erroLocal}</div>}
                  <div className="botoes" style={{ marginTop: 12 }}>
                    <button type="button" className="botao botao-contorno" onClick={() => definirEditandoMeta(false)} disabled={salvandoMeta}>
                      Cancelar
                    </button>
                    <button type="button" className="botao botao-principal" onClick={() => void salvarMeta()} disabled={salvandoMeta}>
                      {salvandoMeta ? 'Salvando…' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Histórico de Movimentações */}
            <section className="cartao">
              <div className="cartao-cabeca">
                <h2>Histórico</h2>
                <span className="texto-miudo">{movimentacoes.length} movimentações</span>
              </div>
              <div className="cartao-corpo">
                {movimentacoes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <p style={{ fontSize: '2rem', margin: '0 0 8px' }}>🏦</p>
                    <p style={{ margin: 0, color: 'var(--tinta-fraca)' }}>
                      Sua reserva está vazia.<br />
                      Clique em <strong>"Depositar"</strong> para começar!
                    </p>
                  </div>
                ) : (
                  <ul className="lista-lancamentos">
                    {movimentacoes.map((mov) => (
                      <li className="lancamento" key={mov.id}>
                        <span
                          className="lancamento-selo"
                          style={{
                            background: mov.tipo === 'entrada' ? 'var(--entrada-clara)' : 'var(--saida-clara)',
                          }}
                        >
                          {mov.tipo === 'entrada' ? '↓' : '↑'}
                        </span>
                        <div className="lancamento-textos">
                          <div className="lancamento-descricao">{mov.descricao}</div>
                          <div className="lancamento-meta">
                            <span>{formatarData(mov.data)}</span>
                          </div>
                        </div>
                        <Dinheiro
                          valor={mov.tipo === 'entrada' ? mov.valor : -mov.valor}
                          cor={mov.tipo === 'entrada' ? 'entrada' : 'saida'}
                          comSinal
                          className="lancamento-valor"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Modal de Entrada/Saída */}
      {modalAberto && (
        <Modal
          titulo={modalAberto === 'entrada' ? 'Depositar na reserva' : 'Retirar da reserva'}
          aoFechar={() => { if (!salvando) definirModalAberto(null); }}
          rodape={
            <>
              <button type="button" className="botao botao-contorno" onClick={() => definirModalAberto(null)} disabled={salvando}>
                Cancelar
              </button>
              <button
                type="button"
                className={modalAberto === 'entrada' ? 'botao botao-entrada' : 'botao botao-saida'}
                onClick={() => void confirmarMovimentacao()}
                disabled={salvando}
              >
                {salvando ? 'Salvando…' : modalAberto === 'entrada' ? 'Depositar' : 'Retirar'}
              </button>
            </>
          }
        >
          <div className="formulario">
            <div className="campo-grupo">
              <label className="campo-rotulo" htmlFor="valor-mov">Valor (R$)</label>
              <input
                id="valor-mov"
                className="campo"
                type="text"
                inputMode="decimal"
                value={valorRascunho}
                onChange={(e) => definirValorRascunho(e.target.value)}
                placeholder="0,00"
                autoFocus
              />
            </div>
            <div className="campo-grupo">
              <label className="campo-rotulo" htmlFor="desc-mov">Descrição</label>
              <input
                id="desc-mov"
                className="campo"
                type="text"
                maxLength={100}
                value={descricaoRascunho}
                onChange={(e) => definirDescricaoRascunho(e.target.value)}
                placeholder={modalAberto === 'entrada' ? 'Ex: Depósito mensal' : 'Ex: Conserto do carro'}
              />
            </div>
            {erroLocal && <div className="aviso aviso-erro">{erroLocal}</div>}
          </div>
        </Modal>
      )}
    </>
  );
}
