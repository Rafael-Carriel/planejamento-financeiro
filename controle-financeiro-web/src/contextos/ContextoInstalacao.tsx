import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface EventoInstalacao extends Event { prompt:()=>Promise<void>; userChoice:Promise<{outcome:'accepted'|'dismissed'}> }
const ContextoInstalacao=createContext<{instalado:boolean; disponivel:boolean; instalar:()=>Promise<void>}|null>(null);
export function ProvedorDeInstalacao({children}:{children:ReactNode}) {
  const [evento, guardar]=useState<EventoInstalacao|null>(null);
  const [instalado, marcar]=useState(()=>matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone));
  useEffect(()=>{
    const aoDisponibilizar=(e:Event)=>{e.preventDefault();guardar(e as EventoInstalacao);};
    const aoInstalar=()=>{marcar(true);guardar(null);};
    window.addEventListener('beforeinstallprompt',aoDisponibilizar);
    window.addEventListener('appinstalled',aoInstalar);
    return ()=>{window.removeEventListener('beforeinstallprompt',aoDisponibilizar);window.removeEventListener('appinstalled',aoInstalar);};
  },[]);
  async function instalar(){
    if(!evento)return;
    guardar(null);
    await evento.prompt();
    await evento.userChoice; // appinstalled, rather than acceptance alone, confirms installation.
  }
  return <ContextoInstalacao.Provider value={{instalado,disponivel:Boolean(evento),instalar}}>{children}</ContextoInstalacao.Provider>;
}
export function useInstalacao(){const valor=useContext(ContextoInstalacao);if(!valor)throw new Error('Provedor de instalação ausente.');return valor;}
