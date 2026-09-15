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

/// Leitura e escrita de `usuarios/{uid}/lembretes`.
///
/// Lembrete é um aviso pontual para o usuário: conta recorrente que venceu,
/// dívida atrasada, orçamento estourado. Não gera lançamento nem entra no
/// planejamento — é apenas uma fila de avisos, esvaziada ao marcar como lido
/// ou excluir.

/// O que gerou o lembrete.
///
/// Os valores são gravados no Firestore e validados pelas regras de segurança
/// — não traduzir nem acentuar.
export type TipoLembrete = 'recorrencia' | 'divida' | 'orcamento' | 'sistema';

/// Um aviso para o usuário, em `usuarios/{uid}/lembretes`.
///
/// `lido` é o que alimenta o contador do sino: enquanto houver lembrete com
/// `lido === false`, o botão na barra superior mostra quantos são.
export interface Lembrete {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoLembrete;
  data: Date;
  lido: boolean;
  criadoEm: Date | null;
}

/// O que é preciso para criar um lembrete. Sem `id`: quem cria ainda não tem
/// um. `lido` não entra de propósito — lembrete novo nasce não lido.
export interface DadosDoLembrete {
  titulo: string;
  descricao: string | null;
  tipo: TipoLembrete;
  data: Date;
}

export function colecaoDeLembretes(uid: string) {
  return collection(bancoDeDados, 'usuarios', uid, 'lembretes');
}

const TIPOS: readonly TipoLembrete[] = ['recorrencia', 'divida', 'orcamento', 'sistema'];

function paraLembrete(documento: QueryDocumentSnapshot<DocumentData>): Lembrete {
  const dados = documento.data();

  const titulo = typeof dados.titulo === 'string' ? dados.titulo.trim() : '';
  const descricao =
    typeof dados.descricao === 'string' && dados.descricao.trim().length > 0
      ? dados.descricao.trim()
      : null;
  const tipo: TipoLembrete = TIPOS.includes(dados.tipo) ? dados.tipo : 'sistema';
  const data = dados.data instanceof Timestamp ? dados.data.toDate() : new Date();

  return {
    id: documento.id,
    titulo: titulo.length > 0 ? titulo : 'Sem título',
    descricao,
    tipo,
    data,
    lido: dados.lido === true,
    criadoEm: dados.criadoEm instanceof Timestamp ? dados.criadoEm.toDate() : null,
  };
}

function consultaDeLembretes(uid: string) {
  return query(colecaoDeLembretes(uid), orderBy('criadoEm', 'desc'));
}

/// Acompanha em tempo real os lembretes do usuário.
///
/// Devolve a função que encerra a assinatura — chame no fim do efeito, senão a
/// escuta continua ativa e o app segue pagando leituras.
export function observarLembretes(
  uid: string,
  aoReceber: (lembretes: Lembrete[]) => void,
  aoFalhar: (erro: unknown) => void,
): () => void {
  return onSnapshot(
    consultaDeLembretes(uid),
    (resultado) => aoReceber(resultado.docs.map(paraLembrete)),
    (erro) => aoFalhar(erro),
  );
}

/// Leitura única de todos os lembretes. Para quem não precisa de tempo real.
export async function lerLembretes(uid: string): Promise<Lembrete[]> {
  const resultado = await getDocs(consultaDeLembretes(uid));
  return resultado.docs.map(paraLembrete);
}

function paraFirestore(dados: DadosDoLembrete) {
  return {
    titulo: dados.titulo.trim(),
    descricao:
      dados.descricao && dados.descricao.trim().length > 0
        ? dados.descricao.trim()
        : null,
    tipo: dados.tipo,
    data: Timestamp.fromDate(dados.data),
    // Sempre gravado, mesmo falso. Se ficasse de fora na criação, o contador
    // do sino não teria como distinguir "não lido" de "campo ausente".
    lido: false,
    atualizadoEm: serverTimestamp(),
  };
}

export async function criarLembrete(
  uid: string,
  dados: DadosDoLembrete,
): Promise<void> {
  await addDoc(colecaoDeLembretes(uid), {
    ...paraFirestore(dados),
    // Hora do servidor, não a do computador do usuário.
    criadoEm: serverTimestamp(),
  });
}

export async function marcarComoLido(uid: string, id: string): Promise<void> {
  await updateDoc(doc(bancoDeDados, 'usuarios', uid, 'lembretes', id), {
    lido: true,
    atualizadoEm: serverTimestamp(),
  });
}

export async function excluirLembrete(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(bancoDeDados, 'usuarios', uid, 'lembretes', id));
}
