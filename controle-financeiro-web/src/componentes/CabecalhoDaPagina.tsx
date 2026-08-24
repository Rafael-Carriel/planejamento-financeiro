import type { ReactNode } from 'react';

import { SeletorDeMes } from './SeletorDeMes';

/// Cabeçalho fixo da página: onde o usuário está, em que mês, e o que pode fazer.
interface Propriedades {
  titulo: string;
  descricao?: string;
  comSeletorDeMes?: boolean;
  acoes?: ReactNode;
}

export function CabecalhoDaPagina({
  titulo,
  descricao,
  comSeletorDeMes = true,
  acoes,
}: Propriedades) {
  return (
    <header className="cabecalho">
      <div className="cabecalho-titulos">
        <h1>{titulo}</h1>
        {descricao ? <p className="texto-miudo">{descricao}</p> : null}
      </div>

      <div className="cabecalho-acoes">
        {comSeletorDeMes ? <SeletorDeMes /> : null}
        {acoes}
      </div>
    </header>
  );
}
