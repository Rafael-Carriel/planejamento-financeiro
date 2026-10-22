import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAutenticacao } from './ContextoAutenticacao';
import { combinarLembretes, gerarLembretes } from '../dominio/lembretes';
import { observarLembretes, registrarEstadoLembrete, type Lembrete } from '../servicos/servicoLembretes';
import { observarRecorrencias } from '../servicos/servicoRecorrencias';
import { observarDividas } from '../servicos/servicoDividas';
import { observarTransacoes } from '../servicos/servicoTransacoes';
import { observarOrcamento } from '../servicos/servicoOrcamentos';
import { chaveDoMes, hoje, inicioDoMes, inicioDoProximoMes } from '../utilitarios/datas';
import type { Divida, Orcamento, Recorrencia, Transacao } from '../tipos';

interface Fontes { salvos:Lembrete[]; recorrencias:Recorrencia[]; dividas:Divida[]; transacoes:Transacao[]; orcamento:Orcamento; pronto:boolean; erro:string|null }
const vazio=():Fontes=>({salvos:[],recorrencias:[],dividas:[],transacoes:[],orcamento:{mes:'',limites:{},atualizadoEm:null},pronto:false,erro:null});
const Contexto=createContext<{lembretes:Lembrete[];naoLidos:number;carregando:boolean;erro:string|null;marcar:(l:Lembrete)=>Promise<void>;dispensar:(l:Lembrete)=>Promise<void>}|null>(null);
export function ProvedorDeLembretes({children}:{children:ReactNode}){
  const {usuario}=useAutenticacao();
  const uid=usuario?.uid;
  const [referencia,reavaliar]=useState(hoje);
  const [fontes,receber]=useState<Fontes>(vazio);
  const mes=chaveDoMes(referencia);
  useEffect(()=>{
    const atualizar=()=>reavaliar(atual=>{const novo=hoje();return novo.getTime()===atual.getTime()?atual:novo;});
    const agora=new Date(),amanha=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate()+1,0,0,1);
    const timer=window.setTimeout(atualizar,amanha.getTime()-agora.getTime());
    window.addEventListener('focus',atualizar);document.addEventListener('visibilitychange',atualizar);
    return()=>{clearTimeout(timer);window.removeEventListener('focus',atualizar);document.removeEventListener('visibilitychange',atualizar);};
  },[referencia]);
  useEffect(()=>{
    receber(vazio());if(!uid)return;
    let vivo=true;const cache=vazio(),prontos=new Set<string>(),falhas=new Set<string>();
    const publicar=()=>{if(vivo)receber({...cache,pronto:prontos.size===5,erro:falhas.size?'Não foi possível atualizar todos os lembretes. Confira a conexão e tente recarregar.':null});};
    function sucesso<K extends 'salvos'|'recorrencias'|'dividas'|'transacoes'|'orcamento'>(nome:K){return(valor:Fontes[K])=>{cache[nome]=valor;prontos.add(nome);falhas.delete(nome);publicar();};}
    const erro=(nome:string)=>()=>{prontos.add(nome);falhas.add(nome);publicar();};
    const data=new Date(`${mes}-01T00:00:00`);
    // Includes next month's first days for the three-day due-date window.
    const fim=inicioDoProximoMes(inicioDoProximoMes(data));
    const parar=[observarLembretes(uid,sucesso('salvos'),erro('salvos')),observarRecorrencias(uid,sucesso('recorrencias'),erro('recorrencias')),observarDividas(uid,sucesso('dividas'),erro('dividas')),observarTransacoes(uid,inicioDoMes(data),fim,sucesso('transacoes'),erro('transacoes')),observarOrcamento(uid,mes,sucesso('orcamento'),erro('orcamento'))];
    return()=>{vivo=false;parar.forEach(encerrar=>encerrar());};
  },[uid,mes]);
  const lembretes=useMemo(()=>combinarLembretes(fontes.pronto&&!fontes.erro?gerarLembretes({...fontes,referencia}):[],fontes.salvos),[fontes,referencia]);
  async function alterar(l:Lembrete,descartado:boolean){if(!uid)throw new Error('Entre novamente.');await registrarEstadoLembrete(uid,l,descartado);}
  return <Contexto.Provider value={{lembretes,naoLidos:lembretes.filter(l=>!l.lido).length,carregando:!fontes.pronto,erro:fontes.erro,marcar:l=>alterar(l,false),dispensar:l=>alterar(l,true)}}>{children}</Contexto.Provider>;
}
export function useLembretes(){const valor=useContext(Contexto);if(!valor)throw new Error('Provedor de lembretes ausente.');return valor;}
