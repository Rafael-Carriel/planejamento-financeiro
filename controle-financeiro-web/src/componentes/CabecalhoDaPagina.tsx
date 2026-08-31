import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { SeletorDeMes } from './SeletorDeMes';

/// Cabeçalho fixo da página: onde o usuário está, em que mês, e o que pode fazer.
interface Propriedades {
  titulo: string;
  descricao?: string;
  comSeletorDeMes?: boolean;
  acoes?: ReactNode;
  /// Quando informado, exibe um botão de voltar apontando para este caminho.
  voltarPara?: string;
}

export function CabecalhoDaPagina({
  titulo,
  descricao,
  comSeletorDeMes = true,
  acoes,
  voltarPara,
}: Propriedades) {
  return (
    <header className="cabecalho">
      <div className="cabecalho-linha-superior">
        {/* Botão voltar (opcional) */}
        {voltarPara ? (
          <Link
            to={voltarPara}
            className="cabecalho-voltar"
            aria-label="Voltar"
          >
            <span aria-hidden="true">‹</span>
          </Link>
        ) : null}

        {/* Título e descrição */}
        <div className="cabecalho-titulos">
          <h1 className="cabecalho-titulo">{titulo}</h1>
          {descricao ? (
            <p className="cabecalho-descricao texto-miudo">{descricao}</p>
          ) : null}
        </div>
      </div>

      {/* Seletor de mês e ações */}
      <div className="cabecalho-acoes">
        {comSeletorDeMes ? <SeletorDeMes /> : null}
        {acoes ? <div className="cabecalho-acoes-extras">{acoes}</div> : null}
      </div>
    </header>
  );
}
