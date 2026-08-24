import {
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { bancoDeDados } from '../firebase/config';
import type { Orcamento } from '../tipos';

/// Planejamento mensal, em `usuarios/{uid}/orcamentos/{aaaa-mm}`.
///
/// O id do documento é a própria chave do mês, então não há como existirem dois
/// planejamentos do mesmo mês. Os limites ficam num mapa
/// `{ 'Mercado': 800, 'Transporte': 300 }` dentro do documento: são poucos por
/// mês e sempre lidos juntos, então um documento por mês vale mais que uma
/// subcoleção com uma leitura por categoria.

export function documentoDeOrcamento(uid: string, chaveDoMes: string) {
  return doc(bancoDeDados, 'usuarios', uid, 'orcamentos', chaveDoMes);
}

function paraLimites(valor: unknown): Record<string, number> {
  if (typeof valor !== 'object' || valor === null) return {};

  const limites: Record<string, number> = {};
  for (const [categoria, limite] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof limite === 'number' && Number.isFinite(limite) && limite > 0) {
      limites[categoria] = limite;
    }
  }
  return limites;
}

export function observarOrcamento(
  uid: string,
  chaveDoMes: string,
  aoReceber: (orcamento: Orcamento) => void,
  aoFalhar: (erro: unknown) => void,
): () => void {
  return onSnapshot(
    documentoDeOrcamento(uid, chaveDoMes),
    (documento) => {
      const dados = documento.data();
      aoReceber({
        mes: chaveDoMes,
        limites: paraLimites(dados?.limites),
        atualizadoEm:
          dados?.atualizadoEm instanceof Timestamp ? dados.atualizadoEm.toDate() : null,
      });
    },
    (erro) => aoFalhar(erro),
  );
}

export async function lerOrcamento(
  uid: string,
  chaveDoMes: string,
): Promise<Orcamento> {
  const documento = await getDoc(documentoDeOrcamento(uid, chaveDoMes));
  const dados = documento.data();

  return {
    mes: chaveDoMes,
    limites: paraLimites(dados?.limites),
    atualizadoEm:
      dados?.atualizadoEm instanceof Timestamp ? dados.atualizadoEm.toDate() : null,
  };
}

/// Grava o mapa de limites inteiro.
///
/// Salvar o mapa completo (em vez de um campo `limites.Mercado`) é o que permite
/// **remover** um limite: `updateDoc` substitui o mapa por inteiro, enquanto uma
/// escrita com merge só acrescentaria chaves e a categoria apagada voltaria.
export async function salvarLimites(
  uid: string,
  chaveDoMes: string,
  limites: Record<string, number>,
): Promise<void> {
  const referencia = documentoDeOrcamento(uid, chaveDoMes);
  const existente = await getDoc(referencia);

  const limpos: Record<string, number> = {};
  for (const [categoria, limite] of Object.entries(limites)) {
    if (Number.isFinite(limite) && limite > 0) {
      limpos[categoria] = Math.round(limite * 100) / 100;
    }
  }

  if (existente.exists()) {
    await updateDoc(referencia, {
      limites: limpos,
      atualizadoEm: serverTimestamp(),
    });
    return;
  }

  await setDoc(referencia, {
    mes: chaveDoMes,
    limites: limpos,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}
