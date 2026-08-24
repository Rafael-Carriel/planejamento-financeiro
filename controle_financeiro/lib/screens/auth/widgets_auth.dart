import 'package:flutter/material.dart';

/// Cabeçalho com identidade visual usado no login e no cadastro.
class MarcaDoApp extends StatelessWidget {
  const MarcaDoApp({required this.subtitulo, super.key});

  final String subtitulo;

  @override
  Widget build(BuildContext context) {
    final cores = Theme.of(context).colorScheme;
    return Column(
      children: <Widget>[
        Container(
          height: 72,
          width: 72,
          decoration: BoxDecoration(
            color: cores.primaryContainer,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Icon(
            Icons.account_balance_wallet_outlined,
            size: 36,
            color: cores.onPrimaryContainer,
          ),
        ),
        const SizedBox(height: 20),
        Text(
          'Controle Financeiro',
          textAlign: TextAlign.center,
          style: Theme.of(context)
              .textTheme
              .headlineSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Text(
          subtitulo,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: cores.onSurfaceVariant,
              ),
        ),
      ],
    );
  }
}

/// Spinner no tamanho certo para ficar dentro de um botão.
class IndicadorDeBotao extends StatelessWidget {
  const IndicadorDeBotao({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 22,
      width: 22,
      child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
    );
  }
}

/// SnackBar padronizado. Use [erro] `false` para mensagens de sucesso.
void mostrarAviso(BuildContext context, String mensagem, {bool erro = true}) {
  final cores = Theme.of(context).colorScheme;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(mensagem),
        backgroundColor: erro ? cores.error : cores.inverseSurface,
      ),
    );
}

String? validarEmail(String? valor) {
  final texto = valor?.trim() ?? '';
  if (texto.isEmpty) return 'Informe seu e-mail.';
  final formatoValido = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(texto);
  return formatoValido ? null : 'E-mail inválido.';
}

String? validarSenha(String? valor) {
  if (valor == null || valor.isEmpty) return 'Crie uma senha.';
  if (valor.length < 6) return 'Use pelo menos 6 caracteres.';
  return null;
}

/// Diálogo simples para confirmar o e-mail antes de enviar a redefinição.
Future<String?> pedirEmailParaRecuperacao(
  BuildContext context,
  String emailInicial,
) {
  final controle = TextEditingController(text: emailInicial.trim());
  return showDialog<String>(
    context: context,
    builder: (contextoDialogo) {
      return AlertDialog(
        title: const Text('Redefinir senha'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text('Enviaremos um link de redefinição para o seu e-mail.'),
            const SizedBox(height: 16),
            TextField(
              controller: controle,
              keyboardType: TextInputType.emailAddress,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'E-mail'),
            ),
          ],
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(contextoDialogo).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              final email = controle.text.trim();
              if (validarEmail(email) != null) return;
              Navigator.of(contextoDialogo).pop(email);
            },
            child: const Text('Enviar'),
          ),
        ],
      );
    },
  ).whenComplete(controle.dispose);
}
