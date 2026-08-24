import 'package:flutter/material.dart';

import '../core/categorias.dart';
import '../core/formatters.dart';
import '../core/theme.dart';
import '../models/transacao.dart';

/// Linha da lista de lançamentos.
class ItemTransacao extends StatelessWidget {
  const ItemTransacao({
    required this.transacao,
    this.onTap,
    this.mostrarData = true,
    super.key,
  });

  final Transacao transacao;
  final VoidCallback? onTap;
  final bool mostrarData;

  @override
  Widget build(BuildContext context) {
    final cores = Theme.of(context).colorScheme;
    final entrada = transacao.isEntrada;
    final cor = entrada ? AppCores.entrada : AppCores.saida;

    final legenda = <String>[
      transacao.categoria,
      if (mostrarData) formatarData(transacao.data),
    ].join(' · ');

    return ListTile(
      onTap: onTap,
      leading: Container(
        height: 42,
        width: 42,
        decoration: BoxDecoration(
          color: entrada ? AppCores.entradaSuave : AppCores.saidaSuave,
          borderRadius: BorderRadius.circular(13),
        ),
        child: Icon(Categorias.icone(transacao.categoria), size: 21, color: cor),
      ),
      title: Text(
        transacao.descricao,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        legenda,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontSize: 12.5, color: cores.onSurfaceVariant),
      ),
      trailing: Text(
        '${entrada ? '+' : '-'} ${formatarMoeda(transacao.valor)}',
        style: TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 15,
          color: cor,
        ),
      ),
    );
  }
}
