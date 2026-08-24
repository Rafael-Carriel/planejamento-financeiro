import 'package:intl/intl.dart';

final NumberFormat _moeda = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
final NumberFormat _moedaCompacta = NumberFormat.compactCurrency(
  locale: 'pt_BR',
  symbol: 'R\$',
);

/// R$ 1.234,56
String formatarMoeda(double valor) => _moeda.format(valor);

/// R$ 1,2 mil - útil para cartões estreitos.
String formatarMoedaCompacta(double valor) => _moedaCompacta.format(valor);

/// 23/08/2026
String formatarData(DateTime data) => DateFormat('dd/MM/yyyy').format(data);

/// Agosto de 2026
String formatarMesAno(DateTime data) =>
    _capitalizar(DateFormat("MMMM 'de' yyyy", 'pt_BR').format(data));

/// Sábado, 23 de agosto
String formatarDiaCompleto(DateTime data) =>
    _capitalizar(DateFormat("EEEE, d 'de' MMMM", 'pt_BR').format(data));

String _capitalizar(String texto) =>
    texto.isEmpty ? texto : texto[0].toUpperCase() + texto.substring(1);

/// Converte o texto digitado pelo usuário em número.
///
/// Aceita `1.234,56`, `1234,56`, `1234.56` e `1234`. Retorna `null` quando o
/// texto não representa um valor positivo válido.
double? parseValor(String texto) {
  var limpo = texto.trim().replaceAll(RegExp(r'[^0-9,.-]'), '');
  if (limpo.isEmpty) return null;

  if (limpo.contains(',')) {
    // Formato brasileiro: ponto é separador de milhar, vírgula é decimal.
    limpo = limpo.replaceAll('.', '').replaceAll(',', '.');
  } else if (limpo.split('.').length > 2) {
    // Vários pontos e nenhuma vírgula: todos são separadores de milhar.
    limpo = limpo.replaceAll('.', '');
  }

  final valor = double.tryParse(limpo);
  if (valor == null || valor <= 0) return null;
  return double.parse(valor.toStringAsFixed(2));
}

/// Primeiro dia do mês, à meia-noite - base para as consultas por período.
DateTime inicioDoMes(DateTime data) => DateTime(data.year, data.month);

/// Primeiro instante do mês seguinte (limite superior exclusivo).
DateTime inicioDoMesSeguinte(DateTime data) => DateTime(data.year, data.month + 1);

/// Remove a hora, mantendo apenas ano/mês/dia - usado para agrupar a lista.
DateTime somenteData(DateTime data) => DateTime(data.year, data.month, data.day);
