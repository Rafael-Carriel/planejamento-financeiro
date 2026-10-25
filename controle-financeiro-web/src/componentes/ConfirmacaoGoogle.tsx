import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { mensagemDeErro } from '../servicos/servicoAutenticacao';

export function ConfirmacaoGoogle() {
  const { usuario, confirmarAceiteGoogle, sair } = useAutenticacao();
  const [aceite, aceitar] = useState(false);
  const [ocupado, ocupar] = useState(false);
  const [erro, falhar] = useState('');
  async function confirmar() {
    if (!aceite) return;
    ocupar(true); falhar('');
    try { await confirmarAceiteGoogle(); }
    catch (e) { falhar(mensagemDeErro(e)); }
    finally { ocupar(false); }
  }
  return <main className="google-confirmacao"><section className="google-confirmacao-caixa">
    <img src="/logo-192.png" alt="Planeora" width="48" height="48" />
    <h1>Falta só uma confirmação</h1><p>Você entrou com {usuario?.email}. Antes de acessar o Planeora, leia os documentos e confirme abaixo.</p>
    <label className="aceite-legal"><input type="checkbox" checked={aceite} onChange={e=>aceitar(e.target.checked)} disabled={ocupado}/><span>Aceito os <Link to="/termos-de-uso" target="_blank" rel="noopener noreferrer">Termos de Uso</Link> e li a <Link to="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</Link>.</span></label>
    {erro&&<p role="alert">{erro}</p>}
    <button className="botao botao-principal" disabled={!aceite||ocupado} onClick={()=>void confirmar()}>{ocupado?'Confirmando…':'Concordar e acessar o Planeora'}</button>
    <button className="botao botao-contorno" disabled={ocupado} onClick={()=>void sair().catch(e=>falhar(mensagemDeErro(e)))}>Usar outra conta</button>
  </section></main>;
}
