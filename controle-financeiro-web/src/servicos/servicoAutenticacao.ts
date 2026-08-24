import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
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
/// Passar `nome` vazio é o caso de quem só está entrando: aí o perfil é criado
/// com um palpite a partir do e-mail e nunca sobrescreve o nome já gravado.
/// Isso resolve a corrida entre o cadastro (que já sabe o nome) e o observador
/// de sessão (que dispara junto e não sabe): quem tem nome de verdade ganha,
/// independente da ordem em que as duas chamadas chegarem.
export async function garantirPerfil(
  uid: string,
  nome: string,
  email: string,
): Promise<void> {
  const referencia = documentoDoUsuario(uid);
  const atual = await getDoc(referencia);
  const nomeLimpo = nome.trim();

  if (!atual.exists()) {
    await setDoc(referencia, {
      nome: nomeLimpo.length > 0 ? nomeLimpo : email.split('@')[0],
      email,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    return;
  }

  const dados = atual.data();
  const nomeGravado = typeof dados.nome === 'string' ? dados.nome.trim() : '';
  if (nomeLimpo.length > 0 && nomeLimpo !== nomeGravado) {
    await updateDoc(referencia, {
      nome: nomeLimpo,
      atualizadoEm: serverTimestamp(),
    });
  }
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
  await updateDoc(documentoDoUsuario(uid), {
    nome: nomeLimpo,
    atualizadoEm: serverTimestamp(),
  });

  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: nomeLimpo });
  }
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
