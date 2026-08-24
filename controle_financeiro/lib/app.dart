import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'core/theme.dart';
import 'screens/auth_gate.dart';
import 'services/auth_service.dart';
import 'services/firestore_service.dart';
import 'services/notificacoes_service.dart';

/// Raiz do app.
///
/// Os serviços são criados uma única vez aqui e distribuídos por Provider, de
/// modo que reconstruções da árvore não recriem conexões com o Firebase.
class ControleFinanceiroApp extends StatefulWidget {
  const ControleFinanceiroApp({super.key});

  @override
  State<ControleFinanceiroApp> createState() => _ControleFinanceiroAppState();
}

class _ControleFinanceiroAppState extends State<ControleFinanceiroApp> {
  late final FirestoreService _firestore = FirestoreService();
  late final AuthService _auth = AuthService(firestore: _firestore);
  late final NotificacoesService _notificacoes =
      NotificacoesService(firestore: _firestore);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: <SingleChildWidget>[
        Provider<FirestoreService>.value(value: _firestore),
        Provider<AuthService>.value(value: _auth),
        Provider<NotificacoesService>.value(value: _notificacoes),
      ],
      child: MaterialApp(
        title: 'Controle Financeiro',
        debugShowCheckedModeBanner: false,
        theme: construirTema(),
        locale: const Locale('pt', 'BR'),
        supportedLocales: const <Locale>[Locale('pt', 'BR')],
        localizationsDelegates: const <LocalizationsDelegate<Object>>[
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const AuthGate(),
      ),
    );
  }
}
