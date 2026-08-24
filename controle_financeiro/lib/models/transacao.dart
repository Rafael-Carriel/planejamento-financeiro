import 'package:cloud_firestore/cloud_firestore.dart';

/// Natureza do lançamento: dinheiro que entra ou que sai.
enum TipoTransacao {
  entrada('entrada', 'Entrada'),
  saida('saida', 'Saída');

  const TipoTransacao(this.codigo, this.rotulo);

  /// Valor gravado no Firestore (nunca traduzir - as regras validam por ele).
  final String codigo;

  /// Texto exibido na interface.
  final String rotulo;

  static TipoTransacao doCodigo(String? codigo) =>
      codigo == entrada.codigo ? entrada : saida;
}

/// Um lançamento financeiro do usuário.
///
/// O [valor] é sempre positivo; o sinal vem do [tipo]. Isso evita registros
/// contraditórios (por exemplo, uma saída com valor negativo).
class Transacao {
  const Transacao({
    required this.id,
    required this.descricao,
    required this.valor,
    required this.tipo,
    required this.categoria,
    required this.data,
    this.observacao,
    this.criadoEm,
  });

  final String id;
  final String descricao;
  final double valor;
  final TipoTransacao tipo;
  final String categoria;
  final DateTime data;
  final String? observacao;
  final DateTime? criadoEm;

  bool get isEntrada => tipo == TipoTransacao.entrada;

  /// Positivo para entradas, negativo para saídas - use para somar saldo.
  double get valorComSinal => isEntrada ? valor : -valor;

  factory Transacao.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> documento,
  ) {
    final dados = documento.data() ?? const <String, dynamic>{};
    return Transacao(
      id: documento.id,
      descricao: (dados['descricao'] as String?)?.trim().isNotEmpty == true
          ? (dados['descricao'] as String).trim()
          : 'Sem descrição',
      valor: (dados['valor'] as num?)?.toDouble().abs() ?? 0,
      tipo: TipoTransacao.doCodigo(dados['tipo'] as String?),
      categoria: (dados['categoria'] as String?) ?? 'Outros',
      data: (dados['data'] as Timestamp?)?.toDate() ?? DateTime.now(),
      observacao: (dados['observacao'] as String?)?.trim(),
      criadoEm: (dados['criadoEm'] as Timestamp?)?.toDate(),
    );
  }

  /// Monta o mapa enviado ao Firestore.
  ///
  /// Passe [novo] como `true` na criação para gravar `criadoEm` com o
  /// timestamp do servidor (não confie no relógio do celular).
  Map<String, dynamic> toFirestore({bool novo = false}) => <String, dynamic>{
        'descricao': descricao.trim(),
        'valor': valor.abs(),
        'tipo': tipo.codigo,
        'categoria': categoria,
        'data': Timestamp.fromDate(data),
        'observacao': (observacao?.trim().isEmpty ?? true) ? null : observacao!.trim(),
        'atualizadoEm': FieldValue.serverTimestamp(),
        if (novo) 'criadoEm': FieldValue.serverTimestamp(),
      };

  Transacao copyWith({
    String? id,
    String? descricao,
    double? valor,
    TipoTransacao? tipo,
    String? categoria,
    DateTime? data,
    String? observacao,
  }) {
    return Transacao(
      id: id ?? this.id,
      descricao: descricao ?? this.descricao,
      valor: valor ?? this.valor,
      tipo: tipo ?? this.tipo,
      categoria: categoria ?? this.categoria,
      data: data ?? this.data,
      observacao: observacao ?? this.observacao,
      criadoEm: criadoEm,
    );
  }
}
