import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/notificacoes_service.dart';
import '../state/estado_transacoes.dart';
import '../state/mes_selecionado.dart';
import '../widgets/seletor_mes.dart';
import 'dashboard/dashboard_screen.dart';
import 'perfil/perfil_screen.dart';
import 'relatorios/relatorios_screen.dart';
import 'transacoes/form_transacao_screen.dart';
import 'transacoes/transacoes_screen.dart';

/// Estrutura principal do app depois do login: abas + mês selecionado.
class ShellScreen extends StatefulWidget {
  const ShellScreen({
    required this.uid,
    required this.nome,
    required this.email,
    super.key,
  });

  final String uid;
  final String nome;
  final String email;

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  static const List<String> _titulos = <String>[
    'Resumo',
    'Lançamentos',
    'Relatórios',
    'Perfil',
  ];

  final MesSelecionado _mes = MesSelecionado();
  StreamSubscription<RemoteMessage>? _inscricaoMensagens;
  int _aba = 0;

  @override
  void initState() {
    super.initState();
    final notificacoes = context.read<NotificacoesService>();
    // Registra o aparelho para receber push (não bloqueia a interface).
    notificacoes.configurar(uid: widget.uid);
    _inscricaoMensagens =
        notificacoes.mensagensEmPrimeiroPlano.listen(_avisarSobreMensagem);
  }

  @override
  void dispose() {
    _inscricaoMensagens?.cancel();
    _mes.dispose();
    super.dispose();
  }

  /// Com o app aberto o Android não mostra banner, então avisamos por dentro.
  void _avisarSobreMensagem(RemoteMessage mensagem) {
    final notificacao = mensagem.notification;
    if (notificacao == null || !mounted) return;

    final texto = <String>[
      if (notificacao.title?.isNotEmpty ?? false) notificacao.title!,
      if (notificacao.body?.isNotEmpty ?? false) notificacao.body!,
    ].join(' — ');
    if (texto.isEmpty) return;

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(texto),
          duration: const Duration(seconds: 5),
        ),
      );
  }

  Future<void> _abrirNovoLancamento() {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => FormTransacaoScreen(
          uid: widget.uid,
          mesReferencia: _mes.mes,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<MesSelecionado>.value(
      value: _mes,
      child: ProvedorDeTransacoesDoMes(
        uid: widget.uid,
        child: Scaffold(
          appBar: AppBar(
            title: Text(_titulos[_aba]),
            bottom: _aba == 3 ? null : const SeletorMes(),
          ),
          body: IndexedStack(
            index: _aba,
            children: <Widget>[
              DashboardScreen(
                uid: widget.uid,
                nome: widget.nome,
                onVerTodos: () => setState(() => _aba = 1),
              ),
              TransacoesScreen(uid: widget.uid),
              const RelatoriosScreen(),
              PerfilScreen(
                uid: widget.uid,
                nome: widget.nome,
                email: widget.email,
              ),
            ],
          ),
          floatingActionButton: _aba == 3
              ? null
              : FloatingActionButton.extended(
                  onPressed: _abrirNovoLancamento,
                  icon: const Icon(Icons.add),
                  label: const Text('Lançamento'),
                ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: _aba,
            onDestinationSelected: (indice) => setState(() => _aba = indice),
            destinations: const <NavigationDestination>[
              NavigationDestination(
                icon: Icon(Icons.dashboard_outlined),
                selectedIcon: Icon(Icons.dashboard),
                label: 'Resumo',
              ),
              NavigationDestination(
                icon: Icon(Icons.receipt_long_outlined),
                selectedIcon: Icon(Icons.receipt_long),
                label: 'Lançamentos',
              ),
              NavigationDestination(
                icon: Icon(Icons.pie_chart_outline),
                selectedIcon: Icon(Icons.pie_chart),
                label: 'Relatórios',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline),
                selectedIcon: Icon(Icons.person),
                label: 'Perfil',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
