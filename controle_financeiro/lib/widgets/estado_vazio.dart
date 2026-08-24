import 'package:flutter/material.dart';

/// Placeholder amigável para listas sem conteúdo (ou com erro).
class EstadoVazio extends StatelessWidget {
  const EstadoVazio({
    required this.icone,
    required this.titulo,
    required this.mensagem,
    this.acao,
    super.key,
  });

  final IconData icone;
  final String titulo;
  final String mensagem;
  final Widget? acao;

  @override
  Widget build(BuildContext context) {
    final cores = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Icon(icone, size: 56, color: cores.outline),
          const SizedBox(height: 16),
          Text(
            titulo,
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            mensagem,
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: cores.onSurfaceVariant),
          ),
          if (acao != null) ...<Widget>[
            const SizedBox(height: 20),
            acao!,
          ],
        ],
      ),
    );
  }
}
