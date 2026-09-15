import { repositorioTransacoesFirestore } from '../repositorios/firestore/RepositorioFirestoreTransacoes';
import type { IRepositorioTransacoes } from '../repositorios/interfaces';
import type { DadosDeTransacao, Transacao } from '../tipos';

/// Serviço de lançamentos.
///
/// Não fala com o Firestore diretamente: delega para um `IRepositorioTransacoes`
/// injetável (por padrão, a implementação Firestore). O `ProvedorDeRepositorios`
/// troca a implementação no arranque do app; em teste, basta injetar um dublê —
/// sem tocar nos componentes.
///
/// A assinatura pública é a mesma de antes: quem chama continua passando o `uid`
/// e recebendo os mesmos tipos.

let repositorio: IRepositorioTransacoes = repositorioTransacoesFirestore;

/// Troca a implementação usada pelo serviço. Chamado pelo contexto de
/// repositórios; não é preciso usar em telas.
export function definirRepositorioTransacoes(novo: IRepositorioTransacoes): void {
  repositorio = novo;
}

export function observarTransacoes(
  uid: string,
  inicio: Date,
  fim: Date,
  aoReceber: (transacoes: Transacao[]) => void,
  aoFalhar: (erro: unknown) => void,
): () => void {
  return repositorio.observar(uid, inicio, fim, aoReceber, aoFalhar);
}

export function lerTransacoes(
  uid: string,
  inicio: Date,
  fim: Date,
): Promise<Transacao[]> {
  return repositorio.ler(uid, inicio, fim);
}

export async function criarTransacao(
  uid: string,
  dados: DadosDeTransacao,
): Promise<void> {
  await repositorio.criar(uid, dados);
}

export async function criarTransacaoAutomatica(
  uid: string,
  recorrenciaId: string,
  dados: DadosDeTransacao,
): Promise<void> {
  await repositorio.criarAutomatica(uid, recorrenciaId, dados);
}

export async function atualizarTransacao(
  uid: string,
  id: string,
  dados: DadosDeTransacao,
): Promise<void> {
  await repositorio.atualizar(uid, id, dados);
}

export async function excluirTransacao(uid: string, id: string): Promise<void> {
  await repositorio.excluir(uid, id);
}
