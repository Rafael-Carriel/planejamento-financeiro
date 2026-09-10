import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';

import { bancoDeDados as db } from '../firebase/config';

/// Serviço de Objetivos financeiros — metas de poupança nomeadas.
///
/// Cada objetivo mora em `usuarios/{uid}/objetivos/{id}` com o alvo e o quanto
/// já foi guardado. O histórico de aportes e resgates fica na subcoleção
/// `usuarios/{uid}/objetivos/{id}/movimentacoes`, para dar pra auditar cada meta
/// sem misturar com os lançamentos do mês.
///
/// De propósito, guardar para um objetivo NÃO é um lançamento: não sai do saldo
/// do mês como uma despesa. É um cofrinho à parte, igual à Reserva de Emergência.

export interface Objetivo {
  id: string;
  nome: string;
  emoji: string;
  valorAlvo: number;
  valorGuardado: number;
  prazo: Date | null;
  criadoEm: Date | null;
  atualizadoEm: Date | null;
}

export interface DadosDoObjetivo {
  nome: string;
  emoji: string;
  valorAlvo: number;
  prazo: Date | null;
}

export interface MovimentacaoObjetivo {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
  data: Date;
}

export interface DadosDeMovimentacao {
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
}

function colecaoObjetivos(uid: string) {
  return collection(db, 'usuarios', uid, 'objetivos');
}

function documentoObjetivo(uid: string, id: string) {
  return doc(db, 'usuarios', uid, 'objetivos', id);
}

function colecaoMovimentacoes(uid: string, id: string) {
  return collection(db, 'usuarios', uid, 'objetivos', id, 'movimentacoes');
}

export async function listarObjetivos(uid: string): Promise<Objetivo[]> {
  const consulta = query(colecaoObjetivos(uid), orderBy('criadoEm', 'asc'));
  const snapshot = await getDocs(consulta);
  const objetivos: Objetivo[] = [];

  snapshot.forEach((documento) => {
    const dados = documento.data();
    objetivos.push({
      id: documento.id,
      nome: dados.nome ?? '',
      emoji: dados.emoji ?? '🎯',
      valorAlvo: dados.valorAlvo ?? 0,
      valorGuardado: dados.valorGuardado ?? 0,
      prazo: dados.prazo?.toDate() ?? null,
      criadoEm: dados.criadoEm?.toDate() ?? null,
      atualizadoEm: dados.atualizadoEm?.toDate() ?? null,
    });
  });

  return objetivos;
}

export async function criarObjetivo(uid: string, dados: DadosDoObjetivo): Promise<void> {
  await addDoc(colecaoObjetivos(uid), {
    nome: dados.nome,
    emoji: dados.emoji,
    valorAlvo: dados.valorAlvo,
    valorGuardado: 0,
    prazo: dados.prazo ? Timestamp.fromDate(dados.prazo) : null,
    criadoEm: Timestamp.now(),
    atualizadoEm: Timestamp.now(),
  });
}

export async function atualizarObjetivo(
  uid: string,
  id: string,
  dados: DadosDoObjetivo,
): Promise<void> {
  await updateDoc(documentoObjetivo(uid, id), {
    nome: dados.nome,
    emoji: dados.emoji,
    valorAlvo: dados.valorAlvo,
    prazo: dados.prazo ? Timestamp.fromDate(dados.prazo) : null,
    atualizadoEm: Timestamp.now(),
  });
}

export async function removerObjetivo(uid: string, id: string): Promise<void> {
  // O Firestore não apaga a subcoleção junto com o documento pai; limpamos as
  // movimentações à mão para não deixar lixo órfão embaixo do usuário.
  const movimentacoes = await getDocs(colecaoMovimentacoes(uid, id));
  const lote = writeBatch(db);
  movimentacoes.forEach((movimentacao) => lote.delete(movimentacao.ref));
  lote.delete(documentoObjetivo(uid, id));
  await lote.commit();
}

export async function movimentarObjetivo(
  uid: string,
  objetivo: Objetivo,
  dados: DadosDeMovimentacao,
): Promise<void> {
  const lote = writeBatch(db);

  const novoValor =
    dados.tipo === 'entrada'
      ? objetivo.valorGuardado + dados.valor
      : objetivo.valorGuardado - dados.valor;

  lote.update(documentoObjetivo(uid, objetivo.id), {
    valorGuardado: Math.max(0, novoValor),
    atualizadoEm: Timestamp.now(),
  });

  const movimentacaoRef = doc(colecaoMovimentacoes(uid, objetivo.id));
  lote.set(movimentacaoRef, {
    tipo: dados.tipo,
    valor: dados.valor,
    descricao: dados.descricao,
    data: Timestamp.now(),
  });

  await lote.commit();
}

export async function lerMovimentacoesObjetivo(
  uid: string,
  id: string,
): Promise<MovimentacaoObjetivo[]> {
  const consulta = query(colecaoMovimentacoes(uid, id), orderBy('data', 'desc'));
  const snapshot = await getDocs(consulta);
  const movimentacoes: MovimentacaoObjetivo[] = [];

  snapshot.forEach((documento) => {
    const dados = documento.data();
    movimentacoes.push({
      id: documento.id,
      tipo: dados.tipo,
      valor: dados.valor,
      descricao: dados.descricao ?? '',
      data: dados.data?.toDate() ?? new Date(),
    });
  });

  return movimentacoes;
}
