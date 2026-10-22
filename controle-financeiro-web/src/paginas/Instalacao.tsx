import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { InstalarAplicativo } from '../componentes/InstalarAplicativo';

export function Instalacao() {
  return <>
    <CabecalhoDaPagina titulo="Instalar Planeora" descricao="No celular e no computador." comSeletorDeMes={false} />
    <div className="painel-instalacao"><InstalarAplicativo mostrarInstrucoes /></div>
  </>;
}
