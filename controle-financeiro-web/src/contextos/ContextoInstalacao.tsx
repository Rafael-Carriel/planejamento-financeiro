import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { consumirEventoInstalacao, lerEventoInstalacao, observarInstalacao } from '../servicos/instalacao';
type Resultado = 'accepted' | 'dismissed' | 'unavailable';
const ContextoInstalacao = createContext<{
  instalado: boolean; disponivel: boolean; instalando: boolean;
  instalar: () => Promise<Resultado>;
} | null>(null);
const estaInstalado = () => matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
export function ProvedorDeInstalacao({ children }: { children: ReactNode }) {
  const evento = useSyncExternalStore(observarInstalacao, lerEventoInstalacao);
  const [instalado, marcar] = useState(estaInstalado);
  const [instalando, definirInstalando] = useState(false);
  const emAndamento = useRef(false);
  useEffect(() => {
    const media = matchMedia('(display-mode: standalone)');
    const aoInstalar = () => marcar(true);
    const aoMudar = () => marcar(estaInstalado());
    window.addEventListener('appinstalled', aoInstalar);
    media.addEventListener('change', aoMudar);
    return () => { window.removeEventListener('appinstalled', aoInstalar); media.removeEventListener('change', aoMudar); };
  }, []);
  async function instalar(): Promise<Resultado> {
    if (emAndamento.current) return 'unavailable';
    const atual = consumirEventoInstalacao();
    if (!atual) return 'unavailable';
    emAndamento.current = true;
    definirInstalando(true);
    try {
      await atual.prompt();
      return (await atual.userChoice).outcome;
    } finally { definirInstalando(false); emAndamento.current = false; }
  }
  return <ContextoInstalacao.Provider value={{ instalado, disponivel: Boolean(evento), instalando, instalar }}>{children}</ContextoInstalacao.Provider>;
}
export function useInstalacao() {
  const valor = useContext(ContextoInstalacao);
  if (!valor) throw new Error('Provedor de instalação ausente.');
  return valor;
}
