import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/mes_selecionado.dart';

/// Navegação entre meses, usada como `bottom` da AppBar.
class SeletorMes extends StatelessWidget implements PreferredSizeWidget {
  const SeletorMes({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(52);

  @override
  Widget build(BuildContext context) {
    final mes = context.watch<MesSelecionado>();
    final cores = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
      child: Row(
        children: <Widget>[
          IconButton(
            onPressed: mes.anterior,
            icon: const Icon(Icons.chevron_left),
            tooltip: 'Mês anterior',
          ),
          Expanded(
            child: Center(
              child: Text(
                mes.rotulo,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: cores.onSurface,
                ),
              ),
            ),
          ),
          if (!mes.isMesAtual)
            TextButton(
              onPressed: mes.voltarParaMesAtual,
              child: const Text('Hoje'),
            ),
          IconButton(
            onPressed: mes.proximo,
            icon: const Icon(Icons.chevron_right),
            tooltip: 'Mês seguinte',
          ),
        ],
      ),
    );
  }
}
