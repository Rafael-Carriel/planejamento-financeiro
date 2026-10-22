import { useState } from 'react';
import { useInstalacao } from '../contextos/ContextoInstalacao';

export function InstalarAplicativo({mostrarInstrucoes=false}:{mostrarInstrucoes?:boolean}){
  const {instalado,disponivel,instalar}=useInstalacao();
  const [ajuda,mostrar]=useState(mostrarInstrucoes),[erro,falhar]=useState('');
  async function abrir(){
    falhar('');
    if(!disponivel){mostrar(!ajuda);return;}
    try{await instalar();}catch{falhar('O navegador não abriu a instalação. Use as instruções abaixo.');mostrar(true);}
  }
  return <section className="instalar-app" aria-label="Aplicativo Planeora">
    <button type="button" className="botao botao-contorno instalar-app-botao" disabled={instalado} onClick={()=>void abrir()} aria-expanded={!disponivel?ajuda:undefined}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/></svg>
      {instalado?'Aplicativo instalado':'Instalar aplicativo'}
    </button>
    <p className="instalar-app-legenda">No celular ou computador, direto pelo navegador.</p>
    {erro&&<p role="alert">{erro}</p>}
    {ajuda&&<div className="instalar-app-ajuda"><h3>Leve o Planeora com você</h3><p>Abra o endereço do Planeora no navegador do seu dispositivo.</p><ul><li><strong>Android:</strong> no menu do Chrome, escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</li><li><strong>iPhone e iPad:</strong> no Safari, toque em Compartilhar e em “Adicionar à Tela de Início”.</li><li><strong>Computador:</strong> no Chrome ou Edge, use o ícone de instalação na barra de endereço ou a opção “Instalar” no menu.</li></ul><p>Se a opção não aparecer, o navegador pode não oferecer instalação ou o aplicativo já pode estar instalado. Neste navegador integrado, abra o link no Chrome, Edge ou Safari.</p></div>}
  </section>;
}
