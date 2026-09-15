import { repositorioCategoriasFirestore } from '../repositorios/firestore/RepositorioFirestoreCategorias';
import type { DadosDeCategoria, IRepositorioCategorias } from '../repositorios/interfaces';
import type { Categoria } from '../tipos';

/// Serviço das categorias criadas pelo usuário, em `usuarios/{uid}/categorias`.
///
/// Delega para um `IRepositorioCategorias` injetável (por padrão, o Firestore).
/// As somas ao catálogo básico que vive no código continuam sendo feitas na
/// camada de contexto, não aqui.

export type { DadosDeCategoria } from '../repositorios/interfaces';

let repositorio: IRepositorioCategorias = repositorioCategoriasFirestore;

/// Troca a implementação usada pelo serviço. Chamado pelo contexto de
/// repositórios; não é preciso usar em telas.
export function definirRepositorioCategorias(novo: IRepositorioCategorias): void {
  repositorio = novo;
}

export function observarCategorias(
  uid: string,
  aoReceber: (categorias: Categoria[]) => void,
  aoFalhar: (erro: unknown) => void,
): () => void {
  return repositorio.observar(uid, aoReceber, aoFalhar);
}

export async function criarCategoria(
  uid: string,
  dados: DadosDeCategoria,
): Promise<void> {
  await repositorio.criar(uid, dados);
}

/// Atualiza a categoria.
///
/// O `nome` fica de fora de propósito: ele é a chave que liga a categoria aos
/// lançamentos (a transação guarda o texto, não o id). Renomear aqui deixaria
/// os lançamentos antigos apontando para um nome que não existe mais.
export async function atualizarCategoria(
  uid: string,
  id: string,
  dados: Pick<DadosDeCategoria, 'emoji' | 'cor'>,
): Promise<void> {
  await repositorio.atualizar(uid, id, dados);
}

export async function excluirCategoria(uid: string, id: string): Promise<void> {
  await repositorio.excluir(uid, id);
}
