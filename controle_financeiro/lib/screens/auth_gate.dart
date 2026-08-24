import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import 'auth/login_screen.dart';
import 'shell_screen.dart';

/// Decide o que mostrar conforme o estado do login.
///
/// Ouvir `authStateChanges` deixa a navegação automática: ao entrar ou sair, a
/// tela troca sozinha, sem `Navigator` espalhado pelo código.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final autenticacao = context.read<AuthService>();

    return StreamBuilder<User?>(
      stream: autenticacao.mudancasDeAutenticacao,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const _TelaDeAbertura();
        }

        final usuario = snapshot.data;
        if (usuario == null) return const LoginScreen();

        return ShellScreen(
          // A chave garante que o estado é recriado se outro usuário logar.
          key: ValueKey<String>(usuario.uid),
          uid: usuario.uid,
          nome: usuario.displayName ?? 'Você',
          email: usuario.email ?? '',
        );
      },
    );
  }
}

class _TelaDeAbertura extends StatelessWidget {
  const _TelaDeAbertura();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
