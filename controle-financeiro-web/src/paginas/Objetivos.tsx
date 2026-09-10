import { useEffect, useMemo, useState } from 'react';

import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { CartaoResumo } from '../componentes/CartaoResumo';
import { Dinheiro } from '../componentes/Dinheiro';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { Modal } from '../componentes/Modal';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import {
  type DadosDeMovimentacao,
  type DadosDoObjetivo,
  type MovimentacaoObjetivo,
  type Objetivo,
  atualizarObjetivo,
  criarObjetivo,
  lerMovimentacoesObjetivo,
  listarObjetivos,
  movimentarObjetivo,
  removerObjetivo,
} from '../servicos/servicoObjetivos';
import { formatarData, formatarMoeda, formatarPorcentagem, interpretarValor } from '../utilitarios/formatadores';

/// Objetivos financeiros: cofrinhos com nome e meta (viagem, carro, notebook…).
///
/// Cada objetivo tem uma barra de progresso, aportes e resgates, e um extrato.
/// A tela é um mosaico de cartões; tocar num cartão abre o detalhe.

const EMOJIS_SUGERIDOS = ['🎯', '✈️', '🏠', '🚗', '💻', '📱', '📚', '🎓', '💍', '🏖️', '🎁', '🚨'];

type EstadoModal =
  | { tipo: 'criar' }
  | { tipo: 'editar'; objetivo: Objetivo }
  | { tipo: 'detalhe'; objetivo: Objetivo }
  | { tipo: 'movimentar'; objetivo: Objetivo; direcao: 'entrada' | 'saida' }
  | { tipo: 'excluir'; objetivo: Objetivo }
  | null;

function proporcao(objetivo: Objetivo): number {
  if (objetivo.valorAlvo <= 0) return 0;
  return Math.min(objetivo.valorGuardado / objetivo.valorAlvo, 1);
}

function corDoProgresso(fracao: number): string {
  if (fracao >= 1) return 'var(--entrada)';
  if (fracao >= 0.5) return 'var(--destaque)';
  return 'var(--atencao)';
}

