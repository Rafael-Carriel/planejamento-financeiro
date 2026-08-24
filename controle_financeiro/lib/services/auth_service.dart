import 'package:firebase_auth/firebase_auth.dart';

import 'firestore_service.dart';

/// Erro de autenticação já traduzido para o usuário final.
class FalhaAutenticacao implements Exception {
  const FalhaAutenticacao(this.mensagem);

  final String mensagem;

  @override
  String toString() => mensagem;
}

/// Autenticação por e-mail e senha.
///
/// Para adicionar login com Google depois: habilite o provedor no console,
/// adicione o pacote `google_sign_in` e crie um método que gere a
/// `OAuthCredential` e chame `_auth.signInWithCredential(...)`.
class AuthService {
  AuthService({FirebaseAuth? auth, FirestoreService? firestore})
      : _auth = auth ?? FirebaseAuth.instance,
        _firestore = firestore ?? FirestoreService();

  final FirebaseAuth _auth;
  final FirestoreService _firestore;

  /// Emite o usuário logado (ou `null`) a cada login/logout.
  Stream<User?> get mudancasDeAutenticacao => _auth.authStateChanges();

  User? get usuarioAtual => _auth.currentUser;

  Future<void> entrar({required String email, required String senha}) async {
    try {
      await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: senha,
      );
    } on FirebaseAuthException catch (erro) {
      throw FalhaAutenticacao(_traduzir(erro));
    }
  }

  Future<void> criarConta({
    required String nome,
    required String email,
    required String senha,
  }) async {
    try {
      final credencial = await _auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: senha,
      );
      final usuario = credencial.user;
      if (usuario == null) {
        throw const FalhaAutenticacao('Não foi possível criar a conta.');
      }

      await usuario.updateDisplayName(nome.trim());
      await _firestore.salvarPerfil(
        uid: usuario.uid,
        nome: nome,
        email: email,
      );
    } on FirebaseAuthException catch (erro) {
      throw FalhaAutenticacao(_traduzir(erro));
    }
  }

  Future<void> enviarRedefinicaoDeSenha(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email.trim());
    } on FirebaseAuthException catch (erro) {
      throw FalhaAutenticacao(_traduzir(erro));
    }
  }

  Future<void> sair() => _auth.signOut();

  String _traduzir(FirebaseAuthException erro) {
    switch (erro.code) {
      case 'invalid-email':
        return 'E-mail inválido.';
      case 'user-disabled':
        return 'Esta conta foi desativada.';
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
        return 'E-mail ou senha incorretos.';
      case 'email-already-in-use':
        return 'Já existe uma conta com este e-mail.';
      case 'weak-password':
        return 'A senha precisa ter pelo menos 6 caracteres.';
      case 'too-many-requests':
        return 'Muitas tentativas. Aguarde um instante e tente de novo.';
      case 'network-request-failed':
        return 'Sem conexão. Verifique sua internet.';
      case 'operation-not-allowed':
        return 'Login por e-mail/senha não está habilitado no Firebase.';
      default:
        return 'Não foi possível concluir: ${erro.message ?? erro.code}';
    }
  }
}
