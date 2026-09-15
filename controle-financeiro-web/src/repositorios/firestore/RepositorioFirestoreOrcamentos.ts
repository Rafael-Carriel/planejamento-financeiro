import {
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { bancoDeDados } from '../../firebase/config';
import type { Orcamento } from '../../tipos';
import type { IRepositorioOrcamentos } from '../interfaces';

/// Implementação Firestore de `usuarios/{uid}/orcamentos/{aaaa-mm}`.
///
/// O id do documento é a própria chave do mês, então não há como existirem dois
/// planejamentos do mesmo mês. Os limites ficam num mapa
/// `{ 'Mercado': 800, 'Transporte': 300 }` dentro do documento: são poucos por
/// mês e sempre lidos juntos, então um documento por mês vale mais que uma
/// subcoleção com uma leitura por categoria.

function documentoDeOrcamento(uid: string, chaveDoMes: string) {
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

function paraOrcamento(
  chaveDoMes: string,
  dados: { limites?: unknown; atualizadoEm?: unknown } | undefined,
): Orcamento {
  return {
    mes: chaveDoMes,
    limites: paraLimites(dados?.limites),
    atualizadoEm:
      dados?.atualizadoEm instanceof Timestamp ? dados.atualizadoEm.toDate() : null,
  };
}

export class RepositorioFirestoreOrcamentos implements IRepositorioOrcamentos {
  observar(
    uid: string,
    chaveDoMes: string,
    aoReceber: (orcamento: Orcamento) => void,
    aoFalhar: (erro: unknown) => void,
  ): () => void {
    return onSnapshot(
      documentoDeOrcamento(uid, chaveDoMes),
      (documento) => aoReceber(paraOrcamento(chaveDoMes, documento.data())),
      (erro) => aoFalhar(erro),
    );
  }

  async ler(uid: string, chaveDoMes: string): Promise<Orcamento> {
    const documento = await getDoc(documentoDeOrcamento(uid, chaveDoMes));
    return paraOrcamento(chaveDoMes, documento.data());
  }

  /// Grava o mapa de limites inteiro.
  ///
  /// Salvar o mapa completo (em vez de um campo `limites.Mercado`) é o que
  /// permite **remover** um limite: `setDoc` substitui o mapa por inteiro,
  /// enquanto uma escrita com merge só acrescentaria chaves e a categoria
  /// apagada voltaria. A transação evita corrida entre abas/janelas.
  async salvar(
    uid: string,
    chaveDoMes: string,
    limites: Record<string, number>,
  ): Promise<void> {
    const referencia = documentoDeOrcamento(uid, chaveDoMes);

    const limpos: Record<string, number> = {};
    for (const [categoria, limite] of Object.entries(limites)) {
      if (Number.isFinite(limite) && limite > 0) {
        limpos[categoria] = Math.round(limite * 100) / 100;
      }
    }

    // Transação garante atomicidade: lê + escreve sem interferência de outras abas.
    await runTransaction(bancoDeDados, async (operacao) => {
      const existente = await operacao.get(referencia);

      if (existente.exists()) {
        operacao.update(referencia, {
          limites: limpos,
          atualizadoEm: serverTimestamp(),
        });
      } else {
        operacao.set(referencia, {
          mes: chaveDoMes,
          limites: limpos,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        });
      }
    });
  }
}

export const repositorioOrcamentosFirestore = new RepositorioFirestoreOrcamentos();
