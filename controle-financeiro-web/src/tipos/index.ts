/// Tipos compartilhados por todo o app.
///
/// O modelo é o mesmo do aplicativo Flutter, de propósito: os dois leem e
/// escrevem nas mesmas coleções, então mudar um campo aqui exige mudar lá.

/// Natureza do lançamento: dinheiro que entra ou que sai.
///
/// Os valores 'entrada' e 'saida' são gravados no Firestore e validados pelas
/// regras de segurança — não traduzir nem acentuar.
export type TipoTransacao = 'entrada' | 'saida';

/// Um lançamento financeiro do usuário.
///
/// O `valor` é sempre positivo; o sinal vem do `tipo`. Isso evita registros
/// contraditórios, como uma saída com valor negativo.
export interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  categoria: string;
  data: Date;
  observacao: string | null;
  /// Id da recorrência que gerou este lançamento, quando ele nasceu de uma.
  ///
  /// É o que impede a mesma conta de aparecer duas vezes: se existe transação
  /// com este id no mês, a ocorrência prevista daquele mês desaparece da lista
  /// de previstos. Lançamento avulso guarda `null`.
  recorrenciaId: string | null;
  criadoEm: Date | null;
}

/// O que o formulário entrega para gravar. Sem `id`: quem edita passa o id
/// separado, quem cria não tem um ainda.
export interface DadosDeTransacao {
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  categoria: string;
  data: Date;
  observacao: string | null;
  recorrenciaId: string | null;
}

/// Categoria de lançamento.
///
/// O catálogo básico vive no código (funciona sem leitura extra), e o usuário
/// pode acrescentar as suas em `usuarios/{uid}/categorias`. `personalizada`
/// diz de onde a categoria veio: só as personalizadas podem ser editadas.
export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoTransacao;
  emoji: string;
  cor: string;
  personalizada: boolean;
}

/// Planejamento de um mês: quanto o usuário pretende gastar em cada categoria.
///
/// O id do documento é a chave do mês ('2026-08'), então não existe orçamento
/// duplicado para o mesmo mês.
export interface Orcamento {
  mes: string;
  limites: Record<string, number>;
  atualizadoEm: Date | null;
}

/// Perfil do usuário em `usuarios/{uid}`.
export interface Perfil {
  nome: string;
  email: string;
  criadoEm: Date | null;
}

/// Totais de um conjunto de lançamentos.
export interface ResumoFinanceiro {
  entradas: number;
  saidas: number;
  saldo: number;
  quantidade: number;
}

/// Quanto uma categoria movimentou dentro de um conjunto de lançamentos.
export interface TotalPorCategoria {
  categoria: string;
  total: number;
  quantidade: number;
  /// Fração do total do período, de 0 a 1. Serve para desenhar as barras.
  fatia: number;
}

/// Um mês fechado, usado no histórico.
export interface ResumoDeMes {
  chave: string;
  inicio: Date;
  entradas: number;
  saidas: number;
  saldo: number;
  quantidade: number;
}

/// Situação de uma categoria dentro do planejamento do mês.
export interface LinhaDePlanejamento {
  categoria: string;
  limite: number;
  gasto: number;
  /// `gasto / limite`, de 0 em diante. Passa de 1 quando estourou.
  proporcao: number;
  restante: number;
}

/// Um combinado que se repete todo mês: salário, aluguel, boleto em parcelas.
///
/// Mora em `usuarios/{uid}/recorrencias`. Não é lançamento: nada é gravado em
/// `transacoes` por conta dela. As ocorrências são calculadas na hora de mostrar
/// (`OcorrenciaPrevista`) e só viram transação quando o usuário confirma.
/// Assim não existe rotina no servidor para manter, e mudar o valor conserta o
/// futuro sem reescrever o passado.
export interface Recorrencia {
  id: string;
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  categoria: string;
  /// Dia do mês em que cai. Vale de 1 a 31; mês curto encurta para o último dia.
  diaDoMes: number;
  /// Primeiro mês da série, sempre no dia 1º à meia-noite.
  inicio: Date;
  /// Quantas vezes repete. `null` significa "sem fim" — o caso do salário.
  parcelas: number | null;
  /// Recorrência pausada continua na lista, mas não gera previsão.
  ativa: boolean;
  observacao: string | null;
  criadoEm: Date | null;
}

/// O que o formulário de recorrência entrega para gravar.
export interface DadosDeRecorrencia {
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  categoria: string;
  diaDoMes: number;
  inicio: Date;
  parcelas: number | null;
  ativa: boolean;
  observacao: string | null;
}

/// Em que pé está uma ocorrência prevista.
///
/// 'lancada' = já existe a transação de verdade; 'atrasada' = a data passou e
/// ninguém lançou; 'aVencer' = ainda vai acontecer.
export type SituacaoDaOcorrencia = 'lancada' | 'atrasada' | 'aVencer';

/// Uma parcela/mês de uma recorrência, já resolvida para uma data.
///
/// Não existe no banco: é calculada a partir da recorrência e das transações do
/// mês. Serve tanto para a lista de previstos quanto para a previsão dos
/// próximos meses.
export interface OcorrenciaPrevista {
  /// `recorrenciaId:aaaa-mm` — id estável, bom para chave de lista no React.
  chave: string;
  recorrenciaId: string;
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  categoria: string;
  data: Date;
  observacao: string | null;
  /// Qual parcela é esta, de 1 em diante. `null` quando a série não tem fim.
  parcela: number | null;
  totalDeParcelas: number | null;
  situacao: SituacaoDaOcorrencia;
  /// Id da transação que cumpriu esta ocorrência, quando já foi lançada.
  transacaoId: string | null;
}

/// Um mês da previsão: o que já aconteceu somado ao que ainda deve acontecer.
export interface MesPrevisto {
  chave: string;
  inicio: Date;
  /// Totais das transações já gravadas no mês.
  entradasLancadas: number;
  saidasLancadas: number;
  /// Totais das ocorrências que ainda não foram lançadas.
  entradasPrevistas: number;
  saidasPrevistas: number;
  /// Lançado + previsto, que é o número que interessa para se planejar.
  entradas: number;
  saidas: number;
  saldo: number;
  /// Soma dos saldos deste mês e dos anteriores da previsão.
  acumulado: number;
  ocorrencias: OcorrenciaPrevista[];
}
