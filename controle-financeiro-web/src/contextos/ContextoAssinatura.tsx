import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { chamarCobranca, cobrancaConfigurada, type Assinatura } from '../servicos/servicoAssinatura';
import { useAutenticacao } from './ContextoAutenticacao';

interface Contexto { assinatura: Assinatura | null; carregando: boolean; erro: string | null; atualizar: () => Promise<void> }
const Contexto = createContext<Contexto | null>(null);

export function ProvedorDeAssinatura({ children }: { children: ReactNode }) {
  const { usuario } = useAutenticacao();
  const [assinatura, definir] = useState<Assinatura | null>(null);
  const [carregando, carregar] = useState(cobrancaConfigurada);
  const [erro, falhar] = useState<string | null>(null);
  const sequencia = useRef(0);
  const atualizar = useCallback(async () => {
    const pedido = ++sequencia.current;
    if (!usuario || !cobrancaConfigurada) { definir(null); carregar(false); return; }
    carregar(true); falhar(null);
    try {
      const data = await chamarCobranca<Assinatura>('/me');
      if (pedido === sequencia.current) definir(data);
    }
    catch (e) { if (pedido === sequencia.current) falhar(e instanceof Error ? e.message : 'Não foi possível consultar sua assinatura.'); }
    finally { if (pedido === sequencia.current) carregar(false); }
  }, [usuario]);
  useEffect(() => {
    definir(null);
    void atualizar();
    const aoAtualizar = () => { void atualizar(); };
    window.addEventListener('planeja:consumo', aoAtualizar);
    window.addEventListener('focus', aoAtualizar);
    return () => {
      sequencia.current++;
      window.removeEventListener('planeja:consumo', aoAtualizar);
      window.removeEventListener('focus', aoAtualizar);
    };
  }, [atualizar]);
  useEffect(() => {
    if (!usuario || !cobrancaConfigurada) return;
    const sincronizar = async () => {
      if (document.visibilityState !== 'visible') return;
      try { await chamarCobranca('/sync', {}); await atualizar(); } catch { /* Retry on next interval; /me reports availability. */ }
    };
    void sincronizar();
    const intervalo = window.setInterval(() => void sincronizar(), 120000);
    return () => window.clearInterval(intervalo);
  }, [usuario, atualizar]);
  return <Contexto.Provider value={{ assinatura, carregando, erro, atualizar }}>{children}</Contexto.Provider>;
}
export function useAssinatura() {
  const value = useContext(Contexto);
  if (!value) throw new Error('Provedor de assinatura ausente.');
  return value;
}
