import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useDados } from '../contextos/ContextoDados';
import { useLancamento } from '../contextos/ContextoLancamento';
import { useMes } from '../contextos/ContextoMes';
import { filtrarPorTipo, resumir, totaisPorCategoria } from '../dominio/calculos';
// `doTipo` sai com outro nome: aqui `doTipo` já é a lista de transações do tipo.
import { doTipo as ocorrenciasDoTipo, somarOcorrencias } from '../dominio/recorrencias';
import type { TipoTransacao, Transacao } from '../tipos';
import { baixarCsv, transacoesParaCsv } from '../utilitarios/csv';
import { formatarMoeda } from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';
import { BarrasDeCategoria } from './BarrasDeCategoria';
import { CabecalhoDaPagina } from './CabecalhoDaPagina';
import { CartaoResumo } from './CartaoResumo';
import { Carregando, EstadoVazio, FaixaDeErro } from './Estados';
import { ListaDeLancamentos } from './ListaDeLancamentos';
import { ListaDePrevistos } from './ListaDePrevistos';

/// A página de receitas e a de despesas são a mesma tela com o sinal trocado.
///
/// Em vez de dois arquivos quase idênticos — e do risco de corrigir a busca num
/// e esquecer no outro — o tipo entra como propriedade e os textos saem de um
/// dicionário. O que muda de verdade entre as duas é só a linguagem.

type Ordem = 'data' | 'maior' | 'menor';

interface Vocabulario {
  titulo: string;
  singular: string;
  plural: string;
  botao: string;
  rotuloDoTotal: string;
  rotuloDoPrevisto: string;
  tituloDoPrevisto: string;
  tituloVazio: string;
  descricaoVazia: string;
  arquivo: string;
}

const VOCABULARIO: Record<TipoTransacao, Vocabulario> = {
  entrada: {
    titulo: 'Receitas',
    singular: 'receita',
    plural: 'receitas',
    botao: '+ Nova receita',
    rotuloDoTotal: 'Total que entrou',
    rotuloDoPrevisto: 'Ainda a receber',
    tituloDoPrevisto: 'Receitas a confirmar',
    tituloVazio: 'Nenhuma receita neste mês',
    descricaoVazia:
      'Lance o salário, um freelance, uma venda — qualquer dinheiro que entrou. Os totais e as categorias se atualizam na hora.',
    arquivo: 'receitas',
  },
  saida: {
    titulo: 'Despesas',
    singular: 'despesa',
    plural: 'despesas',
    botao: '+ Nova despesa',
    rotuloDoTotal: 'Total que saiu',
    rotuloDoPrevisto: 'Ainda a pagar',
    tituloDoPrevisto: 'Contas a confirmar',
    tituloVazio: 'Nenhuma despesa neste mês',
    descricaoVazia:
      'Registre o aluguel, o mercado, uma assinatura. Com as saídas lançadas o planejamento passa a avisar quando um limite aperta.',
    arquivo: 'despesas',
  },
};

function ordenar(transacoes: Transacao[], ordem: Ordem): Transacao[] {
  if (ordem === 'data') return transacoes;
  const copia = [...transacoes];
  copia.sort((a, b) => (ordem === 'maior' ? b.valor - a.valor : a.valor - b.valor));
  return copia;
}

