// Testes das regras que não dependem do Firebase: leitura de valores digitados
// e consolidação dos totais. Rode com `flutter test`.
import 'package:controle_financeiro/core/formatters.dart';
import 'package:controle_financeiro/models/resumo_financeiro.dart';
import 'package:controle_financeiro/models/transacao.dart';
import 'package:flutter_test/flutter_test.dart';

Transacao _transacao({
  required double valor,
  required TipoTransacao tipo,
  String categoria = 'Outros',
  int dia = 10,
}) {
  return Transacao(
    id: 'id-$valor-$dia',
    descricao: 'Teste',
    valor: valor,
    tipo: tipo,
    categoria: categoria,
    data: DateTime(2026, 8, dia),
  );
}

void main() {
  group('parseValor', () {
    test('aceita o formato brasileiro com milhar e decimal', () {
      expect(parseValor('1.234,56'), 1234.56);
      expect(parseValor('R\$ 89,90'), 89.90);
      expect(parseValor('1234,5'), 1234.5);
    });

    test('aceita ponto como decimal quando não há vírgula', () {
      expect(parseValor('1234.56'), 1234.56);
      expect(parseValor('50'), 50);
    });

    test('trata vários pontos como separador de milhar', () {
      expect(parseValor('1.234.567'), 1234567);
    });

    test('recusa vazio, zero e negativo', () {
      expect(parseValor(''), isNull);
      expect(parseValor('abc'), isNull);
      expect(parseValor('0'), isNull);
      expect(parseValor('-10'), isNull);
    });
  });

  group('ResumoFinanceiro', () {
    test('separa entradas de saídas e calcula o saldo', () {
      final resumo = ResumoFinanceiro.de(<Transacao>[
        _transacao(valor: 5000, tipo: TipoTransacao.entrada),
        _transacao(valor: 1200, tipo: TipoTransacao.saida),
        _transacao(valor: 300.50, tipo: TipoTransacao.saida),
      ]);

      expect(resumo.entradas, 5000);
      expect(resumo.saidas, 1500.50);
      expect(resumo.saldo, 3499.50);
      expect(resumo.quantidade, 3);
      expect(resumo.positivo, isTrue);
    });

    test('saldo fica negativo quando as saídas passam as entradas', () {
      final resumo = ResumoFinanceiro.de(<Transacao>[
        _transacao(valor: 100, tipo: TipoTransacao.entrada),
        _transacao(valor: 250, tipo: TipoTransacao.saida),
      ]);

      expect(resumo.saldo, -150);
      expect(resumo.positivo, isFalse);
    });

    test('lista vazia resulta em tudo zerado', () {
      final resumo = ResumoFinanceiro.de(const <Transacao>[]);
      expect(resumo.saldo, 0);
      expect(resumo.percentualGasto, 0);
    });
  });

  group('TotalPorCategoria', () {
    test('agrupa por categoria e ordena do maior para o menor', () {
      final totais = TotalPorCategoria.agrupar(<Transacao>[
        _transacao(valor: 200, tipo: TipoTransacao.saida, categoria: 'Mercado'),
        _transacao(valor: 150, tipo: TipoTransacao.saida, categoria: 'Lazer'),
        _transacao(valor: 300, tipo: TipoTransacao.saida, categoria: 'Mercado'),
      ]);

      expect(totais.length, 2);
      expect(totais.first.categoria, 'Mercado');
      expect(totais.first.total, 500);
      expect(totais.first.quantidade, 2);
      expect(totais.last.categoria, 'Lazer');
    });
  });

  group('Transacao', () {
    test('o sinal vem do tipo, nunca de um valor negativo', () {
      expect(_transacao(valor: 80, tipo: TipoTransacao.entrada).valorComSinal, 80);
      expect(_transacao(valor: 80, tipo: TipoTransacao.saida).valorComSinal, -80);
    });

    test('o código gravado no Firestore não muda', () {
      expect(TipoTransacao.entrada.codigo, 'entrada');
      expect(TipoTransacao.saida.codigo, 'saida');
      expect(TipoTransacao.doCodigo('entrada'), TipoTransacao.entrada);
      expect(TipoTransacao.doCodigo(null), TipoTransacao.saida);
    });
  });

  group('períodos', () {
    test('inicioDoMes e inicioDoMesSeguinte delimitam a consulta', () {
      final base = DateTime(2026, 12, 17, 22, 41);
      expect(inicioDoMes(base), DateTime(2026, 12));
      expect(inicioDoMesSeguinte(base), DateTime(2027));
    });
  });
}
