import type {
  Categoria,
  DadosDeTransacao,
  Orcamento,
  TipoTransacao,
  Transacao,
} from '../tipos';

/// Contratos de acesso a dados.
///
/// A camada de serviço conversa apenas com estas interfaces; quem fala com o
/// Firestore são as implementações em `repositorios/firestore`. Trocar o banco
/// (ou usar um dublê em teste) é substituir a implementação, sem tocar nos
/// serviços nem nos componentes.
///
/// Os métodos recebem o `uid` em vez de guardá-lo no repositório: a raiz dos
/// dados é `usuarios/{uid}`, e quem chama já tem o usuário à mão (vem do
/// contexto de autenticação).

export interface IRepositorioTransacoes {
  /// Acompanha em tempo real os lançamentos de um período. Devolve a função
  /// que encerra a assinatura — chame no fim do efeito.
  observar(
    uid: string,
    inicio: Date,
    fim: Date,
    aoReceber: (transacoes: Transacao[]) => void,
    aoFalhar: (erro: unknown) => void,
  ): () => void;

  /// Leitura única de um período. Para quem não precisa de tempo real.
  ler(uid: string, inicio: Date, fim: Date): Promise<Transacao[]>;

  criar(uid: string, dados: DadosDeTransacao): Promise<void>;

  /// Cria a ocorrência automática de uma recorrência num documento de id
  /// estável, para que duas abas não gerem o mesmo lançamento duas vezes.
  criarAutomatica(
    uid: string,
    recorrenciaId: string,
    dados: DadosDeTransacao,
  ): Promise<void>;

  atualizar(uid: string, id: string, dados: DadosDeTransacao): Promise<void>;

  excluir(uid: string, id: string): Promise<void>;
}

/// O que o formulário entrega para gravar uma categoria do usuário.
export interface DadosDeCategoria {
  nome: string;
  tipo: TipoTransacao;
  emoji: string;
  cor: string;
}

export interface IRepositorioCategorias {
  observar(
    uid: string,
    aoReceber: (categorias: Categoria[]) => void,
    aoFalhar: (erro: unknown) => void,
  ): () => void;

  criar(uid: string, dados: DadosDeCategoria): Promise<void>;

  /// O `nome` fica de fora de propósito: ele é a chave que liga a categoria
  /// aos lançamentos, então renomear quebraria o vínculo com o histórico.
  atualizar(
    uid: string,
    id: string,
    dados: Pick<DadosDeCategoria, 'emoji' | 'cor'>,
  ): Promise<void>;

  excluir(uid: string, id: string): Promise<void>;
}

export interface IRepositorioOrcamentos {
  observar(
    uid: string,
    chaveDoMes: string,
    aoReceber: (orcamento: Orcamento) => void,
    aoFalhar: (erro: unknown) => void,
  ): () => void;

  ler(uid: string, chaveDoMes: string): Promise<Orcamento>;

  /// Grava o mapa de limites inteiro, o que permite remover um limite.
  salvar(
    uid: string,
    chaveDoMes: string,
    limites: Record<string, number>,
  ): Promise<void>;
}

/// Uma meta de poupança, em `usuarios/{uid}/objetivos`.
///
/// Mesmo modelo usado por `servicoObjetivos`, exposto aqui para que a camada
/// de repositório não precise depender da camada de serviço.
export interface Meta {
  id: string;
  nome: string;
  emoji: string;
  valorAlvo: number;
  valorGuardado: number;
  prazo: Date | null;
  criadoEm: Date | null;
  atualizadoEm: Date | null;
}

export interface DadosDaMeta {
  nome: string;
  emoji: string;
  valorAlvo: number;
  prazo: Date | null;
}

export interface MovimentacaoDaMeta {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
  data: Date;
}

export interface DadosDeMovimentacaoDaMeta {
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
}

export interface IRepositorioMetas {
  listar(uid: string): Promise<Meta[]>;

  criar(uid: string, dados: DadosDaMeta): Promise<void>;

  atualizar(uid: string, id: string, dados: DadosDaMeta): Promise<void>;

  /// Apaga a meta e o histórico de movimentações da subcoleção.
  excluir(uid: string, id: string): Promise<void>;

  /// Registra um aporte ou resgate e atualiza o valor guardado.
  movimentar(
    uid: string,
    meta: Meta,
    dados: DadosDeMovimentacaoDaMeta,
  ): Promise<void>;

  lerMovimentacoes(uid: string, id: string): Promise<MovimentacaoDaMeta[]>;
}

/// As quatro dependências de dados, injetadas de uma vez pelo contexto.
export interface Repositorios {
  transacoes: IRepositorioTransacoes;
  categorias: IRepositorioCategorias;
  orcamentos: IRepositorioOrcamentos;
  metas: IRepositorioMetas;
}
