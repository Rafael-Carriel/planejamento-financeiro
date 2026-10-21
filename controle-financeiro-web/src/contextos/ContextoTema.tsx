import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';

type Tema = 'light' | 'dark';
const ContextoTema = createContext<{tema:Tema; alternarTema:()=>void} | null>(null);
export function ProvedorDeTema({children}:{children:ReactNode}) {
  const [tema, definirTema] = useState<Tema>(() => {
    const salvo=localStorage.getItem('theme');
    return salvo==='light'||salvo==='dark' ? salvo : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useLayoutEffect(()=>{document.documentElement.dataset.theme=tema;localStorage.setItem('theme',tema);},[tema]);
  return <ContextoTema.Provider value={{tema,alternarTema:()=>definirTema(t=>t==='dark'?'light':'dark')}}>{children}</ContextoTema.Provider>;
}
export function useTema() {
  const contexto=useContext(ContextoTema);
  if(!contexto) throw new Error('Provedor de tema ausente.');
  return contexto;
}
