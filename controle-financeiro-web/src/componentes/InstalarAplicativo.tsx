import { useState } from 'react';
import { useInstalacao } from '../contextos/ContextoInstalacao';
import { Icone } from './Icone';

export function InstalarAplicativo({ mostrarInstrucoes = false }: { mostrarInstrucoes?: boolean }) {
  const { instalado, disponivel, instalando, instalar } = useInstalacao();
  const [ajuda, mostrarAjuda] = useState(mostrarInstrucoes);
  const [recado, informar] = useState('');
  const [copiado, marcarCopiado] = useState(false);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  async function abrir() {
    informar('');
    try {
      const resultado = await instalar();
      if (resultado === 'dismissed') informar('Instalação cancelada. Você pode tentar novamente pelo menu do navegador.');
      if (resultado === 'accepted') informar('Pedido aceito. Aguarde o navegador concluir a instalação.');
      if (resultado === 'unavailable') mostrarAjuda(true);
    } catch { informar('Não foi possível abrir a instalação. Veja as opções abaixo.'); mostrarAjuda(true); }
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(window.location.origin + '/'); marcarCopiado(true); }
    catch { informar('Copie o endereço da barra do navegador para abrir em outro navegador.'); }
  }
  return <section className={`instalar-app${!mostrarInstrucoes ? ' instalar-app-compacta' : ''}`} aria-label="Aplicativo Planeora">
    <div className="instalar-app-simbolo"><Icone nome={instalado ? 'reserva' : 'instalar'} /></div>
    <span className="publico-selo">SEU PLANEJAMENTO SEMPRE POR PERTO</span>
    <h2>{instalado ? 'O Planeora já está com você' : 'Suas finanças a um toque'}</h2>
    <p className="instalar-app-legenda">Abra direto da tela inicial, em uma janela só sua. Sem procurar a aba do navegador.</p>
    <div className="instalar-beneficios"><span><Icone nome="painel" /> Acesso rápido</span><span><Icone nome="reserva" /> Mesma conta</span><span><Icone nome="recorrencias" /> Sempre atualizado</span></div>
    {instalado ? <p className="instalacao-estado" role="status">Aplicativo instalado neste dispositivo.</p> : disponivel ?
      <button type="button" className="botao botao-principal instalar-app-botao" disabled={instalando} onClick={() => void abrir()}><Icone nome="instalar" />{instalando ? 'Abrindo instalação…' : 'Instalar Planeora'}</button> :
      <><p className="instalacao-estado">{ios ? 'No iPhone e iPad, adicione pelo menu Compartilhar do Safari.' : 'A instalação direta ainda não foi disponibilizada por este navegador.'}</p><button type="button" className="botao botao-contorno" aria-expanded={ajuda} aria-controls="ajuda-instalacao" onClick={() => mostrarAjuda(!ajuda)}>{ajuda ? 'Ocultar orientações' : 'Ver como adicionar ao dispositivo'}</button></>}
    <p role="status" className="instalacao-recado">{recado}</p>
    {!instalado && ajuda && <div id="ajuda-instalacao" className="instalar-app-ajuda"><h3>Escolha seu dispositivo</h3>
      <div className="instalacao-passos"><div><strong>Android</strong><p>Abra no Chrome. No menu ⋮, toque em “Instalar aplicativo” ou “Adicionar à tela inicial”.</p></div><div><strong>iPhone ou iPad</strong><p>Abra no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.</p></div><div><strong>Computador</strong><p>Abra no Chrome ou Edge e use o ícone de instalação na barra de endereço.</p></div></div>
      <div className="instalacao-alternativa"><p>Está em um navegador integrado? Copie o link e abra no navegador do seu dispositivo. Se já instalou, procure o Planeora entre seus aplicativos.</p><button type="button" className="botao botao-contorno" onClick={() => void copiar()}>{copiado ? 'Link copiado' : 'Copiar link do aplicativo'}</button></div>
    </div>}
  </section>;
}
