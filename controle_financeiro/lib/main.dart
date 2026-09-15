import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

import 'app.dart';
import 'services/notificacoes_service.dart';

// ATENÇÃO: este arquivo é gerado na sua máquina pelo comando
// `flutterfire configure` (veja o SETUP.md). Enquanto ele não existir, o
// projeto não compila - é o passo 4 do guia.
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Habilita a persistência offline do Firestore: as leituras passam a sair
  // do cache local e as escritas ficam guardadas no aparelho até a conexão
  // voltar, quando são sincronizadas automaticamente. Precisa ser definido
  // antes de qualquer outro uso do Firestore.
  FirebaseFirestore.instance.settings =
      const Settings(persistenceEnabled: true);

  // Precisa ser registrado antes do runApp e apontar para uma função de topo.
  FirebaseMessaging.onBackgroundMessage(tratarMensagemEmSegundoPlano);

  // Carrega os nomes de meses/dias em português para o intl.
  initializeDateFormatting('pt_BR');
  Intl.defaultLocale = 'pt_BR';

  // O ProviderScope é a raiz do Riverpod: fica acima do MaterialApp para que
  // qualquer tela possa consumir os providers da nova camada de estado.
  runApp(const ProviderScope(child: ControleFinanceiroApp()));
}
