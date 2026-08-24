import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'firestore_service.dart';

/// Recebe as mensagens quando o app está fechado ou em segundo plano.
///
/// Roda num isolate próprio, por isso precisa inicializar o Firebase de novo e
/// ser uma função de topo anotada com `@pragma('vm:entry-point')`.
/// No Android, notificações com bloco `notification` já aparecem sozinhas na
/// bandeja - aqui só tratamos dados extras.
@pragma('vm:entry-point')
Future<void> tratarMensagemEmSegundoPlano(RemoteMessage mensagem) async {
  await Firebase.initializeApp();
  debugPrint('[FCM] em segundo plano: ${mensagem.messageId}');
}

/// Cloud Messaging: permissão, token do dispositivo e mensagens em primeiro plano.
class NotificacoesService {
  NotificacoesService({
    FirebaseMessaging? messaging,
    FirestoreService? firestore,
  })  : _messaging = messaging ?? FirebaseMessaging.instance,
        _firestore = firestore ?? FirestoreService();

  final FirebaseMessaging _messaging;
  final FirestoreService _firestore;

  StreamSubscription<String>? _inscricaoTokenAtualizado;
  String? _tokenAtual;

  /// Mensagens recebidas com o app aberto. O Android **não** mostra banner
  /// nesse caso, então a interface exibe um aviso interno (ver `app.dart`).
  Stream<RemoteMessage> get mensagensEmPrimeiroPlano => FirebaseMessaging.onMessage;

  /// Pede permissão, grava o token no perfil e passa a acompanhar renovações.
  ///
  /// Chame depois do login, com o `uid` já disponível.
  Future<void> configurar({required String uid}) async {
    try {
      final permissao = await _messaging.requestPermission();
      if (permissao.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[FCM] usuário recusou as notificações');
        return;
      }

      // No web é obrigatório informar a chave VAPID (Console > Cloud Messaging
      // > Configuração da Web). Deixe vazio para pular o registro no web.
      const chaveVapidWeb = '';
      if (kIsWeb && chaveVapidWeb.isEmpty) {
        debugPrint('[FCM] chave VAPID ausente - push desativado no web');
        return;
      }

      final token = kIsWeb
          ? await _messaging.getToken(vapidKey: chaveVapidWeb)
          : await _messaging.getToken();
      if (token != null) {
        _tokenAtual = token;
        await _firestore.registrarTokenFcm(uid: uid, token: token);
        debugPrint('[FCM] token registrado');
      }

      await _inscricaoTokenAtualizado?.cancel();
      _inscricaoTokenAtualizado = _messaging.onTokenRefresh.listen((novoToken) {
        _tokenAtual = novoToken;
        _firestore.registrarTokenFcm(uid: uid, token: novoToken);
      });
    } catch (erro) {
      // Push é um recurso acessório: se falhar, o app continua funcionando.
      debugPrint('[FCM] falha ao configurar: $erro');
    }
  }

  /// Remove o token deste aparelho - use antes do logout para o usuário não
  /// continuar recebendo avisos de uma conta que não está mais logada.
  Future<void> desvincularDispositivo({required String uid}) async {
    await _inscricaoTokenAtualizado?.cancel();
    _inscricaoTokenAtualizado = null;

    final token = _tokenAtual;
    if (token == null) return;
    try {
      await _firestore.removerTokenFcm(uid: uid, token: token);
    } catch (erro) {
      debugPrint('[FCM] falha ao remover token: $erro');
    }
    _tokenAtual = null;
  }
}
