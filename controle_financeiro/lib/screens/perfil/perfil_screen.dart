import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/auth_service.dart';
import '../../services/notificacoes_service.dart';

/// Dados da conta, notificações e saída do app.
class PerfilScreen extends StatelessWidget {
  const PerfilScreen({
    required this.uid,
    required this.nome,
    required this.email,
    super.key,
  });

  final String uid;
  final String nome;
  final String email;

  Future<void> _sair(BuildContext context) async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('Sair da conta?'),
        content: const Text(
          'Seus lançamentos continuam salvos e voltam quando você entrar de novo.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(contexto).pop(true),
            child: const Text('Sair'),
          ),
        ],
      ),
    );
    if (confirmado != true || !context.mounted) return;

    // Solta o token deste aparelho antes do logout para não receber push de
    // uma conta que não está mais logada aqui.
    await context.read<NotificacoesService>().desvincularDispositivo(uid: uid);
    if (!context.mounted) return;
    await context.read<AuthService>().sair();
    // O AuthGate percebe a mudança e volta para o login.
  }

  @override
  Widget build(BuildContext context) {
    final cores = Theme.of(context).colorScheme;
    final inicial = nome.trim().isEmpty ? '?' : nome.trim()[0].toUpperCase();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: <Widget>[
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: <Widget>[
                CircleAvatar(
                  radius: 28,
                  backgroundColor: cores.primaryContainer,
                  child: Text(
                    inicial,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: cores.onPrimaryContainer,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        nome,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        email,
                        style: TextStyle(
                          fontSize: 13.5,
                          color: cores.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        Card(
          child: Column(
            children: <Widget>[
              ListTile(
                leading: const Icon(Icons.notifications_active_outlined),
                title: const Text('Notificações'),
                subtitle: const Text(
                  'Este aparelho está registrado para receber avisos do app.',
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.lock_outline),
                title: const Text('Seus dados'),
                subtitle: const Text(
                  'Os lançamentos ficam na sua conta e só você tem acesso.',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: () => _sair(context),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            foregroundColor: cores.error,
            side: BorderSide(color: cores.error.withValues(alpha: 0.5)),
          ),
          icon: const Icon(Icons.logout),
          label: const Text('Sair da conta'),
        ),
        const SizedBox(height: 24),
        Center(
          child: Text(
            'Controle Financeiro · versão 1.0.0',
            style: TextStyle(fontSize: 12, color: cores.outline),
          ),
        ),
      ],
    );
  }
}
