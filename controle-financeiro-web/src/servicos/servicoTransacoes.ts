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
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { bancoDeDados } from '../firebase/config';
import type { DadosDeTransacao, Transacao, TipoTransacao } from '../tipos';
import { chaveDoMes } from '../utilitarios/datas';

/// Leitura e escrita de `usuarios/{uid}/transacoes`.
///
/// Detalhe importante das consultas: o filtro de período e a ordenação usam o
/// **mesmo** campo (`data`). Isso é de propósito — o Firestore resolve com o
/// índice simples que ele já cria sozinho, sem exigir índice composto. Filtrar
/// por tipo ou categoria é feito no cliente, sobre os lançamentos do mês, que
/// são poucos.

export function colecaoDeTransacoes(uid: string) {
  return collection(bancoDeDados, 'usuarios', uid, 'transacoes');
}

function paraTransacao(documento: QueryDocumentSnapshot<DocumentData>): Transacao {
  const dados = documento.data();

  const descricao = typeof dados.descricao === 'string' ? dados.descricao.trim() : '';
  const valorBruto = typeof dados.valor === 'number' ? dados.valor : 0;
  const tipo: TipoTransacao = dados.tipo === 'entrada' ? 'entrada' : 'saida';
  const data = dados.data instanceof Timestamp ? dados.data.toDate() : new Date();
  const observacao =
    typeof dados.observacao === 'string' && dados.observacao.trim().length > 0
      ? dados.observacao.trim()
      : null;

  return {
    id: documento.id,
    descricao: descricao.length > 0 ? descricao : 'Sem descrição',
    valor: Math.abs(valorBruto),
    tipo,
    categoria: typeof dados.categoria === 'string' && dados.categoria.length > 0
      ? dados.categoria
      : 'Outros',
    data,
    observacao,
    recorrenciaId:
      typeof dados.recorrenciaId === 'string' && dados.recorrenciaId.length > 0
        ? dados.recorrenciaId
        : null,
    criadoEm: dados.criadoEm instanceof Timestamp ? dados.criadoEm.toDate() : null,
  };
}

function consultaDoPeriodo(uid: string, inicio: Date, fim: Date) {
  return query(
    colecaoDeTransacoes(uid),
    where('data', '>=', Timestamp.fromDate(inicio)),
    where('data', '<', Timestamp.fromDate(fim)),
    orderBy('data', 'desc'),
  );
}

/// Acompanha em tempo real os lançamentos de um período.
///
/// Devolve a função que encerra a assinatura — chame no fim do efeito, senão a
/// escuta continua ativa e o app segue pagando leituras.
export function observarTransacoes(
  uid: string,
  inicio: Date,
  fim: Date,
  aoReceber: (transacoes: Transacao[]) => void,
  aoFalhar: (erro: unknown) => void,
): () => void {
  return onSnapshot(
    consultaDoPeriodo(uid, inicio, fim),
    (resultado) => aoReceber(resultado.docs.map(paraTransacao)),
    (erro) => aoFalhar(erro),
  );
}

/// Leitura única de um período. Usada pelo histórico, que olha 12 meses de uma
/// vez e não precisa de tempo real.
export async function lerTransacoes(
  uid: string,
  inicio: Date,
  fim: Date,
): Promise<Transacao[]> {
  const resultado = await getDocs(consultaDoPeriodo(uid, inicio, fim));
  return resultado.docs.map(paraTransacao);
}

function paraFirestore(dados: DadosDeTransacao) {
  return {
    descricao: dados.descricao.trim(),
    valor: Math.abs(dados.valor),
    tipo: dados.tipo,
    categoria: dados.categoria,
    data: Timestamp.fromDate(dados.data),
    observacao:
      dados.observacao && dados.observacao.trim().length > 0
        ? dados.observacao.trim()
        : null,
    // Sempre gravado, mesmo nulo. Se ficasse de fora na edição, o `updateDoc`
    // manteria o valor antigo em alguns casos e o apagaria em outros; explícito
    // é mais previsível — e editar um lançamento vindo de recorrência não pode
    // romper o vínculo, senão a ocorrência prevista volta a aparecer.
    recorrenciaId: dados.recorrenciaId ?? null,
    atualizadoEm: serverTimestamp(),
  };
}

export async function criarTransacao(
  uid: string,
  dados: DadosDeTransacao,
): Promise<void> {
  await addDoc(colecaoDeTransacoes(uid), {
    ...paraFirestore(dados),
    // Hora do servidor, não a do computador do usuário.
    criadoEm: serverTimestamp(),
  });
}

/// Cria a ocorrência automática num documento de id estável. Duas abas podem
/// tentar processar o mesmo mês ao mesmo tempo: ambas escrevem no mesmo caminho,
/// portanto nunca surgem dois lançamentos para a mesma recorrência/mês.
export async function criarTransacaoAutomatica(
  uid: string,
  recorrenciaId: string,
  dados: DadosDeTransacao,
): Promise<void> {
  const idSeguro = recorrenciaId.replaceAll('/', '_');
  const id = `automatica-${idSeguro}-${chaveDoMes(dados.data)}`;
  const referencia = doc(bancoDeDados, 'usuarios', uid, 'transacoes', id);

  await runTransaction(bancoDeDados, async (operacao) => {
    const existente = await operacao.get(referencia);
    if (existente.exists()) return;

    operacao.set(referencia, {
      ...paraFirestore(dados),
      criadoEm: serverTimestamp(),
    });
  });
}

export async function atualizarTransacao(
  uid: string,
  id: string,
  dados: DadosDeTransacao,
): Promise<void> {
  await updateDoc(doc(bancoDeDados, 'usuarios', uid, 'transacoes', id), paraFirestore(dados));
}

export async function excluirTransacao(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(bancoDeDados, 'usuarios', uid, 'transacoes', id));
}
