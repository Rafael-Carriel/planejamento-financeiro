import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { InstalarAplicativo } from '../componentes/InstalarAplicativo';

export function Instalacao() {
  return <>
    <CabecalhoDaPagina titulo="Aplicativo Planeora" descricao="Seu controle financeiro, sempre à mão." comSeletorDeMes={false} />
    <div className="painel-instalacao"><InstalarAplicativo mostrarInstrucoes /></div>
  </>;
}
