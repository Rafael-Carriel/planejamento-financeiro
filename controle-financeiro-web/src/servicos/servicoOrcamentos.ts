import { repositorioOrcamentosFirestore } from '../repositorios/firestore/RepositorioFirestoreOrcamentos';
import type { IRepositorioOrcamentos } from '../repositorios/interfaces';
import type { Orcamento } from '../tipos';

/// Serviço do planejamento mensal, em `usuarios/{uid}/orcamentos/{aaaa-mm}`.
///
/// Delega para um `IRepositorioOrcamentos` injetável (por padrão, o Firestore).

let repositorio: IRepositorioOrcamentos = repositorioOrcamentosFirestore;

/// Troca a implementação usada pelo serviço. Chamado pelo contexto de
/// repositórios; não é preciso usar em telas.
export function definirRepositorioOrcamentos(novo: IRepositorioOrcamentos): void {
  repositorio = novo;
}

export function observarOrcamento(
  uid: string,
  chaveDoMes: string,
  aoReceber: (orcamento: Orcamento) => void,
  aoFalhar: (erro: unknown) => void,
): () => void {
  return repositorio.observar(uid, chaveDoMes, aoReceber, aoFalhar);
}

export function lerOrcamento(uid: string, chaveDoMes: string): Promise<Orcamento> {
  return repositorio.ler(uid, chaveDoMes);
}

/// Grava o mapa de limites inteiro, o que permite remover um limite.
export async function salvarLimites(
  uid: string,
  chaveDoMes: string,
  limites: Record<string, number>,
): Promise<void> {
  await repositorio.salvar(uid, chaveDoMes, limites);
}
