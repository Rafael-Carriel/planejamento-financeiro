import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { corDerivadaDoNome } from '../../dados/catalogoCategorias';
import { bancoDeDados } from '../../firebase/config';
import type { Categoria, TipoTransacao } from '../../tipos';
import type { DadosDeCategoria, IRepositorioCategorias } from '../interfaces';

/// Implementação Firestore de `usuarios/{uid}/categorias`.
///
/// Somam-se ao catálogo básico que vive no código. A ordenação é por `nome`,
/// um campo só, então o índice automático do Firestore já dá conta.

function colecaoDeCategorias(uid: string) {
  return collection(bancoDeDados, 'usuarios', uid, 'categorias');
}

function paraCategoria(documento: QueryDocumentSnapshot<DocumentData>): Categoria {
  const dados = documento.data();
  const nome = typeof dados.nome === 'string' ? dados.nome.trim() : '';

  return {
    id: documento.id,
    nome: nome.length > 0 ? nome : 'Sem nome',
    tipo: dados.tipo === 'entrada' ? 'entrada' : 'saida',
    emoji: typeof dados.emoji === 'string' && dados.emoji.length > 0 ? dados.emoji : '🏷️',
    cor:
      typeof dados.cor === 'string' && dados.cor.length > 0
        ? dados.cor
        : corDerivadaDoNome(nome),
    personalizada: true,
  };
}

export class RepositorioFirestoreCategorias implements IRepositorioCategorias {
  observar(
    uid: string,
    aoReceber: (categorias: Categoria[]) => void,
    aoFalhar: (erro: unknown) => void,
  ): () => void {
    return onSnapshot(
      query(colecaoDeCategorias(uid), orderBy('nome')),
      (resultado) => aoReceber(resultado.docs.map(paraCategoria)),
      (erro) => aoFalhar(erro),
    );
  }

  async criar(uid: string, dados: DadosDeCategoria): Promise<void> {
    await addDoc(colecaoDeCategorias(uid), {
      nome: dados.nome.trim(),
      tipo: dados.tipo as TipoTransacao,
      emoji: dados.emoji,
      cor: dados.cor,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  }

  /// Atualiza a categoria.
  ///
  /// O `nome` fica de fora de propósito: ele é a chave que liga a categoria aos
  /// lançamentos (a transação guarda o texto, não o id). Renomear aqui deixaria
  /// os lançamentos antigos apontando para um nome que não existe mais.
  async atualizar(
    uid: string,
    id: string,
    dados: Pick<DadosDeCategoria, 'emoji' | 'cor'>,
  ): Promise<void> {
    await updateDoc(doc(bancoDeDados, 'usuarios', uid, 'categorias', id), {
      emoji: dados.emoji,
      cor: dados.cor,
      atualizadoEm: serverTimestamp(),
    });
  }

  async excluir(uid: string, id: string): Promise<void> {
    await deleteDoc(doc(bancoDeDados, 'usuarios', uid, 'categorias', id));
  }
}

export const repositorioCategoriasFirestore = new RepositorioFirestoreCategorias();
