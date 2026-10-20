import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, startAfter, doc, updateDoc, serverTimestamp, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { bancoDeDados } from '../firebase/config';
type Pedido={id:string;uid:string;tipo:string;mensagem:string;status:string;criadoEm?:{toDate:()=>Date}};
export function SolicitacoesPrivacidade(){
  const [pedidos,definir]=useState<Pedido[]>([]); const [cursor,proximo]=useState<QueryDocumentSnapshot<DocumentData>|null>(null);
  const [mais,temMais]=useState(false); const [ocupado,ocupar]=useState(false); const [erro,falhar]=useState('');
  async function carregar(acrescentar=false){ocupar(true);falhar('');try{
    const base=collection(bancoDeDados,'solicitacoesPrivacidade');
    const pagina=await getDocs(query(base,orderBy('criadoEm','desc'),...(acrescentar&&cursor?[startAfter(cursor)]:[]),limit(50)));
    const itens=pagina.docs.map(d=>({id:d.id,...d.data()} as Pedido));
    definir(atual=>acrescentar?[...atual,...itens]:itens);proximo(pagina.docs.at(-1)??null);temMais(pagina.docs.length===50);
  }catch{falhar('Não foi possível carregar as solicitações de privacidade.');}finally{ocupar(false);}}
  async function atualizar(p:Pedido,status:string){ocupar(true);falhar('');try{
    await updateDoc(doc(bancoDeDados,'solicitacoesPrivacidade',p.id),{status,atualizadoEm:serverTimestamp()});
    definir(lista=>lista.map(item=>item.id===p.id?{...item,status}:item));
  }catch{falhar('Não foi possível atualizar o atendimento.');}finally{ocupar(false);}}
  useEffect(()=>{void carregar();},[]);
  return <section className="assinatura-card assinatura-historico"><h2>Solicitações de privacidade</h2><p>Verifique a identidade pelo cadastro antes de fornecer dados ou executar exclusões. Marcar o atendimento como concluído não apaga conta nem cancela mensalidade.</p>
    <button className="botao" disabled={ocupado} onClick={()=>void carregar()}>Atualizar solicitações</button>
    {erro&&<p role="alert">{erro}</p>}
    {pedidos.map(p=><article key={p.id}><h3>{p.tipo} · {p.status}</h3><p>Recebida em: {p.criadoEm?.toDate().toLocaleString('pt-BR')||'—'}<br/>Usuário: {p.uid}<br/>Protocolo: {p.id}</p><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{p.mensagem||'Sem mensagem adicional.'}</p>
      <label className="campo">Situação do atendimento<select aria-label={`Situação ${p.id}`} value={p.status} disabled={ocupado} onChange={e=>void atualizar(p,e.target.value)}><option value="recebida">Recebida</option><option value="em_analise">Em análise</option><option value="concluida">Atendimento concluído</option></select></label>
    </article>)}
    {!ocupado&&!pedidos.length&&!erro&&<p>Nenhuma solicitação registrada.</p>}
    {mais&&<button className="botao" disabled={ocupado} onClick={()=>void carregar(true)}>Carregar mais solicitações</button>}
  </section>;
}
