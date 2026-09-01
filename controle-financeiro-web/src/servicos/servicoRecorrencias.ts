import {
  Timestamp,
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

import { bancoDeDados } from '../firebase/config';
import { chaveDoMes, inicioDoMes, somarMeses } from '../utilitarios/datas';
import type { DadosDeRecorrencia, Recorrencia, TipoTransacao } from '../tipos';

/// Leitura e escrita de `usuarios/{uid}/recorrencias`.
///
/// Coleção pequena e independente do mês: são os combinados fixos do usuário
/// (salário, aluguel, parcelas), não os lançamentos. Por isso a assinatura fica
/// aberta uma vez só, sem filtro de período — do jeito que já acontece com as
/// categorias.
///
/// A ordenação é por `descricao`, um campo só, então o índice automático do
/// Firestore dá conta e nenhum índice composto precisa ser criado.

export function colecaoDeRecorrencias(uid: string) {
  return collection(bancoDeDados, 'usuarios', uid, 'recorrencias');
}

function paraRecorrencia(documento: QueryDocumentSnapshot<DocumentData>): Recorrencia {
  const dados = documento.data();

  const descricao = typeof dados.descricao === 'string' ? dados.descricao.trim() : '';
  const valorBruto = typeof dados.valor === 'number' ? dados.valor : 0;
  const tipo: TipoTransacao = dados.tipo === 'entrada' ? 'entrada' : 'saida';

  // O dia vem preso entre 1 e 31 mesmo que o banco traga bobagem. Encurtar para
  // o último dia de fevereiro é trabalho da projeção, não da leitura.
  const diaBruto = typeof dados.diaDoMes === 'number' ? Math.trunc(dados.diaDoMes) : 1;
  const diaDoMes = Math.min(31, Math.max(1, diaBruto));

  const inicio =
    dados.inicio instanceof Timestamp ? inicioDoMes(dados.inicio.toDate()) : inicioDoMes(new Date());

  const parcelas =
    typeof dados.parcelas === 'number' && dados.parcelas >= 1
      ? Math.trunc(dados.parcelas)
      : null;

  return {
    id: documento.id,
    descricao: descricao.length > 0 ? descricao : 'Sem descrição',
    valor: Math.abs(valorBruto),
    tipo,
    categoria:
      typeof dados.categoria === 'string' && dados.categoria.length > 0
        ? dados.categoria
        : 'Outros',
    diaDoMes,
    inicio,
    parcelas,
    // Ausente conta como ativa: recorrência gravada por uma versão antiga do app
    // continua valendo.
    ativa: dados.ativa !== false,
    // Documentos antigos não tinham modo: continuam pedindo confirmação para
    // não transformar previsões históricas em lançamentos sem consentimento.
    modoLancamento: dados.modoLancamento === 'automatico' ? 'automatico' : 'confirmar',
    automaticoDesde:
      dados.automaticoDesde instanceof Timestamp
        ? inicioDoMes(dados.automaticoDesde.toDate())
        : null,
    automaticoAte:
      typeof dados.automaticoAte === 'string' && /^\d{4}-\d{2}$/.test(dados.automaticoAte)
        ? dados.automaticoAte
        : null,
    observacao:
      typeof dados.observacao === 'string' && dados.observacao.trim().length > 0
        ? dados.observacao.trim()
        : null,
    criadoEm: dados.criadoEm instanceof Timestamp ? dados.criadoEm.toDate() : null,
  };
}

export function observarRecorrencias(
  uid: string,
  aoReceber: (recorrencias: Recorrencia[]) => void,
  aoFalhar: (erro: unknown) => void,
): () => void {
  return onSnapshot(
    query(colecaoDeRecorrencias(uid), orderBy('descricao')),
    (resultado) => aoReceber(resultado.docs.map(paraRecorrencia)),
    (erro) => aoFalhar(erro),
  );
}

function paraFirestore(dados: DadosDeRecorrencia) {
  return {
    descricao: dados.descricao.trim(),
    valor: Math.abs(dados.valor),
    tipo: dados.tipo,
    categoria: dados.categoria,
    diaDoMes: Math.min(31, Math.max(1, Math.trunc(dados.diaDoMes))),
    // Guardado no dia 1º: a série é contada em meses, e o dia da cobrança mora
    // em `diaDoMes`. Duas fontes para a mesma informação daria conflito.
    inicio: Timestamp.fromDate(inicioDoMes(dados.inicio)),
    parcelas:
      dados.parcelas !== null && dados.parcelas >= 1 ? Math.trunc(dados.parcelas) : null,
    ativa: dados.ativa,
    modoLancamento: dados.modoLancamento,
    observacao:
      dados.observacao && dados.observacao.trim().length > 0
        ? dados.observacao.trim()
        : null,
    atualizadoEm: serverTimestamp(),
  };
}

export async function criarRecorrencia(
  uid: string,
  dados: DadosDeRecorrencia,
): Promise<string> {
  const agora = inicioDoMes(new Date());
  const automatica = dados.modoLancamento === 'automatico';
  const criado = await addDoc(colecaoDeRecorrencias(uid), {
    ...paraFirestore(dados),
    automaticoDesde: automatica ? Timestamp.fromDate(agora) : null,
    automaticoAte: automatica ? chaveDoMes(somarMeses(agora, -1)) : null,
    criadoEm: serverTimestamp(),
  });
  return criado.id;
}

export async function atualizarRecorrencia(
  uid: string,
  id: string,
  dados: DadosDeRecorrencia,
  anterior: Recorrencia | null,
): Promise<void> {
  const agora = inicioDoMes(new Date());
  const continuouAutomatica =
    dados.modoLancamento === 'automatico' &&
    anterior?.modoLancamento === 'automatico';
  await updateDoc(
    doc(bancoDeDados, 'usuarios', uid, 'recorrencias', id),
    {
      ...paraFirestore(dados),
      automaticoDesde:
        dados.modoLancamento === 'automatico'
          ? Timestamp.fromDate(
              continuouAutomatica && anterior?.automaticoDesde
                ? anterior.automaticoDesde
                : agora,
            )
          : null,
      automaticoAte:
        dados.modoLancamento === 'automatico'
          ? continuouAutomatica
            ? anterior?.automaticoAte ?? chaveDoMes(somarMeses(agora, -1))
            : chaveDoMes(somarMeses(agora, -1))
          : null,
    },
  );
}

/// Pausa ou retoma a recorrência sem mexer no resto do documento.
export async function definirRecorrenciaAtiva(
  uid: string,
  id: string,
  ativa: boolean,
  automatica: boolean,
): Promise<void> {
  const agora = inicioDoMes(new Date());
  await updateDoc(doc(bancoDeDados, 'usuarios', uid, 'recorrencias', id), {
    ativa,
    ...(automatica
      ? {
          // Ao pausar, o mês atual fica encerrado. Ao retomar, só o mês atual
          // volta a ser elegível; meses inteiros durante a pausa são ignorados.
          automaticoAte: chaveDoMes(ativa ? somarMeses(agora, -1) : agora),
        }
      : {}),
    atualizadoEm: serverTimestamp(),
  });
}

export async function marcarRecorrenciaAutomaticaProcessada(
  uid: string,
  id: string,
  mes: Date,
): Promise<void> {
  await updateDoc(doc(bancoDeDados, 'usuarios', uid, 'recorrencias', id), {
    automaticoAte: chaveDoMes(mes),
    atualizadoEm: serverTimestamp(),
  });
}

/// Apaga a recorrência.
///
/// Os lançamentos que já saíram dela ficam onde estão, de propósito: eles são
/// dinheiro que se mexeu de verdade. O `recorrenciaId` deles passa a apontar
/// para nada, e nada além da lista de previstos usa esse vínculo.
export async function excluirRecorrencia(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(bancoDeDados, 'usuarios', uid, 'recorrencias', id));
}
