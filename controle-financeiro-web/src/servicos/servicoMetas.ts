import { repositorioMetasFirestore } from '../repositorios/firestore/RepositorioFirestoreMetas';
import type {
  DadosDaMeta,
  DadosDeMovimentacaoDaMeta,
  IRepositorioMetas,
  Meta,
  MovimentacaoDaMeta,
} from '../repositorios/interfaces';

/// Serviço das metas de poupança (objetivos), em `usuarios/{uid}/objetivos`.
///
/// Delega para um `IRepositorioMetas` injetável (por padrão, o Firestore).
/// Guardar para uma meta não é um lançamento: é um cofrinho à parte do saldo
/// do mês.

export type {
  DadosDaMeta,
  DadosDeMovimentacaoDaMeta,
  Meta,
  MovimentacaoDaMeta,
} from '../repositorios/interfaces';

let repositorio: IRepositorioMetas = repositorioMetasFirestore;

/// Troca a implementação usada pelo serviço. Chamado pelo contexto de
/// repositórios; não é preciso usar em telas.
export function definirRepositorioMetas(novo: IRepositorioMetas): void {
  repositorio = novo;
}

export function listarMetas(uid: string): Promise<Meta[]> {
  return repositorio.listar(uid);
}

export async function criarMeta(uid: string, dados: DadosDaMeta): Promise<void> {
  await repositorio.criar(uid, dados);
}

export async function atualizarMeta(
  uid: string,
  id: string,
  dados: DadosDaMeta,
): Promise<void> {
  await repositorio.atualizar(uid, id, dados);
}

export async function removerMeta(uid: string, id: string): Promise<void> {
  await repositorio.excluir(uid, id);
}

export async function movimentarMeta(
  uid: string,
  meta: Meta,
  dados: DadosDeMovimentacaoDaMeta,
): Promise<void> {
  await repositorio.movimentar(uid, meta, dados);
}

export function lerMovimentacoesDaMeta(
  uid: string,
  id: string,
): Promise<MovimentacaoDaMeta[]> {
  return repositorio.lerMovimentacoes(uid, id);
}
