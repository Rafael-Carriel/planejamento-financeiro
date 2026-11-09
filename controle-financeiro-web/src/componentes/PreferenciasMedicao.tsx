import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { escolhaMetricas, escolherMetricas, medir, metricasDisponiveis } from '../servicos/metricas';
export function PreferenciasMedicao() {
  const [escolha, definir] = useState(escolhaMetricas);
  const [aberto, abrir] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    const ouvir = () => definir(escolhaMetricas()); window.addEventListener('planeora:metricas', ouvir);
    return () => window.removeEventListener('planeora:metricas', ouvir);
  }, []);
  useEffect(() => { if (pathname === '/' || pathname === '/conheca') void medir('landing_view'); }, [pathname, escolha]);
  if (!metricasDisponiveis) return null;
  return <aside className="preferencias-medicao" aria-label="Preferências de medição">
    {(!escolha || aberto) ? <><p>Podemos medir visitas e etapas de uso para melhorar o Planeora? A escolha é opcional. Não coletamos os valores nem as descrições das suas finanças para essa medição.</p><Link to="/politica-de-privacidade">Como usamos os dados</Link><div><button className="botao botao-contorno" onClick={() => { escolherMetricas(false); abrir(false); }}>Recusar medição</button><button className="botao botao-principal" onClick={() => { escolherMetricas(true); abrir(false); }}>Permitir medição</button></div></> : <button className="botao-texto" onClick={() => abrir(true)}>Preferências de medição</button>}
  </aside>;
}
