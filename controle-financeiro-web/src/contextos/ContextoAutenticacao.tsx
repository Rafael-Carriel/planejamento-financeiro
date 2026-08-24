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
  enviarRedefinicaoDeSenha,
  garantirPerfil,
  lerPerfil,
  observarUsuario,
  sair as sairDoFirebase,
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
  criarConta: (nome: string, email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  redefinirSenha: (email: string) => Promise<void>;
  recarregarPerfil: () => Promise<void>;
}

const ContextoAutenticacao = createContext<ValorDaAutenticacao | null>(null);

export function ProvedorDeAutenticacao({ children }: { children: ReactNode }) {
  const [usuario, definirUsuario] = useState<User | null>(null);
  const [perfil, definirPerfil] = useState<Perfil | null>(null);
  const [carregando, definirCarregando] = useState(true);

  useEffect(() => {
    const encerrar = observarUsuario((usuarioAtual) => {
      definirUsuario(usuarioAtual);
      definirCarregando(false);
    });
    return encerrar;
  }, []);

  const carregarPerfil = useCallback(async (uid: string, email: string) => {
    try {
      await garantirPerfil(uid, '', email);
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
    void carregarPerfil(usuario.uid, usuario.email ?? '');
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
    };
  }, [usuario, perfil, carregando, carregarPerfil]);

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
