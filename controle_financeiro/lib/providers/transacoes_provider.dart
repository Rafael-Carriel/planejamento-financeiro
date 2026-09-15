import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/resumo_financeiro.dart';
import '../models/transacao.dart';
import '../services/firestore_service.dart';
import '../state/estado_transacoes.dart';

/// Identifica as transações de um mês de um usuário.
///
/// É a chave das famílias abaixo. Duas telas que observarem o mesmo par
/// `uid`/`mes` compartilham a mesma assinatura do Firestore.
typedef MesDoUsuario = ({String uid, DateTime mes});

/// Instância única do serviço de Firestore usada pelos providers.
final firestoreServiceProvider = Provider<FirestoreService>(
  (ref) => FirestoreService(),
);

/// Equivalente Riverpod do antigo `ProvedorDeTransacoesDoMes`.
///
/// Abre **uma** assinatura no Firestore por mês/usuário e a compartilha com
/// quem observar a mesma [MesDoUsuario] - mesma economia de leituras do widget
/// antigo, agora em forma de `StreamProvider`.
///
/// `autoDispose` é essencial: sem ele a assinatura ficaria viva enquanto o app
/// existisse, continuaria lendo do Firestore depois do logout ou da troca de
/// mês. Com `autoDispose`, ela morre junto com a tela.
final transacoesDoMesProvider = StreamProvider.autoDispose
    .family<List<Transacao>, MesDoUsuario>((ref, chave) {
  final firestore = ref.watch(firestoreServiceProvider);
  return firestore.transacoesDoMes(uid: chave.uid, mes: chave.mes);
});

/// Mesmo retrato [EstadoTransacoes] usado pelas telas antigas, agora derivado
/// do [transacoesDoMesProvider]. Preserva o comportamento de carregando/erro
/// para que a migração de uma tela não mude o das outras.
final estadoTransacoesDoMesProvider =
    Provider.autoDispose.family<EstadoTransacoes, MesDoUsuario>((ref, chave) {
  final assincrono = ref.watch(transacoesDoMesProvider(chave));
  return EstadoTransacoes(
    transacoes: assincrono.valueOrNull ?? const <Transacao>[],
    carregando: assincrono.isLoading && !assincrono.hasValue,
    erro: assincrono.hasError
        ? mensagemDeErroDeTransacoes(assincrono.error!)
        : null,
  );
});

/// Resumo (saldo, entradas, saídas) do mês, derivado das transações.
final resumoDoMesProvider =
    Provider.autoDispose.family<ResumoFinanceiro, MesDoUsuario>((ref, chave) {
  final estado = ref.watch(estadoTransacoesDoMesProvider(chave));
  return ResumoFinanceiro.de(estado.transacoes);
});

/// Traduz os erros do Firestore em mensagens para o usuário.
///
/// Mesma lógica do `_mensagemDeErro` que vivia em `estado_transacoes.dart`;
/// fica pública aqui para ser reaproveitada pelos providers.
String mensagemDeErroDeTransacoes(Object erro) {
  final texto = erro.toString();
  if (texto.contains('permission-denied')) {
    return 'Sem permissão para ler estes dados. Confira as regras do Firestore.';
  }
  if (texto.contains('unavailable') || texto.contains('network')) {
    return 'Sem conexão com o servidor. Mostrando o que estiver em cache.';
  }
  return 'Não foi possível carregar as transações.';
}
