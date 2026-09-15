import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/auth_service.dart';

/// Instância única do serviço de autenticação usada pelos providers.
///
/// Enquanto o `MultiProvider` do `app.dart` continuar existindo, esta instância
/// é independente da de lá - as duas conversam com o mesmo `FirebaseAuth`, sem
/// estado duplicado.
final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(),
);

/// Emite o usuário logado (ou `null`) a cada login/logout.
///
/// É a versão Riverpod do stream que o `AuthGate` consome hoje.
final usuarioAutenticadoProvider = StreamProvider<User?>(
  (ref) => ref.watch(authServiceProvider).mudancasDeAutenticacao,
);

/// Atalho para quem só precisa do `uid`; `null` enquanto não houver sessão.
final uidAutenticadoProvider = Provider<String?>(
  (ref) => ref.watch(usuarioAutenticadoProvider).valueOrNull?.uid,
);