export function Objetivos() {
  const { usuario } = useAutenticacao();
  const uid = usuario?.uid ?? null;

  const [objetivos, definirObjetivos] = useState<Objetivo[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [modal, definirModal] = useState<EstadoModal>(null);

  useEffect(() => {
    if (!uid) return;

    let vivo = true;
    definirCarregando(true);
    definirErro(null);

    listarObjetivos(uid)
      .then((lista) => {
        if (!vivo) return;
        definirObjetivos(lista);
        definirCarregando(false);
      })
      .catch(() => {
        if (!vivo) return;
        definirErro('Não deu para carregar seus objetivos.');
        definirCarregando(false);
      });

    return () => {
      vivo = false;
    };
  }, [uid]);

  async function recarregar() {
    if (!uid) return;
    const lista = await listarObjetivos(uid);
    definirObjetivos(lista);
  }

  async function salvarNovo(dados: DadosDoObjetivo) {
    if (!uid) return;
    await criarObjetivo(uid, dados);
    await recarregar();
    definirModal(null);
  }

  async function salvarEdicao(id: string, dados: DadosDoObjetivo) {
    if (!uid) return;
    await atualizarObjetivo(uid, id, dados);
    await recarregar();
    definirModal(null);
  }

  async function confirmarMovimento(objetivo: Objetivo, dados: DadosDeMovimentacao) {
    if (!uid) return;
    await movimentarObjetivo(uid, objetivo, dados);
    await recarregar();
    definirModal(null);
  }

  async function confirmarExclusao(objetivo: Objetivo) {
    if (!uid) return;
    await removerObjetivo(uid, objetivo.id);
    await recarregar();
    definirModal(null);
  }

  const totalGuardado = useMemo(
    () => objetivos.reduce((soma, objetivo) => soma + objetivo.valorGuardado, 0),
    [objetivos],
  );
  const totalAlvo = useMemo(
    () => objetivos.reduce((soma, objetivo) => soma + objetivo.valorAlvo, 0),
    [objetivos],
  );
  const concluidos = objetivos.filter(
    (objetivo) => objetivo.valorAlvo > 0 && objetivo.valorGuardado >= objetivo.valorAlvo,
  ).length;
  const fracaoGeral = totalAlvo > 0 ? Math.min(totalGuardado / totalAlvo, 1) : 0;

  return (
    <>
      <CabecalhoDaPagina
        titulo="Objetivos"
        descricao="Metas de poupança para o que você quer conquistar"
        acoes={
          <button
            type="button"
            className="botao botao-principal"
            onClick={() => definirModal({ tipo: 'criar' })}
          >
            + Novo objetivo
          </button>
        }
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {carregando ? (
          <Carregando mensagem="Carregando seus objetivos…" />
        ) : (
          <>
            {/* Tutorial */}
            <section className="cartao">
              <div className="cartao-corpo">
                <p className="texto-apoio" style={{ margin: 0 }}>
                  🎯 <strong>O que são objetivos?</strong> São cofrinhos com um nome e uma meta —
                  uma viagem, a troca do carro, um notebook. Você guarda um pouco de cada vez e
                  acompanha o quanto falta. É separado do saldo do mês: guardar aqui não conta como
                  despesa.
                </p>
              </div>
            </section>

            {objetivos.length === 0 ? (
              <div className="cartao">
                <div className="cartao-corpo">
                  <EstadoVazio
                    selo="🎯"
                    titulo="Nenhum objetivo ainda"
                    descricao="Crie seu primeiro objetivo — dê um nome, defina quanto quer juntar e comece a guardar no seu ritmo."
                    acao={
                      <button
                        type="button"
                        className="botao botao-principal"
                        onClick={() => definirModal({ tipo: 'criar' })}
                      >
                        Criar objetivo
                      </button>
                    }
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Resumo geral */}
                <div className="grade-resumo">
                  <CartaoResumo
                    rotulo="Guardado no total"
                    valor={totalGuardado}
                    cor="entrada"
                    corDaFaixa="var(--entrada)"
                    nota={`${formatarPorcentagem(fracaoGeral)} do que você quer juntar.`}
                  />
                  <CartaoResumo
                    rotulo="Soma das metas"
                    valor={totalAlvo}
                    cor="saldo"
                    corDaFaixa="var(--destaque)"
                    nota={objetivos.length === 1 ? '1 objetivo ativo.' : `${objetivos.length} objetivos ativos.`}
                  />
                  <CartaoResumo
                    rotulo="Concluídos"
                    valor={concluidos}
                    textoValor={`${concluidos} de ${objetivos.length}`}
                    cor="saldo"
                    corDaFaixa="var(--tinta-fraca)"
                    nota={concluidos > 0 ? '🎉 Parabéns pelas conquistas!' : 'Cada aporte te aproxima da primeira.'}
                  />
                </div>

                {/* Mosaico de objetivos */}
                <div className="grade-objetivos">
                  {objetivos.map((objetivo) => {
                    const fracao = proporcao(objetivo);
                    const concluido = objetivo.valorAlvo > 0 && objetivo.valorGuardado >= objetivo.valorAlvo;

                    return (
                      <button
                        key={objetivo.id}
                        type="button"
                        className="cartao objetivo-cartao"
                        onClick={() => definirModal({ tipo: 'detalhe', objetivo })}
                      >
                        <div className="objetivo-cabeca">
                          <span className="objetivo-emoji" aria-hidden="true">{objetivo.emoji}</span>
                          <div className="objetivo-titulos">
                            <span className="objetivo-nome">{objetivo.nome}</span>
                            {objetivo.prazo ? (
                              <span className="objetivo-prazo">até {formatarData(objetivo.prazo)}</span>
                            ) : (
                              <span className="objetivo-prazo">sem prazo</span>
                            )}
                          </div>
                          {concluido ? (
                            <span className="selo-situacao selo-tranquilo" style={{ marginLeft: 'auto' }}>✓ concluído</span>
                          ) : null}
                        </div>

                        <div className="objetivo-barra">
                          <div
                            className="objetivo-barra-preenchida"
                            style={{ width: `${fracao * 100}%`, background: corDoProgresso(fracao) }}
                          />
                        </div>

                        <div className="objetivo-numeros">
                          <span className="objetivo-guardado">{formatarMoeda(objetivo.valorGuardado)}</span>
                          <span className="objetivo-alvo">de {formatarMoeda(objetivo.valorAlvo)}</span>
                        </div>
                        <span className="texto-miudo">
                          {concluido
                            ? 'Meta atingida! 🎉'
                            : `Faltam ${formatarMoeda(objetivo.valorAlvo - objetivo.valorGuardado)} · ${formatarPorcentagem(fracao)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ─── Modais ─── */}
      {modal?.tipo === 'criar' ? (
        <FormularioObjetivo
          aoConfirmar={salvarNovo}
          aoFechar={() => definirModal(null)}
        />
      ) : null}

      {modal?.tipo === 'editar' ? (
        <FormularioObjetivo
          objetivo={modal.objetivo}
          aoConfirmar={(dados) => salvarEdicao(modal.objetivo.id, dados)}
          aoFechar={() => definirModal({ tipo: 'detalhe', objetivo: modal.objetivo })}
        />
      ) : null}

      {modal?.tipo === 'movimentar' ? (
        <FormularioMovimento
          objetivo={modal.objetivo}
          direcao={modal.direcao}
          aoConfirmar={(dados) => confirmarMovimento(modal.objetivo, dados)}
          aoFechar={() => definirModal({ tipo: 'detalhe', objetivo: modal.objetivo })}
        />
      ) : null}

      {modal?.tipo === 'detalhe' && uid ? (
        <DetalheObjetivo
          objetivo={modal.objetivo}
          uid={uid}
          aoDepositar={() => definirModal({ tipo: 'movimentar', objetivo: modal.objetivo, direcao: 'entrada' })}
          aoResgatar={() => definirModal({ tipo: 'movimentar', objetivo: modal.objetivo, direcao: 'saida' })}
          aoEditar={() => definirModal({ tipo: 'editar', objetivo: modal.objetivo })}
          aoExcluir={() => definirModal({ tipo: 'excluir', objetivo: modal.objetivo })}
          aoFechar={() => definirModal(null)}
        />
      ) : null}

      {modal?.tipo === 'excluir' ? (
        <ConfirmarExclusao
          objetivo={modal.objetivo}
          aoConfirmar={() => confirmarExclusao(modal.objetivo)}
          aoFechar={() => definirModal({ tipo: 'detalhe', objetivo: modal.objetivo })}
        />
      ) : null}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function paraCampoData(data: Date | null): string {
  if (!data) return '';
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function deCampoData(texto: string): Date | null {
  if (!texto) return null;
  const [ano, mes, dia] = texto.split('-').map((parte) => Number.parseInt(parte, 10));
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
}

interface PropsFormularioObjetivo {
  objetivo?: Objetivo;
  aoConfirmar: (dados: DadosDoObjetivo) => Promise<void>;
  aoFechar: () => void;
}

function FormularioObjetivo({ objetivo, aoConfirmar, aoFechar }: PropsFormularioObjetivo) {
  const editando = objetivo !== undefined;
  const [nome, definirNome] = useState(objetivo?.nome ?? '');
  const [emoji, definirEmoji] = useState(objetivo?.emoji ?? '🎯');
  const [alvo, definirAlvo] = useState(
    objetivo ? String(objetivo.valorAlvo).replace('.', ',') : '',
  );
  const [prazo, definirPrazo] = useState(paraCampoData(objetivo?.prazo ?? null));
  const [salvando, definirSalvando] = useState(false);
  const [erroLocal, definirErroLocal] = useState<string | null>(null);

  async function confirmar() {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      definirErroLocal('Dê um nome ao objetivo.');
      return;
    }
    const valorAlvo = interpretarValor(alvo);
    if (valorAlvo === null || valorAlvo <= 0) {
      definirErroLocal('Digite uma meta maior que zero.');
      return;
    }

    definirSalvando(true);
    definirErroLocal(null);
    try {
      await aoConfirmar({
        nome: nomeLimpo,
        emoji: emoji || '🎯',
        valorAlvo,
        prazo: deCampoData(prazo),
      });
    } catch {
      definirErroLocal('Não deu para salvar. Tente de novo.');
      definirSalvando(false);
    }
  }

  return (
    <Modal
      titulo={editando ? 'Editar objetivo' : 'Novo objetivo'}
      aoFechar={() => { if (!salvando) aoFechar(); }}
      rodape={
        <>
          <button type="button" className="botao botao-contorno" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="botao botao-principal" onClick={() => void confirmar()} disabled={salvando}>
            {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Criar objetivo'}
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo-grupo">
          <label className="campo-rotulo" htmlFor="objetivo-nome">Nome</label>
          <input
            id="objetivo-nome"
            className="campo"
            type="text"
            maxLength={60}
            value={nome}
            onChange={(evento) => definirNome(evento.target.value)}
            placeholder="Ex: Viagem de fim de ano"
            autoFocus
          />
        </div>

        <div className="campo-grupo">
          <span className="campo-rotulo">Ícone</span>
          <div className="seletor-emoji">
            {EMOJIS_SUGERIDOS.map((opcao) => (
              <button
                key={opcao}
                type="button"
                className={`emoji-opcao${emoji === opcao ? ' ativo' : ''}`}
                onClick={() => definirEmoji(opcao)}
                aria-label={`Ícone ${opcao}`}
                aria-pressed={emoji === opcao}
              >
                {opcao}
              </button>
            ))}
          </div>
        </div>

        <div className="campo-grupo">
          <label className="campo-rotulo" htmlFor="objetivo-alvo">Meta (R$)</label>
          <input
            id="objetivo-alvo"
            className="campo"
            type="text"
            inputMode="decimal"
            value={alvo}
            onChange={(evento) => definirAlvo(evento.target.value)}
            placeholder="0,00"
          />
        </div>

        <div className="campo-grupo">
          <label className="campo-rotulo" htmlFor="objetivo-prazo">Prazo (opcional)</label>
          <input
            id="objetivo-prazo"
            className="campo"
            type="date"
            value={prazo}
            onChange={(evento) => definirPrazo(evento.target.value)}
          />
        </div>

        {erroLocal ? <div className="aviso aviso-erro">{erroLocal}</div> : null}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface PropsFormularioMovimento {
  objetivo: Objetivo;
  direcao: 'entrada' | 'saida';
  aoConfirmar: (dados: DadosDeMovimentacao) => Promise<void>;
  aoFechar: () => void;
}

function FormularioMovimento({ objetivo, direcao, aoConfirmar, aoFechar }: PropsFormularioMovimento) {
  const [valor, definirValor] = useState('');
  const [descricao, definirDescricao] = useState('');
  const [salvando, definirSalvando] = useState(false);
  const [erroLocal, definirErroLocal] = useState<string | null>(null);

  async function confirmar() {
    const valorLimpo = interpretarValor(valor);
    if (valorLimpo === null || valorLimpo <= 0) {
      definirErroLocal('Digite um valor maior que zero.');
      return;
    }
    if (direcao === 'saida' && valorLimpo > objetivo.valorGuardado) {
      definirErroLocal('Valor maior que o guardado neste objetivo.');
      return;
    }

    definirSalvando(true);
    definirErroLocal(null);
    try {
      await aoConfirmar({
        tipo: direcao,
        valor: valorLimpo,
        descricao: descricao.trim() || (direcao === 'entrada' ? 'Aporte' : 'Resgate'),
      });
    } catch {
      definirErroLocal('Não deu para registrar. Tente de novo.');
      definirSalvando(false);
    }
  }

  return (
    <Modal
      titulo={direcao === 'entrada' ? `Guardar em ${objetivo.nome}` : `Resgatar de ${objetivo.nome}`}
      aoFechar={() => { if (!salvando) aoFechar(); }}
      rodape={
        <>
          <button type="button" className="botao botao-contorno" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </button>
          <button
            type="button"
            className={direcao === 'entrada' ? 'botao botao-entrada' : 'botao botao-saida'}
            onClick={() => void confirmar()}
            disabled={salvando}
          >
            {salvando ? 'Salvando…' : direcao === 'entrada' ? 'Guardar' : 'Resgatar'}
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo-grupo">
          <label className="campo-rotulo" htmlFor="movimento-valor">Valor (R$)</label>
          <input
            id="movimento-valor"
            className="campo"
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(evento) => definirValor(evento.target.value)}
            placeholder="0,00"
            autoFocus
          />
        </div>
        <div className="campo-grupo">
          <label className="campo-rotulo" htmlFor="movimento-descricao">Descrição (opcional)</label>
          <input
            id="movimento-descricao"
            className="campo"
            type="text"
            maxLength={80}
            value={descricao}
            onChange={(evento) => definirDescricao(evento.target.value)}
            placeholder={direcao === 'entrada' ? 'Ex: aporte do mês' : 'Ex: usei para o conserto'}
          />
        </div>
        {erroLocal ? <div className="aviso aviso-erro">{erroLocal}</div> : null}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface PropsDetalhe {
  objetivo: Objetivo;
  uid: string;
  aoDepositar: () => void;
  aoResgatar: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
  aoFechar: () => void;
}

function DetalheObjetivo({ objetivo, uid, aoDepositar, aoResgatar, aoEditar, aoExcluir, aoFechar }: PropsDetalhe) {
  const [movimentacoes, definirMovimentacoes] = useState<MovimentacaoObjetivo[]>([]);
  const [carregandoMovs, definirCarregandoMovs] = useState(true);

  useEffect(() => {
    let vivo = true;
    definirCarregandoMovs(true);
    lerMovimentacoesObjetivo(uid, objetivo.id)
      .then((lista) => { if (vivo) { definirMovimentacoes(lista); definirCarregandoMovs(false); } })
      .catch(() => { if (vivo) definirCarregandoMovs(false); });
    return () => { vivo = false; };
  }, [uid, objetivo.id]);

  const fracao = proporcao(objetivo);
  const concluido = objetivo.valorAlvo > 0 && objetivo.valorGuardado >= objetivo.valorAlvo;
  const falta = Math.max(0, objetivo.valorAlvo - objetivo.valorGuardado);

  return (
    <Modal
      titulo={`${objetivo.emoji} ${objetivo.nome}`}
      descricao={objetivo.prazo ? `Prazo: ${formatarData(objetivo.prazo)}` : 'Sem prazo definido'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="botao botao-suave" onClick={aoEditar}>Editar</button>
          <button type="button" className="botao botao-perigo" onClick={aoExcluir}>Excluir</button>
        </>
      }
    >
      <div className="objetivo-detalhe">
        <div className="objetivo-detalhe-numeros">
          <div>
            <Dinheiro valor={objetivo.valorGuardado} cor="entrada" className="cartao-resumo-valor" />
            <span className="texto-miudo">de {formatarMoeda(objetivo.valorAlvo)}</span>
          </div>
          <span className={`selo-situacao ${concluido ? 'selo-tranquilo' : 'selo-sem-limite'}`}>
            {formatarPorcentagem(fracao)}
          </span>
        </div>

        <div className="objetivo-barra" style={{ height: 16 }}>
          <div
            className="objetivo-barra-preenchida"
            style={{ width: `${fracao * 100}%`, background: corDoProgresso(fracao) }}
          />
        </div>

        <p className="texto-miudo" style={{ margin: '4px 0 0' }}>
          {concluido
            ? '🎉 Objetivo concluído! Você pode resgatar quando quiser.'
            : `Faltam ${formatarMoeda(falta)} para a meta.`}
        </p>

        <div className="botoes" style={{ marginTop: 16 }}>
          <button type="button" className="botao botao-entrada" onClick={aoDepositar}>+ Guardar</button>
          <button type="button" className="botao botao-saida" onClick={aoResgatar} disabled={objetivo.valorGuardado <= 0}>
            − Resgatar
          </button>
        </div>

        <div className="objetivo-extrato">
          <h3 className="objetivo-extrato-titulo">Extrato</h3>
          {carregandoMovs ? (
            <p className="texto-miudo">Carregando…</p>
          ) : movimentacoes.length === 0 ? (
            <p className="texto-miudo">Nenhuma movimentação ainda. Comece guardando!</p>
          ) : (
            <ul className="lista-lancamentos">
              {movimentacoes.map((movimentacao) => (
                <li className="lancamento" key={movimentacao.id}>
                  <span
                    className="lancamento-selo"
                    style={{ background: movimentacao.tipo === 'entrada' ? 'var(--entrada-clara)' : 'var(--saida-clara)' }}
                  >
                    {movimentacao.tipo === 'entrada' ? '↓' : '↑'}
                  </span>
                  <div className="lancamento-textos">
                    <div className="lancamento-descricao">{movimentacao.descricao}</div>
                    <div className="lancamento-meta"><span>{formatarData(movimentacao.data)}</span></div>
                  </div>
                  <Dinheiro
                    valor={movimentacao.tipo === 'entrada' ? movimentacao.valor : -movimentacao.valor}
                    cor={movimentacao.tipo === 'entrada' ? 'entrada' : 'saida'}
                    comSinal
                    className="lancamento-valor"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface PropsExclusao {
  objetivo: Objetivo;
  aoConfirmar: () => Promise<void>;
  aoFechar: () => void;
}

function ConfirmarExclusao({ objetivo, aoConfirmar, aoFechar }: PropsExclusao) {
  const [excluindo, definirExcluindo] = useState(false);
  const [erroLocal, definirErroLocal] = useState<string | null>(null);

  async function confirmar() {
    definirExcluindo(true);
    definirErroLocal(null);
    try {
      await aoConfirmar();
    } catch {
      definirErroLocal('Não deu para excluir. Tente de novo.');
      definirExcluindo(false);
    }
  }

  return (
    <Modal
      titulo="Excluir objetivo"
      aoFechar={() => { if (!excluindo) aoFechar(); }}
      rodape={
        <>
          <button type="button" className="botao botao-contorno" onClick={aoFechar} disabled={excluindo}>
            Cancelar
          </button>
          <button type="button" className="botao botao-perigo" onClick={() => void confirmar()} disabled={excluindo}>
            {excluindo ? 'Excluindo…' : 'Excluir'}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>
        Tem certeza que quer excluir <strong>{objetivo.nome}</strong>? O histórico de aportes e
        resgates também será apagado. Essa ação não tem volta.
      </p>
      {erroLocal ? <div className="aviso aviso-erro" style={{ marginTop: 12 }}>{erroLocal}</div> : null}
    </Modal>
  );
}
