import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/auth_service.dart';
import 'widgets_auth.dart';

class CadastroScreen extends StatefulWidget {
  const CadastroScreen({super.key});

  @override
  State<CadastroScreen> createState() => _CadastroScreenState();
}

class _CadastroScreenState extends State<CadastroScreen> {
  final _formulario = GlobalKey<FormState>();
  final _nome = TextEditingController();
  final _email = TextEditingController();
  final _senha = TextEditingController();
  bool _carregando = false;
  bool _senhaVisivel = false;

  @override
  void dispose() {
    _nome.dispose();
    _email.dispose();
    _senha.dispose();
    super.dispose();
  }

  Future<void> _criarConta() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() => _carregando = true);
    try {
      await context.read<AuthService>().criarConta(
            nome: _nome.text,
            email: _email.text,
            senha: _senha.text,
          );
      // O AuthGate assume a navegação; fechamos esta tela empilhada.
      if (mounted) Navigator.of(context).pop();
    } on FalhaAutenticacao catch (falha) {
      if (mounted) mostrarAviso(context, falha.mensagem);
    } finally {
      if (mounted) setState(() => _carregando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Criar conta')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formulario,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    TextFormField(
                      controller: _nome,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Seu nome',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (valor) =>
                          (valor == null || valor.trim().length < 2)
                              ? 'Informe seu nome.'
                              : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'E-mail',
                        prefixIcon: Icon(Icons.mail_outline),
                      ),
                      validator: validarEmail,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _senha,
                      obscureText: !_senhaVisivel,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _criarConta(),
                      decoration: InputDecoration(
                        labelText: 'Senha',
                        helperText: 'Mínimo de 6 caracteres.',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          onPressed: () =>
                              setState(() => _senhaVisivel = !_senhaVisivel),
                          icon: Icon(
                            _senhaVisivel
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                          ),
                        ),
                      ),
                      validator: validarSenha,
                    ),
                    const SizedBox(height: 28),
                    FilledButton(
                      onPressed: _carregando ? null : _criarConta,
                      child: _carregando
                          ? const IndicadorDeBotao()
                          : const Text('Criar conta'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
