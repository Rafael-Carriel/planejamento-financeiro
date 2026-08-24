import 'package:flutter/foundation.dart';

import '../core/formatters.dart';

/// Mês que as telas estão exibindo.
///
/// Fica acima da navegação para o dashboard, a lista e os relatórios sempre
/// falarem do mesmo período: trocar o mês numa aba reflete em todas.
class MesSelecionado extends ChangeNotifier {
  MesSelecionado([DateTime? inicial])
      : _mes = inicioDoMes(inicial ?? DateTime.now());

  DateTime _mes;

  DateTime get mes => _mes;

  String get rotulo => formatarMesAno(_mes);

  bool get isMesAtual {
    final agora = DateTime.now();
    return _mes.year == agora.year && _mes.month == agora.month;
  }

  void anterior() => _definir(DateTime(_mes.year, _mes.month - 1));

  void proximo() => _definir(DateTime(_mes.year, _mes.month + 1));

  void voltarParaMesAtual() => _definir(inicioDoMes(DateTime.now()));

  void _definir(DateTime novo) {
    final normalizado = inicioDoMes(novo);
    if (normalizado == _mes) return;
    _mes = normalizado;
    notifyListeners();
  }
}
