import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/categorias.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/resumo_financeiro.dart';
import '../../models/transacao.dart';
import '../../state/estado_transacoes.dart';
import '../../widgets/estado_vazio.dart';

/// Para onde o dinheiro foi (ou de onde veio) no mês selecionado.
class RelatoriosScreen extends StatefulWidget {
  const RelatoriosScreen({super.key});

  @override
  State<RelatoriosScreen> createState() => _RelatoriosScreenState();
}

class _RelatoriosScreenState extends State<RelatoriosScreen> {
  TipoTransacao _tipo = TipoTransacao.saida;

  @override
  Widget build(BuildContext context) {
    final estado = context.watch<EstadoTransacoes>();

    if (estado.carregando) {
      return const Center(child: CircularProgressIndicator());
    }
    if (estado.erro != null) {
      return EstadoVazio(
        icone: Icons.cloud_off_outlined,
        titulo: 'Não deu para carregar',
        mensagem: estado.erro!,
      );
    }

    final entrada = _tipo == TipoTransacao.entrada;
    final selecionadas = entrada ? estado.entradas : estado.saidas;
    final totais = TotalPorCategoria.agrupar(selecionadas);
    final total = totais.fold<double>(0.0, (soma, item) => soma + item.total);
    final cor = entrada ? AppCores.entrada : AppCores.saida;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
      children: <Widget>[
        SegmentedButton<TipoTransacao>(
          segments: const <ButtonSegment<TipoTransacao>>[
            ButtonSegment<TipoTransacao>(
              value: TipoTransacao.saida,
              label: Text('Saídas'),
            ),
            ButtonSegment<TipoTransacao>(
              value: TipoTransacao.entrada,
              label: Text('Entradas'),
            ),
          ],
          selected: <TipoTransacao>{_tipo},
          onSelectionChanged: (selecao) =>
              setState(() => _tipo = selecao.first),
        ),
        const SizedBox(height: 20),
        if (totais.isEmpty)
          EstadoVazio(
            icone: Icons.query_stats_outlined,
            titulo: entrada ? 'Sem entradas no mês' : 'Sem saídas no mês',
            mensagem: 'Registre lançamentos para ver a divisão por categoria.',
          )
        else ...<Widget>[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    entrada ? 'Total recebido' : 'Total gasto',
                    style: TextStyle(
                      fontSize: 13,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatarMoeda(total),
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      color: cor,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Em ${totais.length} '
                    '${totais.length == 1 ? 'categoria' : 'categorias'}.',
                    style: TextStyle(
                      fontSize: 13,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 10),
            child: Text(
              'Por categoria',
              style: Theme.of(context)
                  .textTheme
                  .titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Column(
                children: <Widget>[
                  for (final item in totais)
                    _LinhaCategoria(
                      item: item,
                      proporcao: total <= 0 ? 0.0 : item.total / total,
                      cor: cor,
                    ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Uma categoria com barra proporcional ao peso dela no total.
class _LinhaCategoria extends StatelessWidget {
  const _LinhaCategoria({
    required this.item,
    required this.proporcao,
    required this.cor,
  });

  final TotalPorCategoria item;
  final double proporcao;
  final Color cor;

  @override
  Widget build(BuildContext context) {
    final cores = Theme.of(context).colorScheme;
    final percentual = (proporcao * 100).toStringAsFixed(proporcao >= 0.1 ? 0 : 1);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(Categorias.icone(item.categoria), size: 18, color: cor),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  item.categoria,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14.5,
                  ),
                ),
              ),
              Text(
                formatarMoeda(item.total),
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: proporcao.clamp(0.0, 1.0).toDouble(),
              minHeight: 7,
              backgroundColor: cores.surfaceContainerHighest,
              valueColor: AlwaysStoppedAnimation<Color>(cor),
            ),
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              '$percentual% do total · ${item.quantidade} '
              '${item.quantidade == 1 ? 'lançamento' : 'lançamentos'}',
              style: TextStyle(fontSize: 12, color: cores.onSurfaceVariant),
            ),
          ),
        ],
      ),
    );
  }
}
