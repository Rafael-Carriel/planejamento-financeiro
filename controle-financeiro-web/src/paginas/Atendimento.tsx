import { ATENDIMENTO } from '../legal';
import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { AcoesPublicas } from '../componentes/AcoesPublicas';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { bancoDeDados } from '../firebase/config';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import './privacidade.css';

type Chamado = { id:string; uid:string; assunto:string; mensagem:string; resposta:string; status:string };
export function Chamados({administrador=false}:{administrador?:boolean}) {
  const {usuario}=useAutenticacao();
  const [itens, listar]=useState<Chamado[]>([]), [erro, falhar]=useState(''), [ocupado, ocupar]=useState(false);
  const [assunto, definirAssunto]=useState('Suporte'), [mensagem, escrever]=useState('');
  const [respostas, responder]=useState<Record<string,string>>({});
  const [protocolo, definirProtocolo]=useState(()=>crypto.randomUUID());
  async function carregar() {
    if(!usuario) return;
    ocupar(true); falhar('');
    try {
      const base=collection(bancoDeDados,'chamadosAtendimento');
      const resultado=await getDocs(administrador ? query(base,orderBy('criadoEm','desc'),limit(100)) : query(base,where('uid','==',usuario.uid)));
      listar(resultado.docs.map(d=>({id:d.id,...d.data()} as Chamado)));
    } catch { falhar('Não foi possível carregar os atendimentos. Tente novamente.'); } finally { ocupar(false); }
  }
  useEffect(()=>{void carregar();},[usuario?.uid,administrador]);
  async function enviar(e:FormEvent) {
    e.preventDefault(); if(!usuario?.emailVerified) {falhar('Confirme seu e-mail para enviar um pedido.');return;}
    ocupar(true);falhar('');
    try {
      await setDoc(doc(bancoDeDados,'chamadosAtendimento',protocolo),{uid:usuario.uid,assunto,mensagem:mensagem.trim(),resposta:'',status:'recebido',criadoEm:serverTimestamp()});
      escrever('');definirProtocolo(crypto.randomUUID());await carregar();
    } catch { falhar('Não foi possível enviar. Tente novamente; o protocolo será preservado.'); } finally {ocupar(false);}
  }
  async function salvar(item:Chamado) {
    ocupar(true);falhar('');
    try {await updateDoc(doc(bancoDeDados,'chamadosAtendimento',item.id),{resposta:respostas[item.id]?.trim()??item.resposta,status:'respondido',atualizadoEm:serverTimestamp()});await carregar();}
    catch {falhar('Não foi possível salvar a resposta.');}finally{ocupar(false);}
  }
  if(!usuario) return <p><Link to="/entrar">Entre na sua conta</Link> para abrir e acompanhar um atendimento. Se esqueceu a senha, use “Esqueci minha senha” na entrada.</p>;
  return <section className="sac-chamados"><h2>{administrador?'SAC — últimos 100 atendimentos':'Seus atendimentos'}</h2>
    {!administrador&&<form onSubmit={e=>void enviar(e)}><p>O atendimento é feito pelo Planeora. Não envie senhas, códigos de acesso ou dados completos de cartão.</p>
      <label className="campo">Assunto<select value={assunto} onChange={e=>definirAssunto(e.target.value)}>{['Suporte','Pagamento e cancelamento','Privacidade e dados','Reclamação'].map(a=><option key={a}>{a}</option>)}</select></label>
      <label className="campo">Mensagem<textarea placeholder="Conte o que aconteceu e como podemos ajudar…" required minLength={5} maxLength={2000} value={mensagem} onChange={e=>escrever(e.target.value)} /></label>
      <button className="botao botao-principal" disabled={ocupado||!usuario.emailVerified}>{ocupado ? 'Aguarde…' : 'Enviar mensagem'}</button>{!usuario.emailVerified && <p role="status">Confirme seu e-mail para enviar uma mensagem.</p>}</form>}
    <button className="botao botao-texto sac-atualizar" disabled={ocupado} onClick={()=>void carregar()}>Atualizar atendimentos</button>
    {erro&&<p role="alert">{erro}</p>}
    {!ocupado&&!itens.length&&!erro&&<p>Tudo certo por aqui. Seus atendimentos aparecerão neste espaço.</p>}
    {itens.map(item=><article key={item.id} style={{overflowWrap:'anywhere',borderTop:'1px solid var(--borda)',paddingBlock:16}}><h3>{item.assunto} · {item.status}</h3><p>Protocolo: {item.id}</p>
      <p style={{whiteSpace:'pre-wrap'}}>{item.mensagem}</p><p style={{whiteSpace:'pre-wrap'}}><strong>Planeora: </strong>{item.resposta||'Aguardando atendimento.'}</p>
      {administrador&&<><label className="campo">Resposta ao protocolo {item.id}<textarea maxLength={2000} value={respostas[item.id]??item.resposta} onChange={e=>responder({...respostas,[item.id]:e.target.value})}/></label><button className="botao botao-principal" disabled={ocupado||!(respostas[item.id]??item.resposta).trim()} onClick={()=>void salvar(item)}>Publicar resposta</button></>}
    </article>)}
    {!administrador&&<p>Para complementar um pedido, abra outro atendimento citando o protocolo anterior. Acompanhe as respostas nesta página; não enviamos aviso por e-mail.</p>}
  </section>;
}
export function Atendimento({integrado=false}:{integrado?:boolean}) {
  return <>{integrado && <CabecalhoDaPagina titulo="Central de ajuda" descricao="Estamos aqui para ajudar você." comSeletorDeMes={false} />}<div className={integrado ? "pagina pagina-atendimento atendimento-integrado" : "documento-legal pagina-atendimento"}>
    {!integrado && <><AcoesPublicas /><span className="publico-selo">CENTRAL DE AJUDA</span><h1>SAC do Planeora</h1></>}
    <div className="ajuda-introducao"><span className="publico-selo">VAMOS RESOLVER JUNTOS</span><h2>Como podemos ajudar?</h2><p>Encontre uma resposta rápida ou fale com nossa equipe. Seus pedidos ficam reunidos aqui.</p></div><section className="ajuda-contato"><h2>Precisa de ajuda para acessar?</h2><p>Você também pode falar com o Planeora sem entrar na conta: <a href={`mailto:${ATENDIMENTO.email}`}>{ATENDIMENTO.email}</a>.</p><p>Não envie senhas, códigos de acesso ou dados completos de cartão. Informe apenas o problema e como podemos ajudar.</p></section><div className="ajuda-grade"><section className="ajuda-perguntas"><h2>Perguntas frequentes</h2>
    <details><summary>Como funciona a mensalidade?</summary><p>O plano gratuito inclui 20 lançamentos por mês. O Ilimitado custa R$19,90/mês e libera novos registros sem limite após confirmação do pagamento. Planos antigos mantêm as condições contratadas.</p></details>
    <details><summary>Como cancelo ou peço reembolso?</summary><p>Cancele a renovação em Assinatura. Para dúvidas ou pedido de reembolso, abra um atendimento em “Pagamento e cancelamento”. O pedido será analisado conforme os direitos aplicáveis.</p></details>
    <details><summary>Como baixo ou excluo meus dados?</summary><p>Acesse <Link to="/privacidade">Privacidade e direitos</Link> para exportar dados e solicitar exclusão. A exclusão depende de verificação e eventuais obrigações legais de conservação.</p></details>
    </section><Chamados/></div><nav className="links-legais"><Link to="/politica-de-privacidade">Privacidade</Link><Link to="/termos-de-uso">Termos de Uso</Link></nav>
  </div></>;
}
