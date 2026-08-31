import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';

import { bancoDeDados as db } from '../firebase/config';

/// Serviço de Reserva de Emergência.
///
/// A reserva mora em `usuarios/{uid}/reservaEmergencia` (documento único) com
/// a meta e o valor atual, e em `usuarios/{uid}/movimentacoesReserva`
/// (subcoleção) com o histórico de entradas e saídas.

export interface DadosDaReserva {
  meta: number;
  valorAtual: number;
  atualizadoEm: Date | null;
}

export interface MovimentacaoReserva {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
  data: Date;
  criadoEm: Date | null;
}

export interface DadosDeMovimentacao {
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
}

function colecaoReserva(uid: string) {
  return collection(db, 'usuarios', uid, 'reservaEmergencia');
}

function documentoReserva(uid: string) {
  return doc(db, 'usuarios', uid, 'reservaEmergencia', 'dados');
}

function colecaoMovimentacoes(uid: string) {
  return collection(db, 'usuarios', uid, 'movimentacoesReserva');
}

export async function lerReserva(uid: string): Promise<DadosDaReserva> {
  const docRef = documentoReserva(uid);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return { meta: 0, valorAtual: 0, atualizadoEm: null };
  }

  const dados = snapshot.data();
  return {
    meta: dados.meta ?? 0,
    valorAtual: dados.valorAtual ?? 0,
    atualizadoEm: dados.atualizadoEm?.toDate() ?? null,
  };
}

export async function salvarReserva(uid: string, dados: DadosDaReserva): Promise<void> {
  const docRef = documentoReserva(uid);
  await setDoc(docRef, {
    meta: dados.meta,
    valorAtual: dados.valorAtual,
    atualizadoEm: Timestamp.now(),
  });
}

export async function definirMeta(uid: string, meta: number): Promise<void> {
  const atual = await lerReserva(uid);
  await salvarReserva(uid, { ...atual, meta });
}

export async function adicionarMovimentacao(
  uid: string,
  dados: DadosDeMovimentacao,
): Promise<void> {
  const reserva = await lerReserva(uid);
  const batch = writeBatch(db);

  // Atualizar valor atual
  const docRef = documentoReserva(uid);
  const novoValor =
    dados.tipo === 'entrada'
      ? reserva.valorAtual + dados.valor
      : reserva.valorAtual - dados.valor;

  batch.set(docRef, {
    meta: reserva.meta,
    valorAtual: Math.max(0, novoValor),
    atualizadoEm: Timestamp.now(),
  });

  // Criar movimentação
  const movRef = doc(colecaoMovimentacoes(uid));
  batch.set(movRef, {
    tipo: dados.tipo,
    valor: dados.valor,
    descricao: dados.descricao,
    data: Timestamp.now(),
    criadoEm: Timestamp.now(),
  });

  await batch.commit();
}

export async function ultimasMovimentacoes(uid: string, limite = 20): Promise<MovimentacaoReserva[]> {
  const q = query(colecaoMovimentacoes(uid), orderBy('data', 'desc'));
  const snapshot = await getDocs(q);
  const movimentacoes: MovimentacaoReserva[] = [];

  snapshot.forEach((doc) => {
    const dados = doc.data();
    movimentacoes.push({
      id: doc.id,
      tipo: dados.tipo,
      valor: dados.valor,
      descricao: dados.descricao,
      data: dados.data?.toDate() ?? new Date(),
      criadoEm: dados.criadoEm?.toDate() ?? null,
    });
  });

  return movimentacoes.slice(0, limite);
}
