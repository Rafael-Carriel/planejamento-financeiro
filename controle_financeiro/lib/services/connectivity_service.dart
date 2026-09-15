import 'dart:async';
import 'dart:io';

/// Observa se o aparelho tem acesso à internet.
///
/// Implementação leve com `dart:io`, sem depender de pacotes externos: a cada
/// 5 segundos o serviço tenta resolver o DNS de um host conhecido; se a
/// resolução falha, o aparelho é considerado offline. O resultado alimenta
/// [onConnectivityChanged], que só emite quando o status muda (nada de
/// "online, online, online..." reconstruindo a interface à toa).
///
/// OBS: se o projeto passar a preferir eventos do sistema (sem polling),
/// basta adicionar `connectivity_plus` ao pubspec.yaml e trocar o corpo de
/// [_checar] por:
///
/// ```dart
/// import 'package:connectivity_plus/connectivity_plus.dart';
///
/// Future<bool> _checar() async {
///   final resultados = await Connectivity().checkConnectivity();
///   return resultados.any((r) => r != ConnectivityResult.none);
/// }
/// ```
class ConnectivityService {
  ConnectivityService._() {
    // Primeira checagem imediata; as seguintes seguem o temporizador.
    _verificar();
    _temporizador = Timer.periodic(_intervaloChecagem, (_) => _verificar());
  }

  /// Instância compartilhada - uma única checagem periódica para o app todo.
  ///
  /// É criada na primeira vez que alguém consulta a conexão (a faixa offline,
  /// por exemplo), então o app não faz nenhuma checagem antes do login.
  static final ConnectivityService instancia = ConnectivityService._();

  /// Intervalo entre checagens: curto o bastante para a faixa offline aparecer
  /// rápido, longo o bastante para não pesar na bateria.
  static const Duration _intervaloChecagem = Duration(seconds: 5);

  /// Host de referência: resolver o DNS dele confirma que há rede de verdade,
  /// sem precisar abrir uma conexão com servidor algum.
  static const String _hostReferencia = 'google.com';

  final StreamController<bool> _controlador =
      StreamController<bool>.broadcast();

  Timer? _temporizador;

  /// Status presumido até a primeira checagem terminar: otimista, para não
  /// piscar a faixa offline em todo início de app.
  bool _online = true;

  /// Emite `true` quando o aparelho fica online e `false` quando fica offline.
  ///
  /// Stream de broadcast: pode ser ouvido por vários widgets ao mesmo tempo.
  Stream<bool> get onConnectivityChanged => _controlador.stream;

  /// Status da conexão agora, checado na hora (não usa o valor em cache).
  Future<bool> get isOnline => _checar();

  Future<bool> _checar() async {
    try {
      final resultados = await InternetAddress.lookup(_hostReferencia);
      return resultados.isNotEmpty && resultados.first.rawAddress.isNotEmpty;
    } on SocketException {
      // Sem rota de rede ou DNS inacessível: considera offline.
      return false;
    }
  }

  Future<void> _verificar() async {
    final online = await _checar();
    // Só notifica quando o status muda, evitando rebuilds desnecessários.
    if (online == _online) return;
    _online = online;
    _controlador.add(online);
  }

  /// Cancela o temporizador e fecha o stream.
  ///
  /// Como [instancia] vive pelo app todo, isto só é útil em testes.
  void dispose() {
    _temporizador?.cancel();
    _controlador.close();
  }
}
