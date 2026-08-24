import 'transacao.dart';

/// Totais consolidados de um período.
class ResumoFinanceiro {
  const ResumoFinanceiro({
    required this.entradas,
    required this.saidas,
    required this.quantidade,
  });

  final double entradas;
  final double saidas;
  final int quantidade;

  static const ResumoFinanceiro vazio =
      ResumoFinanceiro(entradas: 0.0, saidas: 0.0, quantidade: 0);

  double get saldo => entradas - saidas;
  bool get positivo => saldo >= 0;

  /// Percentual da renda que foi gasto (0.0 a 1.0+). Zero se não houve entrada.
  double get percentualGasto => entradas <= 0 ? 0.0 : saidas / entradas;

  factory ResumoFinanceiro.de(Iterable<Transacao> transacoes) {
    var entradas = 0.0;
    var saidas = 0.0;
    var quantidade = 0;
    for (final transacao in transacoes) {
      quantidade++;
      if (transacao.isEntrada) {
        entradas += transacao.valor;
      } else {
        saidas += transacao.valor;
      }
    }
    return ResumoFinanceiro(
      entradas: entradas,
      saidas: saidas,
      quantidade: quantidade,
    );
  }
}

/// Total de uma categoria dentro do período - usado na tela de relatórios.
class TotalPorCategoria {
  const TotalPorCategoria({
    required this.categoria,
    required this.total,
    required this.quantidade,
  });

  final String categoria;
  final double total;
  final int quantidade;

  /// Agrupa e ordena do maior para o menor total.
  static List<TotalPorCategoria> agrupar(Iterable<Transacao> transacoes) {
    final totais = <String, ({double total, int quantidade})>{};
    for (final transacao in transacoes) {
      final atual = totais[transacao.categoria];
      totais[transacao.categoria] = (
        total: (atual?.total ?? 0) + transacao.valor,
        quantidade: (atual?.quantidade ?? 0) + 1,
      );
    }

    final lista = totais.entries
        .map(
          (entrada) => TotalPorCategoria(
            categoria: entrada.key,
            total: entrada.value.total,
            quantidade: entrada.value.quantidade,
          ),
        )
        .toList()
      ..sort((a, b) => b.total.compareTo(a.total));
    return lista;
  }
}
