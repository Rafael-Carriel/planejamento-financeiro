import 'package:cloud_firestore/cloud_firestore.dart';

import '../core/formatters.dart';
import '../models/transacao.dart';

/// Acesso ao Firestore.
///
/// Estrutura dos dados:
///
/// ```text
/// usuarios/{uid}                      -> perfil (nome, email, tokensFcm)
/// usuarios/{uid}/transacoes/{id}      -> lançamentos
/// ```
///
/// Manter as transações dentro do documento do usuário deixa as regras de
/// segurança triviais: ninguém lê nem escreve fora do próprio `uid`.
class FirestoreService {
  FirestoreService({FirebaseFirestore? firestore})
      : _db = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _db;

  DocumentReference<Map<String, dynamic>> _usuario(String uid) =>
      _db.collection('usuarios').doc(uid);

  CollectionReference<Map<String, dynamic>> _transacoes(String uid) =>
      _usuario(uid).collection('transacoes');

  // ---------------------------------------------------------------- perfil

  /// Cria ou atualiza o documento de perfil. Usa merge para não apagar
  /// campos gravados por outros fluxos (como os tokens de notificação).
  Future<void> salvarPerfil({
    required String uid,
    required String nome,
    required String email,
  }) {
    return _usuario(uid).set(<String, dynamic>{
      'nome': nome.trim(),
      'email': email.trim(),
      'atualizadoEm': FieldValue.serverTimestamp(),
      'criadoEm': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  Stream<Map<String, dynamic>?> perfil(String uid) =>
      _usuario(uid).snapshots().map((documento) => documento.data());

  /// Guarda o token do dispositivo para o envio de push.
  Future<void> registrarTokenFcm({
    required String uid,
    required String token,
  }) {
    return _usuario(uid).set(<String, dynamic>{
      'tokensFcm': FieldValue.arrayUnion(<String>[token]),
      'atualizadoEm': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  Future<void> removerTokenFcm({
    required String uid,
    required String token,
  }) {
    return _usuario(uid).set(<String, dynamic>{
      'tokensFcm': FieldValue.arrayRemove(<String>[token]),
    }, SetOptions(merge: true));
  }

  // ------------------------------------------------------------ transações

  /// Lançamentos de um mês, do mais recente para o mais antigo.
  ///
  /// O filtro e a ordenação usam o mesmo campo (`data`), então o Firestore
  /// resolve com o índice automático - não é preciso criar índice composto.
  Stream<List<Transacao>> transacoesDoMes({
    required String uid,
    required DateTime mes,
  }) {
    return _transacoes(uid)
        .where(
          'data',
          isGreaterThanOrEqualTo: Timestamp.fromDate(inicioDoMes(mes)),
        )
        .where('data', isLessThan: Timestamp.fromDate(inicioDoMesSeguinte(mes)))
        .orderBy('data', descending: true)
        .snapshots()
        .map(
          (consulta) => consulta.docs.map(Transacao.fromFirestore).toList(),
        );
  }

  Future<void> adicionarTransacao({
    required String uid,
    required Transacao transacao,
  }) {
    return _transacoes(uid).add(transacao.toFirestore(novo: true));
  }

  Future<void> atualizarTransacao({
    required String uid,
    required Transacao transacao,
  }) {
    return _transacoes(uid).doc(transacao.id).update(transacao.toFirestore());
  }

  Future<void> removerTransacao({
    required String uid,
    required String transacaoId,
  }) {
    return _transacoes(uid).doc(transacaoId).delete();
  }
}
