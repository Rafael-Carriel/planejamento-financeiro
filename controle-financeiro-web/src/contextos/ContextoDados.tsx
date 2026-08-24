import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { CATEGORIAS_BASE, corDerivadaDoNome } from '../dados/catalogoCategorias';
import { RESUMO_VAZIO, resumir } from '../dominio/calculos';
import {
  descricaoDaOcorrencia,
  ocorrenciasDoMes,
  pendentes,
} from '../dominio/recorrencias';
import {
  atualizarCategoria,
  criarCategoria,
  excluirCategoria,
  observarCategorias,
  type DadosDeCategoria,
} from '../servicos/servicoCategorias';
import { mensagemDeErro } from '../servicos/servicoAutenticacao';
import {
  lerOrcamento,
  observarOrcamento,
  salvarLimites,
} from '../servicos/servicoOrcamentos';
import {
  atualizarRecorrencia,
  criarRecorrencia,
  definirRecorrenciaAtiva,
  excluirRecorrencia,
  observarRecorrencias,
} from '../servicos/servicoRecorrencias';
import {
  atualizarTransacao,
  criarTransacao,
  excluirTransacao,
  observarTransacoes,
} from '../servicos/servicoTransacoes';
import type {
  Categoria,
  DadosDeRecorrencia,
  DadosDeTransacao,
  OcorrenciaPrevista,
  Orcamento,
  Recorrencia,
  ResumoFinanceiro,
  TipoTransacao,
  Transacao,
} from '../tipos';
import { chaveDoMes, somarMeses } from '../utilitarios/datas';
import { useAutenticacao } from './ContextoAutenticacao';
import { useMes } from './ContextoMes';

/// Os dados do mês selecionado, num só lugar.
///
/// Existe **uma** assinatura de transações para todo o app, compartilhada pelas
/// páginas. Se cada página abrisse a sua, o mesmo mês seria lido quatro vezes e
/// a cota de leituras do Firestore iria embora sem nenhum ganho.

interface ValorDosDados {
  transacoes: Transacao[];
  resumo: ResumoFinanceiro;
  carregando: boolean;
  erro: string | null;

  /// Catálogo básico + as categorias do usuário, já ordenadas.
  categorias: Categoria[];
  categoriasPersonalizadas: Categoria[];
  categoriasDoTipo: (tipo: TipoTransacao) => Categoria[];
  /// Nunca devolve nulo: categoria fora do catálogo ganha cor derivada do nome.
  descreverCategoria: (nome: string) => Categoria;

  orcamento: Orcamento;

  /// Os combinados fixos do usuário, independentes do mês.
  recorrencias: Recorrencia[];
  /// O que as recorrências preveem para o mês selecionado, lançado ou não.
  ocorrenciasDoMesSelecionado: OcorrenciaPrevista[];
  /// Só as que ainda não viraram lançamento.
  previstosDoMes: OcorrenciaPrevista[];

  salvarTransacao: (dados: DadosDeTransacao, id?: string) => Promise<void>;
  removerTransacao: (id: string) => Promise<void>;
  salvarCategoria: (dados: DadosDeCategoria) => Promise<void>;
  editarCategoria: (id: string, dados: Pick<DadosDeCategoria, 'emoji' | 'cor'>) => Promise<void>;
  removerCategoria: (id: string) => Promise<void>;
  definirLimite: (categoria: string, limite: number) => Promise<void>;
  copiarPlanejamentoDoMesAnterior: () => Promise<number>;

  salvarRecorrencia: (dados: DadosDeRecorrencia, id?: string) => Promise<void>;
  alternarRecorrencia: (id: string, ativa: boolean) => Promise<void>;
  removerRecorrencia: (id: string) => Promise<void>;
  /// Transforma uma ocorrência prevista em lançamento de verdade.
  lancarPrevisto: (ocorrencia: OcorrenciaPrevista) => Promise<void>;
}

const ContextoDados = createContext<ValorDosDados | null>(null);

const ORCAMENTO_VAZIO: Orcamento = { mes: '', limites: {}, atualizadoEm: null };

