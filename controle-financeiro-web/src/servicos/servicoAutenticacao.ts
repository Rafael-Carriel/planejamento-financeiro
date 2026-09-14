import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { auth, bancoDeDados } from '../firebase/config';
import type { Perfil } from '../tipos';

/// Autenticação por e-mail e senha e o documento de perfil que acompanha cada
/// conta em `usuarios/{uid}`.

export function documentoDoUsuario(uid: string) {
  return doc(bancoDeDados, 'usuarios', uid);
}

export function observarUsuario(aoMudar: (usuario: User | null) => void): () => void {
  return onAuthStateChanged(auth, aoMudar);
}

export async function entrar(email: string, senha: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), senha);
}

/// Cria a conta e o perfil.
///
/// Se a gravação do perfil falhar, a conta já existe no Authentication — então
/// o erro é registrado e engolido: o usuário entra normalmente e o perfil é
/// criado na próxima abertura por `garantirPerfil`.
export async function criarConta(
  nome: string,
  email: string,
  senha: string,
): Promise<void> {
  const credencial = await createUserWithEmailAndPassword(auth, email.trim(), senha);
  const nomeLimpo = nome.trim();

  try {
    if (nomeLimpo.length > 0) {
      await updateProfile(credencial.user, { displayName: nomeLimpo });
    }
    await garantirPerfil(credencial.user.uid, nomeLimpo, credencial.user.email ?? email.trim());
  } catch (erro) {
    console.error('Conta criada, mas o perfil não foi gravado agora.', erro);
    // Re-throw para que o caller possa tratar o erro se necessário
    throw erro;
  }
}

export async function sair(): Promise<void> {
  await signOut(auth);
}

export async function enviarRedefinicaoDeSenha(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/// Garante que existe o documento de perfil.
///
/// Os campos gravados são exatamente os que as regras do Firestore aceitam
/// (`nome`, `email`, `criadoEm`, `atualizadoEm`, `tokensFcm`); acrescentar
/// qualquer outro faz a escrita ser recusada. `tokensFcm` é do app Flutter, que
/// cuida das notificações — a web não mexe nele.
///
/// Usa `merge: true` sempre para evitar race conditions entre cadastro e
/// observador de sessão — ambos podem chegar ao mesmo tempo.
export async function garantirPerfil(
  uid: string,
  nome: string,
  email: string,
): Promise<void> {
  const referencia = documentoDoUsuario(uid);
  const nomeLimpo = nome.trim();

  // Sempre merge: true para evitar race condition entre cadastro e observador.
  // Se o documento já existe, só sobrescreve os campos informados.
  await setDoc(referencia, {
    nome: nomeLimpo.length > 0 ? nomeLimpo : email.split('@')[0],
    email,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
}

export async function lerPerfil(uid: string): Promise<Perfil | null> {
  const documento = await getDoc(documentoDoUsuario(uid));
  if (!documento.exists()) return null;

  const dados = documento.data();
  return {
    nome: typeof dados.nome === 'string' ? dados.nome : '',
    email: typeof dados.email === 'string' ? dados.email : '',
    criadoEm: dados.criadoEm?.toDate?.() ?? null,
  };
}

export async function atualizarNome(uid: string, nome: string): Promise<void> {
  const nomeLimpo = nome.trim();
  if (nomeLimpo.length === 0) {
    throw new Error('O nome não pode ficar vazio.');
  }

  // Atualiza o Firestore primeiro — se falhar, o displayName não muda.
  await updateDoc(documentoDoUsuario(uid), {
    nome: nomeLimpo,
    atualizadoEm: serverTimestamp(),
  });

  // Atualiza o displayName do Firebase Auth.
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: nomeLimpo });
  }
}

