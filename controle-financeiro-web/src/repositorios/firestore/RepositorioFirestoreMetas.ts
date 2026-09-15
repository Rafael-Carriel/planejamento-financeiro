import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { bancoDeDados } from '../../firebase/config';
import type {
  DadosDaMeta,
  DadosDeMovimentacaoDaMeta,
  IRepositorioMetas,
  Meta,
  MovimentacaoDaMeta,
} from '../interfaces';

/// Implementação Firestore das metas (objetivos) de poupança.
///
/// Cada meta mora em `usuarios/{uid}/objetivos/{id}` com o alvo e o quanto já
/// foi guardado. O histórico de aportes e resgates fica na subcoleção
/// `usuarios/{uid}/objetivos/{id}/movimentacoes`, para dar pra auditar cada meta
/// sem misturar com os lançamentos do mês.
///
/// De propósito, guardar para uma meta NÃO é um lançamento: não sai do saldo do
/// mês como uma despesa. É um cofrinho à parte, igual à Reserva de Emergência.

function colecaoObjetivos(uid: string) {
  return collection(bancoDeDados, 'usuarios', uid, 'objetivos');
}

function documentoObjetivo(uid: string, id: string) {
  return doc(bancoDeDados, 'usuarios', uid, 'objetivos', id);
}

function colecaoMovimentacoes(uid: string, id: string) {
  return collection(bancoDeDados, 'usuarios', uid, 'objetivos', id, 'movimentacoes');
}

export class RepositorioFirestoreMetas implements IRepositorioMetas {
  async listar(uid: string): Promise<Meta[]> {
    const consulta = query(colecaoObjetivos(uid), orderBy('criadoEm', 'asc'));
    const snapshot = await getDocs(consulta);
    const metas: Meta[] = [];

    snapshot.forEach((documento) => {
      const dados = documento.data();
      metas.push({
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

    return metas;
  }

  async criar(uid: string, dados: DadosDaMeta): Promise<void> {
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

  async atualizar(uid: string, id: string, dados: DadosDaMeta): Promise<void> {
    await updateDoc(documentoObjetivo(uid, id), {
      nome: dados.nome,
      emoji: dados.emoji,
      valorAlvo: dados.valorAlvo,
      prazo: dados.prazo ? Timestamp.fromDate(dados.prazo) : null,
      atualizadoEm: Timestamp.now(),
    });
  }

  async excluir(uid: string, id: string): Promise<void> {
    // O Firestore não apaga a subcoleção junto com o documento pai; limpamos as
    // movimentações à mão para não deixar lixo órfão embaixo do usuário.
    const movimentacoes = await getDocs(colecaoMovimentacoes(uid, id));
    const lote = writeBatch(bancoDeDados);
    movimentacoes.forEach((movimentacao) => lote.delete(movimentacao.ref));
    lote.delete(documentoObjetivo(uid, id));
    await lote.commit();
  }

  async movimentar(
    uid: string,
    meta: Meta,
    dados: DadosDeMovimentacaoDaMeta,
  ): Promise<void> {
    const lote = writeBatch(bancoDeDados);

    const novoValor =
      dados.tipo === 'entrada'
        ? meta.valorGuardado + dados.valor
        : meta.valorGuardado - dados.valor;

    lote.update(documentoObjetivo(uid, meta.id), {
      valorGuardado: Math.max(0, novoValor),
      atualizadoEm: Timestamp.now(),
    });

    const movimentacaoRef = doc(colecaoMovimentacoes(uid, meta.id));
    lote.set(movimentacaoRef, {
      tipo: dados.tipo,
      valor: dados.valor,
      descricao: dados.descricao,
      data: Timestamp.now(),
    });

    await lote.commit();
  }

  async lerMovimentacoes(uid: string, id: string): Promise<MovimentacaoDaMeta[]> {
    const consulta = query(colecaoMovimentacoes(uid, id), orderBy('data', 'desc'));
    const snapshot = await getDocs(consulta);
    const movimentacoes: MovimentacaoDaMeta[] = [];

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
}

export const repositorioMetasFirestore = new RepositorioFirestoreMetas();