export function PaginaDeLancamentos({ tipo }: { tipo: TipoTransacao }) {
  const vocabulario = VOCABULARIO[tipo];
  const cor = tipo === 'entrada' ? 'entrada' : 'saida';

  const { rotulo, chave } = useMes();
  const { transacoes, carregando, erro, previstosDoMes } = useDados();
  const { abrirNovo } = useLancamento();

  const [busca, definirBusca] = useState('');
  const [categoriaFiltrada, definirCategoriaFiltrada] = useState('todas');
  const [ordem, definirOrdem] = useState<Ordem>('data');

  const doTipo = useMemo(() => filtrarPorTipo(transacoes, tipo), [transacoes, tipo]);
  const resumo = useMemo(() => resumir(doTipo), [doTipo]);
  const porCategoria = useMemo(() => totaisPorCategoria(doTipo, tipo), [doTipo, tipo]);

  // Só as categorias que aparecem no mês entram no filtro: oferecer as 20 do
  // catálogo quando o mês tem 3 seria uma lista de opções que não filtram nada.
  const categoriasDoMes = useMemo(
    () => porCategoria.map((item) => item.categoria),
    [porCategoria],
  );

  const filtradas = useMemo(() => {
    const procura = busca.trim().toLowerCase();

    const resultado = doTipo.filter((transacao) => {
      if (categoriaFiltrada !== 'todas' && transacao.categoria !== categoriaFiltrada) {
        return false;
      }
      if (procura.length === 0) return true;
      return (
        transacao.descricao.toLowerCase().includes(procura) ||
        transacao.categoria.toLowerCase().includes(procura) ||
        (transacao.observacao ?? '').toLowerCase().includes(procura)
      );
    });

    return ordenar(resultado, ordem);
  }, [doTipo, busca, categoriaFiltrada, ordem]);

  const resumoFiltrado = useMemo(() => resumir(filtradas), [filtradas]);
  const filtroAtivo = busca.trim().length > 0 || categoriaFiltrada !== 'todas';
  const totalDoTipo = tipo === 'entrada' ? resumo.entradas : resumo.saidas;
  const totalFiltrado =
    tipo === 'entrada' ? resumoFiltrado.entradas : resumoFiltrado.saidas;

  const maior = useMemo(
    () => doTipo.reduce<Transacao | null>((topo, item) => (!topo || item.valor > topo.valor ? item : topo), null),
    [doTipo],
  );

  // As recorrências deste tipo que ainda não viraram lançamento no mês.
  const previstos = useMemo(
    () => ocorrenciasDoTipo(previstosDoMes, tipo),
    [previstosDoMes, tipo],
  );
  const totalPrevisto = useMemo(() => somarOcorrencias(previstos), [previstos]);
  const quantosVenceram = previstos.filter(
    (ocorrencia) => ocorrencia.situacao === 'atrasada',
  ).length;

  function exportar() {
    baixarCsv(`${vocabulario.arquivo}-${chave}.csv`, transacoesParaCsv(filtradas));
  }

  function limparFiltros() {
    definirBusca('');
    definirCategoriaFiltrada('todas');
  }

  return (
    <>
      <CabecalhoDaPagina
        titulo={vocabulario.titulo}
        descricao={rotulo}
        acoes={
          <button
            type="button"
            className="botao botao-principal"
            onClick={() => abrirNovo(tipo)}
          >
            {vocabulario.botao}
          </button>
        }
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {carregando ? (
          <Carregando mensagem={`Buscando as ${vocabulario.plural} do mês…`} />
        ) : (
          <>
            <div className="grade-resumo">
              <CartaoResumo
                rotulo={vocabulario.rotuloDoTotal}
                valor={totalDoTipo}
                cor={cor}
                corDaFaixa={tipo === 'entrada' ? 'var(--entrada)' : 'var(--saida)'}
                nota={
                  resumo.quantidade === 1
                    ? `1 ${vocabulario.singular} no mês.`
                    : `${resumo.quantidade} ${vocabulario.plural} no mês.`
                }
              />

              <div
                className="cartao cartao-resumo"
                style={comVariaveis({ '--cor-faixa': 'var(--borda-forte)' })}
              >
                <span className="etiqueta">Média por lançamento</span>
                <span className={`dinheiro dinheiro-${cor} cartao-resumo-valor`}>
                  {formatarMoeda(
                    resumo.quantidade > 0 ? totalDoTipo / resumo.quantidade : 0,
                  )}
                </span>
                <p className="cartao-resumo-nota">
                  {porCategoria.length === 0
                    ? 'Sem categorias movimentadas.'
                    : porCategoria.length === 1
                      ? '1 categoria movimentada.'
                      : `${porCategoria.length} categorias movimentadas.`}
                </p>
              </div>

              <div
                className="cartao cartao-resumo"
                style={comVariaveis({ '--cor-faixa': 'var(--borda-forte)' })}
              >
                <span className="etiqueta">Maior {vocabulario.singular}</span>
                <span className={`dinheiro dinheiro-${cor} cartao-resumo-valor`}>
                  {formatarMoeda(maior?.valor ?? 0)}
                </span>
                <p className="cartao-resumo-nota">
                  {maior ? `${maior.descricao} · ${maior.categoria}` : 'Nada lançado ainda.'}
                </p>
              </div>

              {previstos.length > 0 ? (
                <CartaoResumo
                  rotulo={vocabulario.rotuloDoPrevisto}
                  valor={totalPrevisto}
                  cor={cor}
                  corDaFaixa="var(--destaque)"
                  nota={
                    quantosVenceram > 0
                      ? `${quantosVenceram} ${quantosVenceram === 1 ? 'venceu' : 'venceram'} e ainda não ${quantosVenceram === 1 ? 'foi confirmado' : 'foram confirmados'}.`
                      : `${previstos.length} ${previstos.length === 1 ? 'recorrência' : 'recorrências'} esperando confirmação.`
                  }
                />
              ) : null}
            </div>

            {previstos.length > 0 ? (
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>{vocabulario.tituloDoPrevisto}</h2>
                  <Link className="botao-texto" to="/recorrencias">
                    Gerenciar recorrências
                  </Link>
                </div>
                <div className="cartao-corpo-sem-topo">
                  <ListaDePrevistos ocorrencias={previstos} />
                </div>
              </section>
            ) : null}

            {resumo.quantidade === 0 ? (
              <div className="cartao">
                <div className="cartao-corpo">
                  <EstadoVazio
                    selo={tipo === 'entrada' ? '💰' : '🧾'}
                    titulo={vocabulario.tituloVazio}
                    descricao={vocabulario.descricaoVazia}
                    acao={
                      <button
                        type="button"
                        className="botao botao-principal"
                        onClick={() => abrirNovo(tipo)}
                      >
                        {vocabulario.botao}
                      </button>
                    }
                  />
                </div>
              </div>
            ) : (
              <>
                <section className="cartao">
                  <div className="cartao-cabeca">
                    <h2>Por categoria</h2>
                    <span className="texto-miudo">{rotulo}</span>
                  </div>
                  <div className="cartao-corpo">
                    <BarrasDeCategoria totais={porCategoria} cor={cor} />
                  </div>
                </section>

                <section className="cartao">
                  <div className="cartao-cabeca">
                    <h2>Lançamentos</h2>
                    <button type="button" className="botao-texto" onClick={exportar}>
                      Baixar CSV
                    </button>
                  </div>

                  <div className="cartao-corpo">
                    <div className="barra-filtros">
                      <span className="busca">
                        <span className="busca-icone" aria-hidden="true">
                          ⌕
                        </span>
                        <input
                          type="search"
                          value={busca}
                          onChange={(evento) => definirBusca(evento.target.value)}
                          placeholder={`Buscar em ${vocabulario.plural}, categorias e observações`}
                          aria-label={`Buscar ${vocabulario.plural}`}
                        />
                      </span>

                      <select
                        className="selecao"
                        value={categoriaFiltrada}
                        onChange={(evento) => definirCategoriaFiltrada(evento.target.value)}
                        aria-label="Filtrar por categoria"
                      >
                        <option value="todas">Todas as categorias</option>
                        {categoriasDoMes.map((nome) => (
                          <option key={nome} value={nome}>
                            {nome}
                          </option>
                        ))}
                      </select>

                      <select
                        className="selecao"
                        value={ordem}
                        onChange={(evento) => definirOrdem(evento.target.value as Ordem)}
                        aria-label="Ordenar"
                      >
                        <option value="data">Mais recentes</option>
                        <option value="maior">Maior valor</option>
                        <option value="menor">Menor valor</option>
                      </select>

                      {filtroAtivo ? (
                        <button type="button" className="botao-texto" onClick={limparFiltros}>
                          Limpar filtros
                        </button>
                      ) : null}
                    </div>

                    {filtroAtivo ? (
                      <p className="texto-miudo" style={{ marginTop: 12 }}>
                        {filtradas.length === 0
                          ? 'Nenhum lançamento com esse filtro.'
                          : `${filtradas.length} de ${resumo.quantidade} lançamentos · ${formatarMoeda(totalFiltrado)}`}
                      </p>
                    ) : null}
                  </div>

                  <div className="cartao-corpo-sem-topo">
                    {filtradas.length === 0 ? (
                      <EstadoVazio
                        selo="⌕"
                        titulo="Nada encontrado"
                        descricao="Nenhum lançamento deste mês combina com a busca e o filtro escolhidos."
                        acao={
                          <button
                            type="button"
                            className="botao botao-contorno"
                            onClick={limparFiltros}
                          >
                            Limpar filtros
                          </button>
                        }
                      />
                    ) : (
                      <ListaDeLancamentos
                        transacoes={filtradas}
                        comDataNaLinha={ordem !== 'data'}
                      />
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
