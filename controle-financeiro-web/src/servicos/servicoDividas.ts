import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { bancoDeDados } from '../firebase/config';
import type { DadosDeDivida, Divida } from '../tipos';

function colecaoDeDividas(uid: string) {
  return collection(bancoDeDados, 'usuarios', uid, 'dividas');
}

function paraDivida(documento: QueryDocumentSnapshot<DocumentData>): Divida {
  const dados = documento.data();

  const descricao = typeof dados.descricao === 'string' ? dados.descricao.trim() : '';
  const valor = typeof dados.valor === 'number' ? dados.valor : 0;
  const valorPago = typeof dados.valorPago === 'number' ? dados.valorPago : 0;
  const credor = typeof dados.credor === 'string' ? dados.credor.trim() : '';
  const dataVencimento =
    dados.dataVencimento instanceof Timestamp ? dados.dataVencimento.toDate() : null;
  const observacao =
    typeof dados.observacao === 'string' && dados.observacao.trim().length > 0
      ? dados.observacao.trim()
      : null;

  return {
    id: documento.id,
    descricao: descricao.length > 0 ? descricao : 'Sem descrição',
    valor: Math.abs(valor),
    valorPago: Math.abs(valorPago),
    credor: credor.length > 0 ? credor : 'Desconhecido',
    dataVencimento,
    observacao,
    criadoEm: dados.criadoEm instanceof Timestamp ? dados.criadoEm.toDate() : null,
  };
}

function paraFirestore(dados: DadosDeDivida) {
  return {
    descricao: dados.descricao.trim(),
    valor: Math.abs(dados.valor),
    valorPago: Math.abs(dados.valorPago),
    credor: dados.credor.trim(),
    dataVencimento: dados.dataVencimento ? Timestamp.fromDate(dados.dataVencimento) : null,
    observacao:
      dados.observacao && dados.observacao.trim().length > 0
        ? dados.observacao.trim()
        : null,
    atualizadoEm: serverTimestamp(),
  };
}

export function observarDividas(
  uid: string,
  aoReceber: (dividas: Divida[]) => void,
  aoFalhar: (erro: unknown) => void,
): () => void {
  return onSnapshot(
    query(colecaoDeDividas(uid), orderBy('criadoEm', 'desc')),
    (resultado) => aoReceber(resultado.docs.map(paraDivida)),
    (erro) => aoFalhar(erro),
  );
}

export async function criarDivida(uid: string, dados: DadosDeDivida): Promise<void> {
  await addDoc(colecaoDeDividas(uid), {
    ...paraFirestore(dados),
    criadoEm: serverTimestamp(),
  });
}

export async function atualizarDivida(
  uid: string,
  id: string,
  dados: DadosDeDivida,
): Promise<void> {
  await updateDoc(doc(bancoDeDados, 'usuarios', uid, 'dividas', id), paraFirestore(dados));
}

export async function excluirDivida(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(bancoDeDados, 'usuarios', uid, 'dividas', id));
}

export async function registrarPagamento(
  uid: string,
  id: string,
  valorPago: number,
): Promise<void> {
  await updateDoc(doc(bancoDeDados, 'usuarios', uid, 'dividas', id), {
    valorPago: Math.abs(valorPago),
    atualizadoEm: serverTimestamp(),
  });
}