export function ProvedorDeDados({ children }: { children: ReactNode }) {
  const { usuario } = useAutenticacao();
  const { mes, chave, inicio, fim } = useMes();
  const uid = usuario?.uid ?? null;

  const [transacoes, definirTransacoes] = useState<Transacao[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [categoriasPersonalizadas, definirCategoriasPersonalizadas] = useState<Categoria[]>([]);
  const [orcamento, definirOrcamento] = useState<Orcamento>(ORCAMENTO_VAZIO);
  const [recorrencias, definirRecorrencias] = useState<Recorrencia[]>([]);

  // Transações do mês: a assinatura única do app.
  useEffect(() => {
    if (!uid) {
      definirTransacoes([]);
      definirCarregando(false);
      return;
    }

    definirCarregando(true);
    definirErro(null);

    const encerrar = observarTransacoes(
      uid,
      inicio,
      fim,
      (recebidas) => {
        definirTransacoes(recebidas);
        definirCarregando(false);
      },
      (falha) => {
        console.error('Falha ao ouvir as transações.', falha);
        definirErro(mensagemDeErro(falha));
        definirCarregando(false);
      },
    );

    return encerrar;
  }, [uid, inicio, fim]);

  // Categorias do usuário: não dependem do mês.
  useEffect(() => {
    if (!uid) {
      definirCategoriasPersonalizadas([]);
      return;
    }

    const encerrar = observarCategorias(
      uid,
      definirCategoriasPersonalizadas,
      (falha) => {
        // Sem as personalizadas o app segue com o catálogo básico, então isto
        // não vira erro de tela — só aviso no console.
        console.warn('Falha ao ouvir as categorias.', falha);
      },
    );

    return encerrar;
  }, [uid]);

  // Planejamento do mês selecionado.
  useEffect(() => {
    if (!uid) {
      definirOrcamento(ORCAMENTO_VAZIO);
      return;
    }

    const encerrar = observarOrcamento(uid, chave, definirOrcamento, (falha) => {
      console.warn('Falha ao ouvir o planejamento.', falha);
      definirOrcamento({ mes: chave, limites: {}, atualizadoEm: null });
    });

    return encerrar;
  }, [uid, chave]);

  // Recorrências: como as categorias, não dependem do mês. São poucos documentos
  // e alimentam tanto os previstos do mês quanto a página de previsão.
  useEffect(() => {
    if (!uid) {
      definirRecorrencias([]);
      return;
    }

    const encerrar = observarRecorrencias(uid, definirRecorrencias, (falha) => {
      // Sem as recorrências o app continua mostrando os lançamentos do mês, que
      // é o essencial — então isto não derruba a tela.
      console.warn('Falha ao ouvir as recorrências.', falha);
    });

    return encerrar;
  }, [uid]);

  const categorias = useMemo<Categoria[]>(() => {
    const todas = [...CATEGORIAS_BASE, ...categoriasPersonalizadas];
    return todas.sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'entrada' ? -1 : 1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [categoriasPersonalizadas]);

  const porNome = useMemo(() => {
    const mapa = new Map<string, Categoria>();
    // As personalizadas entram depois para vencerem o catálogo básico em caso
    // de nome repetido — quem criou a categoria escolheu o emoji e a cor.
    for (const categoria of CATEGORIAS_BASE) mapa.set(categoria.nome, categoria);
    for (const categoria of categoriasPersonalizadas) mapa.set(categoria.nome, categoria);
    return mapa;
  }, [categoriasPersonalizadas]);

  const descreverCategoria = useCallback(
    (nome: string): Categoria =>
      porNome.get(nome) ?? {
        id: `desconhecida:${nome}`,
        nome,
        tipo: 'saida',
        emoji: '🏷️',
        cor: corDerivadaDoNome(nome),
        personalizada: false,
      },
    [porNome],
  );

  const categoriasDoTipo = useCallback(
    (tipo: TipoTransacao) => categorias.filter((categoria) => categoria.tipo === tipo),
    [categorias],
  );

  const resumo = useMemo(
    () => (transacoes.length > 0 ? resumir(transacoes) : RESUMO_VAZIO),
    [transacoes],
  );

  // As ocorrências saem das recorrências cruzadas com o que já foi lançado no
  // mês — por isso vivem aqui, onde as duas listas estão à mão, e não em cada
  // página.
  const ocorrenciasDoMesSelecionado = useMemo(
    () => (recorrencias.length > 0 ? ocorrenciasDoMes(recorrencias, mes, transacoes) : []),
    [recorrencias, mes, transacoes],
  );

  const previstosDoMes = useMemo(
    () => pendentes(ocorrenciasDoMesSelecionado),
    [ocorrenciasDoMesSelecionado],
  );

  const definirLimite = useCallback(
    async (categoria: string, limite: number) => {
      if (!uid) return;
      const limites = { ...orcamento.limites };
      if (limite > 0) limites[categoria] = limite;
      else delete limites[categoria];
      await salvarLimites(uid, chave, limites);
    },
    [uid, chave, orcamento.limites],
  );

  const copiarPlanejamentoDoMesAnterior = useCallback(async () => {
    if (!uid) return 0;

    const anterior = await lerOrcamento(uid, chaveDoMes(somarMeses(mes, -1)));
    const quantidade = Object.keys(anterior.limites).length;
    if (quantidade === 0) return 0;

    // Os limites do mês anterior não apagam o que já foi definido aqui: o que o
    // usuário ajustou neste mês é a informação mais recente e vence.
    await salvarLimites(uid, chave, { ...anterior.limites, ...orcamento.limites });
    return quantidade;
  }, [uid, chave, mes, orcamento.limites]);

  const valor = useMemo<ValorDosDados>(
    () => ({
      transacoes,
      resumo,
      carregando,
      erro,
      categorias,
      categoriasPersonalizadas,
      categoriasDoTipo,
      descreverCategoria,
      orcamento,
      recorrencias,
      ocorrenciasDoMesSelecionado,
      previstosDoMes,
      salvarTransacao: async (dados, id) => {
        if (!uid) throw new Error('Entre na conta para lançar.');
        if (id) await atualizarTransacao(uid, id, dados);
        else await criarTransacao(uid, dados);
      },
      removerTransacao: async (id) => {
        if (!uid) return;
        await excluirTransacao(uid, id);
      },
      salvarCategoria: async (dados) => {
        if (!uid) throw new Error('Entre na conta para criar categorias.');
        await criarCategoria(uid, dados);
      },
      editarCategoria: async (id, dados) => {
        if (!uid) return;
        await atualizarCategoria(uid, id, dados);
      },
      removerCategoria: async (id) => {
        if (!uid) return;
        await excluirCategoria(uid, id);
      },
      definirLimite,
      copiarPlanejamentoDoMesAnterior,
      salvarRecorrencia: async (dados, id) => {
        if (!uid) throw new Error('Entre na conta para criar recorrências.');
        if (id) await atualizarRecorrencia(uid, id, dados);
        else await criarRecorrencia(uid, dados);
      },
      alternarRecorrencia: async (id, ativa) => {
        if (!uid) return;
        await definirRecorrenciaAtiva(uid, id, ativa);
      },
      removerRecorrencia: async (id) => {
        if (!uid) return;
        await excluirRecorrencia(uid, id);
      },
      lancarPrevisto: async (ocorrencia) => {
        if (!uid) throw new Error('Entre na conta para lançar.');
        if (ocorrencia.situacao === 'lancada') return;

        // O `recorrenciaId` é o que faz a ocorrência sair da lista de previstos:
        // é por ele que a projeção reconhece o mês como resolvido.
        await criarTransacao(uid, {
          descricao: descricaoDaOcorrencia(ocorrencia),
          valor: ocorrencia.valor,
          tipo: ocorrencia.tipo,
          categoria: ocorrencia.categoria,
          data: ocorrencia.data,
          observacao: ocorrencia.observacao,
          recorrenciaId: ocorrencia.recorrenciaId,
        });
      },
    }),
    [
      transacoes,
      resumo,
      carregando,
      erro,
      categorias,
      categoriasPersonalizadas,
      categoriasDoTipo,
      descreverCategoria,
      orcamento,
      recorrencias,
      ocorrenciasDoMesSelecionado,
      previstosDoMes,
      uid,
      definirLimite,
      copiarPlanejamentoDoMesAnterior,
    ],
  );

  return <ContextoDados.Provider value={valor}>{children}</ContextoDados.Provider>;
}

export function useDados(): ValorDosDados {
  const valor = useContext(ContextoDados);
  if (!valor) throw new Error('useDados precisa estar dentro de <ProvedorDeDados>.');
  return valor;
}