/// Atualiza o e-mail no Firebase Auth e no Firestore.
///
/// Reautenticação é obrigatória para trocar e-mail ( Firebase exigência de
/// segurança). O Firestore é atualizado apenas se a operação no Auth succeed.
export async function atualizarEmail(
  uid: string,
  novoEmail: string,
  senhaAtual: string,
): Promise<void> {
  const emailLimpo = novoEmail.trim();
  if (emailLimpo.length === 0) {
    throw new Error('O e-mail não pode ficar vazio.');
  }

  const usuario = auth.currentUser;
  if (!usuario || !usuario.email) {
    throw new Error('Nenhum usuário autenticado.');
  }

  // Reautenticação é obrigatória para operações sensíveis.
  const credencial = await signInWithEmailAndPassword(auth, usuario.email, senhaAtual);

  // Atualiza o e-mail no Firebase Auth.
  await updateEmail(credencial.user, emailLimpo);

  // Atualiza o Firestore.
  await updateDoc(documentoDoUsuario(uid), {
    email: emailLimpo,
    atualizadoEm: serverTimestamp(),
  });
}

/// Troca a senha do usuário.
///
/// Reautenticação é obrigatória. A nova senha deve ter pelo menos 6 caracteres.
export async function atualizarSenha(
  senhaAtual: string,
  novaSenha: string,
): Promise<void> {
  if (novaSenha.length < 6) {
    throw new Error('A nova senha precisa de pelo menos 6 caracteres.');
  }

  const usuario = auth.currentUser;
  if (!usuario || !usuario.email) {
    throw new Error('Nenhum usuário autenticado.');
  }

  // Reautenticação é obrigatória para operações sensíveis.
  const credencial = await signInWithEmailAndPassword(auth, usuario.email, senhaAtual);

  // Atualiza a senha.
  await updatePassword(credencial.user, novaSenha);
}

/// Envia e-mail de verificação para o usuário atual.
///
/// O e-mail de verificação é enviado pelo Firebase Auth. O usuário precisa
/// clicar no link para verificar o e-mail.
export async function enviarVerificacaoEmail(): Promise<void> {
  const usuario = auth.currentUser;
  if (!usuario) {
    throw new Error('Nenhum usuário autenticado.');
  }
  await sendEmailVerification(usuario);
}

/// Traduz o erro do Firebase para uma frase que diz o que fazer.
///
/// O SDK devolve códigos como 'auth/invalid-credential'; mostrar isso na tela
/// não ajuda ninguém. Mensagens sem código conhecido caem no genérico.
export function mensagemDeErro(erro: unknown): string {
  const codigo = erro instanceof FirebaseError ? erro.code : '';

  switch (codigo) {
    case 'auth/invalid-email':
      return 'Esse e-mail não parece válido. Confira se falta algo antes ou depois do @.';
    case 'auth/missing-password':
      return 'Digite a senha.';
    case 'auth/weak-password':
      return 'A senha precisa de pelo menos 6 caracteres.';
    case 'auth/email-already-in-use':
      return 'Já existe uma conta com esse e-mail. Entre em vez de criar outra.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha não conferem.';
    case 'auth/user-disabled':
      return 'Esta conta está desativada.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
    case 'auth/network-request-failed':
      return 'Sem conexão com o Firebase. Confira a internet e tente de novo.';
    case 'auth/operation-not-allowed':
      return 'O acesso por e-mail e senha está desligado no Firebase. Ative em Authentication > Sign-in method.';
    case 'auth/requires-recent-login':
      return 'Por segurança, entre de novo antes de fazer essa mudança.';
    case 'permission-denied':
      return 'O Firestore recusou a operação. As regras de segurança podem estar desatualizadas: publique o firestore.rules.';
    case 'unavailable':
      return 'O Firestore está inacessível agora. Verifique a conexão.';
    case 'failed-precondition':
      return 'O Firestore pediu um índice para esta consulta. Abra o console e crie o índice sugerido.';
    default:
      if (erro instanceof Error && erro.message.length > 0) return erro.message;
      return 'Não deu para concluir. Tente de novo.';
  }
}
