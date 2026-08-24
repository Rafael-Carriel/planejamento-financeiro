import { useMemo, useState } from 'react';

import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { Dinheiro } from '../componentes/Dinheiro';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { FormularioDeCategoria } from '../componentes/FormularioDeCategoria';
import { Modal } from '../componentes/Modal';
import { useDados } from '../contextos/ContextoDados';
import { useMes } from '../contextos/ContextoMes';
import type { Categoria, TipoTransacao } from '../tipos';
import { formatarMoeda } from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';

/// Categorias: o vocabulário do app.
///
/// O catálogo básico não pode ser apagado — ele é o mesmo do aplicativo do
/// celular, e sumir com "Mercado" aqui deixaria os lançamentos de lá sem nome
/// conhecido. As categorias criadas pelo usuário essas sim podem ir e voltar.

interface Uso {
  quantidade: number;
  total: number;
}

export function Categorias() {
  const { rotulo } = useMes();
  const {
    categorias,
    transacoes,
    carregando,
    erro,
    categoriasDoTipo,
    removerCategoria,
  } = useDados();

  const [formularioAberto, definirFormularioAberto] = useState(false);
  const [emEdicao, definirEmEdicao] = useState<Categoria | null>(null);
  const [tipoInicial, definirTipoInicial] = useState<TipoTransacao>('saida');
  const [paraExcluir, definirParaExcluir] = useState<Categoria | null>(null);
  const [excluindo, definirExcluindo] = useState(false);
  const [erroAoExcluir, definirErroAoExcluir] = useState<string | null>(null);

  const uso = useMemo(() => {
    const mapa = new Map<string, Uso>();
    for (const transacao of transacoes) {
      const atual = mapa.get(transacao.categoria) ?? { quantidade: 0, total: 0 };
      atual.quantidade += 1;
      atual.total += transacao.valor;
      mapa.set(transacao.categoria, atual);
    }
    return mapa;
  }, [transacoes]);

  const quantasPersonalizadas = categorias.filter((item) => item.personalizada).length;

  function abrirNova(tipo: TipoTransacao) {
    definirEmEdicao(null);
    definirTipoInicial(tipo);
    definirFormularioAberto(true);
  }

  function abrirEdicao(categoria: Categoria) {
    definirEmEdicao(categoria);
    definirTipoInicial(categoria.tipo);
    definirFormularioAberto(true);
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return;
    definirExcluindo(true);
    definirErroAoExcluir(null);
    try {
      await removerCategoria(paraExcluir.id);
      definirParaExcluir(null);
    } catch (falha) {
      definirErroAoExcluir(
        falha instanceof Error ? falha.message : 'Não deu para excluir. Tente de novo.',
      );
    } finally {
      definirExcluindo(false);
    }
  }

  function lista(tipo: TipoTransacao) {
    const doTipo = categoriasDoTipo(tipo);

    return (
      <ul className="lista-lancamentos">
        {doTipo.map((categoria) => {
          const dados = uso.get(categoria.nome);

          return (
            <li className="lancamento" key={categoria.id}>
              <span
                className="lancamento-selo"
                style={comVariaveis({
                  '--cor-selo':
                    tipo === 'entrada' ? 'var(--entrada-clara)' : 'var(--saida-clara)',
                })}
                aria-hidden="true"
              >
                {categoria.emoji}
              </span>

              <div className="lancamento-textos">
                <div className="lancamento-descricao">
                  {categoria.nome}
                  {categoria.personalizada ? (
                    <span className="selo-situacao selo-sem-limite" style={{ marginLeft: 8 }}>
                      sua
                    </span>
                  ) : null}
                </div>
                <div className="lancamento-meta">
                  <span
                    className="marcador-categoria"
                    style={comVariaveis({ '--cor-marcador': categoria.cor })}
                  />
                  <span>
                    {dados
                      ? dados.quantidade === 1
                        ? '1 lançamento no mês'
                        : `${dados.quantidade} lançamentos no mês`
                      : 'sem uso neste mês'}
                  </span>
                </div>
              </div>

              {dados ? (
                <Dinheiro
                  valor={dados.total}
                  cor={tipo === 'entrada' ? 'entrada' : 'saida'}
                  className="lancamento-valor"
                />
              ) : (
                <span className="dinheiro dinheiro-neutro lancamento-valor">—</span>
              )}

              <div className="lancamento-acoes">
                {categoria.personalizada ? (
                  <>
                    <button
                      type="button"
                      className="acao-miuda"
                      onClick={() => abrirEdicao(categoria)}
                      aria-label={`Ajustar ${categoria.nome}`}
                      title="Ajustar emoji e cor"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="acao-miuda acao-miuda-perigo"
                      onClick={() => definirParaExcluir(categoria)}
                      aria-label={`Excluir ${categoria.nome}`}
                      title="Excluir"
                    >
                      🗑
                    </button>
                  </>
                ) : (
                  <span className="texto-miudo" title="Categoria do catálogo básico">
                    padrão
                  </span>
                )}
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
        titulo="Categorias"
        descricao={`Uso contado em ${rotulo.toLowerCase()}`}
        comSeletorDeMes={false}
        acoes={
          <button
            type="button"
            className="botao botao-principal"
            onClick={() => abrirNova('saida')}
          >
            + Nova categoria
          </button>
        }
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {carregando ? (
          <Carregando mensagem="Carregando as categorias…" />
        ) : (
          <>
            <div className="cartao">
              <div className="cartao-corpo">
                <p className="texto-apoio" style={{ margin: 0 }}>
                  As {categorias.length} categorias abaixo são as mesmas do aplicativo do celular.
                  As do catálogo básico ficam fixas; as {quantasPersonalizadas === 1 ? 'que você criou' : 'suas'} podem ter o emoji e a cor
                  ajustados a qualquer momento.
                </p>
              </div>
            </div>

            <div className="grade-dupla">
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Entradas</h2>
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
                  <h2>Saídas</h2>
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

            {quantasPersonalizadas === 0 ? (
              <div className="cartao">
                <div className="cartao-corpo">
                  <EstadoVazio
                    selo="⬢"
                    titulo="Nenhuma categoria sua ainda"
                    descricao="O catálogo básico cobre o essencial, mas gastos muito seus — academia, pets, um curso — ficam mais claros com categoria própria."
                    acao={
                      <button
                        type="button"
                        className="botao botao-principal"
                        onClick={() => abrirNova('saida')}
                      >
                        Criar a primeira
                      </button>
                    }
                  />
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {formularioAberto ? (
        <FormularioDeCategoria
          key={emEdicao?.id ?? 'nova'}
          categoria={emEdicao}
          tipoInicial={tipoInicial}
          aoFechar={() => {
            definirFormularioAberto(false);
            definirEmEdicao(null);
          }}
        />
      ) : null}

      {paraExcluir ? (
        <Modal
          titulo="Excluir categoria"
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
                {excluindo ? 'Excluindo…' : 'Excluir categoria'}
              </button>
            </>
          }
        >
          <div className="formulario">
            <p>
              Excluir a categoria <strong>{paraExcluir.nome}</strong>?
            </p>
            <p className="texto-miudo">
              Os lançamentos não são apagados: eles continuam com o nome{' '}
              <strong>{paraExcluir.nome}</strong> e passam a aparecer com uma cor genérica. A
              categoria só sai da lista de escolhas.
            </p>
            {uso.get(paraExcluir.nome) ? (
              <div className="aviso">
                Neste mês ela é usada em {uso.get(paraExcluir.nome)?.quantidade} lançamento(s),
                somando {formatarMoeda(uso.get(paraExcluir.nome)?.total ?? 0)}.
              </div>
            ) : null}
            {erroAoExcluir ? <div className="aviso aviso-erro">{erroAoExcluir}</div> : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
