import 'package:flutter/material.dart';

import '../core/formatters.dart';
import '../core/theme.dart';
import '../models/resumo_financeiro.dart';

/// Cartão principal do dashboard: saldo do mês e os dois totais.
class CartaoResumo extends StatelessWidget {
  const CartaoResumo({required this.resumo, super.key});

  final ResumoFinanceiro resumo;

  @override
  Widget build(BuildContext context) {
    final cores = Theme.of(context).colorScheme;
    final positivo = resumo.positivo;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'Saldo do mês',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
                color: cores.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: <Widget>[
                Expanded(
                  child: Text(
                    formatarMoeda(resumo.saldo),
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                      color: positivo ? AppCores.entrada : AppCores.saida,
                    ),
                  ),
                ),
                Icon(
                  positivo ? Icons.trending_up : Icons.trending_down,
                  color: positivo ? AppCores.entrada : AppCores.saida,
                  size: 28,
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              positivo
                  ? 'Você fechou o mês no positivo até agora.'
                  : 'Suas saídas passaram as entradas neste mês.',
              style: TextStyle(fontSize: 13, color: cores.onSurfaceVariant),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Divider(),
            ),
            Row(
              children: <Widget>[
                Expanded(
                  child: _Total(
                    rotulo: 'Entradas',
                    valor: resumo.entradas,
                    cor: AppCores.entrada,
                    fundo: AppCores.entradaSuave,
                    icone: Icons.arrow_downward,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _Total(
                    rotulo: 'Saídas',
                    valor: resumo.saidas,
                    cor: AppCores.saida,
                    fundo: AppCores.saidaSuave,
                    icone: Icons.arrow_upward,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Total extends StatelessWidget {
  const _Total({
    required this.rotulo,
    required this.valor,
    required this.cor,
    required this.fundo,
    required this.icone,
  });

  final String rotulo;
  final double valor;
  final Color cor;
  final Color fundo;
  final IconData icone;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Container(
          height: 38,
          width: 38,
          decoration: BoxDecoration(
            color: fundo,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icone, size: 20, color: cor),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                rotulo,
                style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 2),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  formatarMoeda(valor),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
