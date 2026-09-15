import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'transacoes_provider.dart';

/// Limites de gasto por categoria em um mês.
///
/// Segue o mesmo modelo do app web (`usuarios/{uid}/orcamentos/{aaaa-mm}`,
/// com um mapa de limites), mas ainda em memória: enquanto a migração não
/// chega ao Firestore, este provider serve de base para a tela de planejamento
/// sem alterar nenhuma regra de gravação existente.
class Orcamento {
  const Orcamento({this.limites = const <String, double>{}});

  final Map<String, double> limites;

  bool get vazio => limites.isEmpty;

  double? limiteDe(String categoria) => limites[categoria];

  Orcamento definirLimite(String categoria, double valor) {
    return Orcamento(
      limites: <String, double>{...limites, categoria: valor},
    );
  }

  Orcamento removerLimite(String categoria) {
    final copia = <String, double>{...limites}..remove(categoria);
    return Orcamento(limites: copia);
  }
}

/// Guarda e edita o orçamento do mês informado.
class OrcamentoNotifier extends FamilyNotifier<Orcamento, DateTime> {
  @override
  Orcamento build(DateTime arg) => const Orcamento();

  /// Define o limite de uma categoria. Valor menor ou igual a zero remove o
  /// limite, o que evita um orçamento "zerado" que sempre aparece excedido.
  void definirLimite(String categoria, double valor) {
    if (valor <= 0) {
      removerLimite(categoria);
      return;
    }
    state = state.definirLimite(categoria, valor);
  }

  void removerLimite(String categoria) {
    state = state.removerLimite(categoria);
  }

  void limpar() {
    state = const Orcamento();
  }
}

/// Orçamento de um mês, identificado pelo primeiro dia do mês.
final orcamentoDoMesProvider =
    NotifierProvider.family<OrcamentoNotifier, Orcamento, DateTime>(
  OrcamentoNotifier.new,
);

/// Compara o gasto real de uma categoria com o limite definido.
class ProgressoOrcamento {
  const ProgressoOrcamento({
    required this.categoria,
    required this.gasto,
    this.limite,
  });

  final String categoria;
  final double gasto;
  final double? limite;

  bool get temLimite => limite != null;

  double get restante => (limite ?? 0) - gasto;

  bool get excedido => limite != null && gasto > limite!;

  /// Fração consumida do limite (pode passar de 1.0); zero sem limite definido.
  double get proporcao =>
      (limite == null || limite! <= 0) ? 0.0 : gasto / limite!;
}

/// Cruza os limites do mês com as saídas reais, por categoria.
final progressoDoOrcamentoProvider = Provider.autoDispose
    .family<List<ProgressoOrcamento>, MesDoUsuario>((ref, chave) {
  final orcamento = ref.watch(orcamentoDoMesProvider(chave.mes));
  final estado = ref.watch(estadoTransacoesDoMesProvider(chave));

  final gastos = <String, double>{};
  for (final transacao in estado.saidas) {
    gastos.update(
      transacao.categoria,
      (atual) => atual + transacao.valor,
      ifAbsent: () => transacao.valor,
    );
  }

  final categorias = <String>{...orcamento.limites.keys, ...gastos.keys};
  final resultado = categorias.map((categoria) {
    return ProgressoOrcamento(
      categoria: categoria,
      gasto: gastos[categoria] ?? 0,
      limite: orcamento.limiteDe(categoria),
    );
  }).toList()
    ..sort((a, b) => b.gasto.compareTo(a.gasto));

  return resultado;
});
