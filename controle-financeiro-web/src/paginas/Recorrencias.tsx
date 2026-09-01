import { useMemo, useState } from 'react';

import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { Dinheiro } from '../componentes/Dinheiro';
import { CartaoResumo } from '../componentes/CartaoResumo';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { FormularioDeRecorrencia } from '../componentes/FormularioDeRecorrencia';
import { ListaDePrevistos } from '../componentes/ListaDePrevistos';
import { Modal } from '../componentes/Modal';
import { useDados } from '../contextos/ContextoDados';
import { useMes } from '../contextos/ContextoMes';
import {
  descreverPeriodo,
  parcelasRestantes,
  pesoMensal,
  proximaOcorrencia,
  recorrenciaEncerrada,
} from '../dominio/recorrencias';
import type { Recorrencia, TipoTransacao } from '../tipos';
import { formatarData } from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';

/// Recorrências: o que se repete todo mês, cadastrado uma única vez.
///
/// Duas formas de repetição resolvem quase tudo: sem fim (salário, aluguel) e um
/// número de vezes (o boleto em 3x). Cada cadastro escolhe se o lançamento
/// acontece automaticamente na data ou se espera confirmação.

export function Recorrencias() {
  const { rotulo } = useMes();
  const {
    recorrencias,
    ocorrenciasDoMesSelecionado,
    carregando,
    erro,
    descreverCategoria,
    alternarRecorrencia,
    removerRecorrencia,
  } = useDados();

  const [formularioAberto, definirFormularioAberto] = useState(false);
  const [emEdicao, definirEmEdicao] = useState<Recorrencia | null>(null);
  const [tipoInicial, definirTipoInicial] = useState<TipoTransacao>('saida');
  const [paraExcluir, definirParaExcluir] = useState<Recorrencia | null>(null);
  const [excluindo, definirExcluindo] = useState(false);
  const [erroAoAgir, definirErroAoAgir] = useState<string | null>(null);

  const peso = useMemo(() => pesoMensal(recorrencias), [recorrencias]);

  function abrirNova(tipo: TipoTransacao) {
    definirEmEdicao(null);
    definirTipoInicial(tipo);
    definirFormularioAberto(true);
  }

  function abrirEdicao(recorrencia: Recorrencia) {
    definirEmEdicao(recorrencia);
    definirTipoInicial(recorrencia.tipo);
    definirFormularioAberto(true);
  }

  async function alternar(recorrencia: Recorrencia) {
    definirErroAoAgir(null);
    try {
      await alternarRecorrencia(recorrencia.id, !recorrencia.ativa);
    } catch (falha) {
      definirErroAoAgir(
        falha instanceof Error ? falha.message : 'Não deu para mudar. Tente de novo.',
      );
    }
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return;
    definirExcluindo(true);
    definirErroAoAgir(null);
    try {
      await removerRecorrencia(paraExcluir.id);
      definirParaExcluir(null);
    } catch (falha) {
      definirErroAoAgir(
        falha instanceof Error ? falha.message : 'Não deu para excluir. Tente de novo.',
      );
    } finally {
      definirExcluindo(false);
    }
  }

  function lista(tipo: TipoTransacao) {
    const doTipo = recorrencias.filter((recorrencia) => recorrencia.tipo === tipo);

    if (doTipo.length === 0) {
      return (
        <div className="cartao-corpo">
          <EstadoVazio
            selo={tipo === 'entrada' ? '↗' : '↘'}
            titulo={tipo === 'entrada' ? 'Nenhuma receita fixa' : 'Nenhuma conta fixa'}
            descricao={
              tipo === 'entrada'
                ? 'Cadastre o salário uma vez e ele passa a aparecer em todos os meses seguintes.'
                : 'Aluguel, assinatura, boleto parcelado: cadastre uma vez e os próximos meses já contam com ele.'
            }
            acao={
              <button
                type="button"
                className="botao botao-principal"
                onClick={() => abrirNova(tipo)}
              >
                {tipo === 'entrada' ? 'Cadastrar receita fixa' : 'Cadastrar conta fixa'}
              </button>
            }
          />
        </div>
      );
    }

    return (
      <ul className="lista-lancamentos">
        {doTipo.map((recorrencia) => {
          const categoria = descreverCategoria(recorrencia.categoria);
          const ehEntrada = recorrencia.tipo === 'entrada';
          const encerrada = recorrenciaEncerrada(recorrencia);
          const proxima = proximaOcorrencia(recorrencia);
          const restantes = parcelasRestantes(recorrencia);

          return (
            <li
              className={
                recorrencia.ativa && !encerrada
                  ? 'lancamento lancamento-com-acao'
                  : 'lancamento lancamento-com-acao lancamento-apagado'
              }
              key={recorrencia.id}
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
                  {recorrencia.descricao}
                  {!recorrencia.ativa ? (
                    <span className="selo-situacao selo-sem-limite" style={{ marginLeft: 8 }}>
                      pausada
                    </span>
                  ) : encerrada ? (
                    <span className="selo-situacao selo-sem-limite" style={{ marginLeft: 8 }}>
                      encerrada
                    </span>
                  ) : null}
                  <span className="selo-situacao selo-sem-limite" style={{ marginLeft: 8 }}>
                    {recorrencia.modoLancamento === 'automatico'
                      ? 'automática'
                      : 'confirmação manual'}
                  </span>
                </div>
                <div className="lancamento-meta">
                  <span
                    className="marcador-categoria"
                    style={comVariaveis({ '--cor-marcador': categoria.cor })}
                  />
                  <span>{recorrencia.categoria}</span>
                  <span>· {descreverPeriodo(recorrencia)}</span>
                  {proxima ? (
                    <span>· próxima em {formatarData(proxima)}</span>
                  ) : null}
                  {restantes !== null && restantes > 0 && recorrencia.ativa ? (
                    <span>
                      · {restantes === 1 ? 'falta 1 parcela' : `faltam ${restantes} parcelas`}
                    </span>
                  ) : null}
                </div>
              </div>

              <Dinheiro
                valor={ehEntrada ? recorrencia.valor : -recorrencia.valor}
                cor={ehEntrada ? 'entrada' : 'saida'}
                comSinal
                className="lancamento-valor"
              />

              {/* `.lancamento-acao`, não `.lancamento-acoes`: aqui as ações não
                  podem desaparecer no celular — pausar e excluir são o motivo de
                  a lista existir. */}
              <div className="lancamento-acao">
                <button
                  type="button"
                  className="acao-miuda"
                  onClick={() => void alternar(recorrencia)}
                  aria-label={
                    recorrencia.ativa
                      ? `Pausar ${recorrencia.descricao}`
                      : `Retomar ${recorrencia.descricao}`
                  }
                  title={
                    recorrencia.ativa
                      ? 'Pausar: para de aparecer nos previstos, sem perder o cadastro'
                      : 'Retomar: volta a aparecer nos previstos'
                  }
                >
                  {recorrencia.ativa ? '⏸' : '▶'}
                </button>
                <button
                  type="button"
                  className="acao-miuda"
                  onClick={() => abrirEdicao(recorrencia)}
                  aria-label={`Editar ${recorrencia.descricao}`}
                  title="Editar"
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="acao-miuda acao-miuda-perigo"
                  onClick={() => definirParaExcluir(recorrencia)}
                  aria-label={`Excluir ${recorrencia.descricao}`}
                  title="Excluir"
                >
                  🗑
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <CabecalhoDaPagina
        titulo="Recorrências"
        descricao="O que se repete todo mês, cadastrado uma vez"
        comSeletorDeMes={false}
        acoes={
          <button
            type="button"
            className="botao botao-principal"
            onClick={() => abrirNova('saida')}
          >
            + Nova recorrência
          </button>
        }
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}
        {erroAoAgir ? <FaixaDeErro mensagem={erroAoAgir} /> : null}

        {carregando ? (
          <Carregando mensagem="Carregando as recorrências…" />
        ) : (
          <>
            <div className="grade-resumo">
              <CartaoResumo
                rotulo="Entra todo mês"
                valor={peso.entradas}
                cor="entrada"
                corDaFaixa="var(--entrada)"
                nota={
                  peso.vigentes === 1
                    ? '1 recorrência vigente'
                    : `${peso.vigentes} recorrências vigentes`
                }
              />
              <CartaoResumo
                rotulo="Sai todo mês"
                valor={peso.saidas}
                cor="saida"
                corDaFaixa="var(--saida)"
                nota="Pausadas e séries encerradas ficam fora da conta"
              />
              <CartaoResumo
                rotulo="Sobra prevista"
                valor={peso.saldo}
                cor="saldo"
                corDaFaixa={peso.saldo < 0 ? 'var(--saida)' : 'var(--destaque)'}
                nota="O que resta por mês, contando só o que é fixo"
              />
            </div>

            <div className="cartao">
              <div className="cartao-corpo">
                <p className="texto-apoio" style={{ margin: 0 }}>
                  Recorrências automáticas viram lançamento na data programada. Se o app estiver
                  fechado, isso acontece na próxima abertura, sem duplicar. Para valores que
                  precisam de conferência, escolha confirmação manual. Alterações valem para os
                  próximos meses; lançamentos já criados permanecem como estavam.
                </p>
              </div>
            </div>

            <div className="grade-dupla">
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Receitas recorrentes</h2>
                  <button
                    type="button"
                    className="botao-texto"
                    onClick={() => abrirNova('entrada')}
                  >
                    + Nova
                  </button>
                </div>
                <div className="cartao-corpo-sem-topo">{lista('entrada')}</div>
              </section>

              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Contas recorrentes</h2>
                  <button
                    type="button"
                    className="botao-texto"
                    onClick={() => abrirNova('saida')}
                  >
                    + Nova
                  </button>
                </div>
                <div className="cartao-corpo-sem-topo">{lista('saida')}</div>
              </section>
            </div>

            {ocorrenciasDoMesSelecionado.length > 0 ? (
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Como fica {rotulo.toLowerCase()}</h2>
                  <span className="texto-miudo">
                    {ocorrenciasDoMesSelecionado.length}{' '}
                    {ocorrenciasDoMesSelecionado.length === 1 ? 'ocorrência' : 'ocorrências'}
                  </span>
                </div>
                <div className="cartao-corpo-sem-topo">
                  <ListaDePrevistos ocorrencias={ocorrenciasDoMesSelecionado} />
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      {formularioAberto ? (
        <FormularioDeRecorrencia
          key={emEdicao?.id ?? 'nova'}
          recorrencia={emEdicao}
          tipoInicial={tipoInicial}
          aoFechar={() => {
            definirFormularioAberto(false);
            definirEmEdicao(null);
          }}
        />
      ) : null}

      {paraExcluir ? (
        <Modal
          titulo="Excluir recorrência"
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
                {excluindo ? 'Excluindo…' : 'Excluir recorrência'}
              </button>
            </>
          }
        >
          <div className="formulario">
            <p>
              Excluir <strong>{paraExcluir.descricao}</strong>?
            </p>
            <p className="texto-miudo">
              Os lançamentos que você já confirmou continuam no lugar — eles são dinheiro que
              se mexeu de verdade. O que desaparece são as previsões dos próximos meses.
            </p>
            <div className="aviso">
              Se a ideia é só dar uma pausa, use o botão <strong>⏸</strong> na lista: o
              cadastro fica guardado e volta quando você quiser.
            </div>
            {erroAoAgir ? <div className="aviso aviso-erro">{erroAoAgir}</div> : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
