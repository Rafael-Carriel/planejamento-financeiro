import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';

import {
  criarConta as criarContaNoFirebase,
  entrar as entrarNoFirebase,
  entrarComGoogle,
  temAceiteLegal,
  registrarAceiteLegal,
  enviarRedefinicaoDeSenha,
  enviarVerificacaoEmail,
  garantirPerfil,
  lerPerfil,
  observarUsuario,
  sair as sairDoFirebase,
  atualizarNome as atualizarNomeNoFirebase,
  atualizarEmail as atualizarEmailNoFirebase,
  atualizarSenha as atualizarSenhaNoFirebase,
} from '../servicos/servicoAutenticacao';
import type { Perfil } from '../tipos';

/// Quem está usando o app.
///
/// `carregando` começa em `true` e só vira `false` depois da primeira resposta do
/// Firebase. Sem isso, a tela de login apareceria por um instante para quem já
/// estava logado, porque a sessão é restaurada de forma assíncrona.

interface ValorDaAutenticacao {
  usuario: User | null;
  perfil: Perfil | null;
  carregando: boolean;
  nomeParaExibir: string;
  entrar: (email: string, senha: string) => Promise<void>;
  entrarComGoogle: () => Promise<void>;
  aceiteGooglePendente: boolean;
  confirmarAceiteGoogle: () => Promise<void>;
  criarConta: (nome: string, email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  redefinirSenha: (email: string) => Promise<void>;
  recarregarPerfil: () => Promise<void>;
  atualizarNome: (nome: string) => Promise<void>;
  atualizarEmail: (novoEmail: string, senhaAtual: string) => Promise<void>;
  atualizarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>;
  enviarVerificacaoEmail: () => Promise<void>;
}

const ContextoAutenticacao = createContext<ValorDaAutenticacao | null>(null);

export function ProvedorDeAutenticacao({ children }: { children: ReactNode }) {
  const [usuario, definirUsuario] = useState<User | null>(null);
  const [perfil, definirPerfil] = useState<Perfil | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [aceiteGooglePendente, definirAceiteGooglePendente] = useState(false);

  useEffect(() => {
    let ativo = true, revisao = 0;
    const encerrar = observarUsuario((usuarioAtual) => {
      const atual = ++revisao;
      definirCarregando(true);
      void (async () => {
        let pendente = false;
        if (usuarioAtual?.providerData.some(provedor => provedor.providerId === 'google.com')) {
          try { pendente = !(await temAceiteLegal(usuarioAtual.uid)); }
          catch { pendente = true; }
        }
        if (!ativo || atual !== revisao) return;
        definirUsuario(usuarioAtual);
        definirAceiteGooglePendente(pendente);
        definirCarregando(false);
      })();
    });
    return () => { ativo = false; encerrar(); };
  }, []);

  const carregarPerfil = useCallback(async (uid: string, email: string, nome = '') => {
    try {
      await garantirPerfil(uid, nome, email, true);
      const encontrado = await lerPerfil(uid);
      definirPerfil(encontrado);
    } catch (erro) {
      // Perfil é conveniência: o app funciona sem ele (o nome cai no e-mail).
      console.warn('Não foi possível carregar o perfil.', erro);
      definirPerfil(null);
    }
  }, []);

  useEffect(() => {
    if (!usuario) {
      definirPerfil(null);
      return;
    }
    void carregarPerfil(usuario.uid, usuario.email ?? '', usuario.displayName ?? '');
  }, [usuario, carregarPerfil]);

  const valor = useMemo<ValorDaAutenticacao>(() => {
    const nomeParaExibir =
      perfil?.nome?.trim() ||
      usuario?.displayName?.trim() ||
      usuario?.email?.split('@')[0] ||
      'você';

    return {
      usuario,
      perfil,
      carregando,
      nomeParaExibir,
      entrarComGoogle,
      aceiteGooglePendente,
      confirmarAceiteGoogle: async () => {
        if (!usuario) throw new Error('Entre novamente para continuar.');
        await registrarAceiteLegal(usuario.uid);
        definirAceiteGooglePendente(false);
      },
      entrar: async (email, senha) => {
        await entrarNoFirebase(email, senha);
      },
      criarConta: async (nome, email, senha) => {
        await criarContaNoFirebase(nome, email, senha);
      },
      sair: async () => {
        await sairDoFirebase();
      },
      redefinirSenha: async (email) => {
        await enviarRedefinicaoDeSenha(email);
      },
      recarregarPerfil: async () => {
        if (usuario) await carregarPerfil(usuario.uid, usuario.email ?? '');
      },
      atualizarNome: async (nome) => {
        if (!usuario) throw new Error('Nenhum usuário autenticado.');
        await atualizarNomeNoFirebase(usuario.uid, nome);
        await carregarPerfil(usuario.uid, usuario.email ?? '');
      },
      atualizarEmail: async (novoEmail, senhaAtual) => {
        if (!usuario) throw new Error('Nenhum usuário autenticado.');
        await atualizarEmailNoFirebase(usuario.uid, novoEmail, senhaAtual);
        await carregarPerfil(usuario.uid, novoEmail);
      },
      atualizarSenha: async (senhaAtual, novaSenha) => {
        await atualizarSenhaNoFirebase(senhaAtual, novaSenha);
      },
      enviarVerificacaoEmail: async () => {
        await enviarVerificacaoEmail();
      },
    };
  }, [usuario, perfil, carregando, carregarPerfil, aceiteGooglePendente]);

  return (
    <ContextoAutenticacao.Provider value={valor}>{children}</ContextoAutenticacao.Provider>
  );
}

export function useAutenticacao(): ValorDaAutenticacao {
  const valor = useContext(ContextoAutenticacao);
  if (!valor) {
    throw new Error('useAutenticacao precisa estar dentro de <ProvedorDeAutenticacao>.');
  }
  return valor;
}
