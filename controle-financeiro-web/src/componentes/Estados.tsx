import type { ReactNode } from 'react';

/// Estados de tela que aparecem em várias páginas: carregando, vazio e erro.
///
/// Nenhum deles é decorativo. O vazio diz o que fazer para sair do vazio, e o
/// erro diz o que aconteceu e qual é o próximo passo — em vez de "algo deu
/// errado", que não ajuda ninguém.

export function Carregando({ mensagem = 'Carregando…' }: { mensagem?: string }) {
  return (
    <div className="carregando" role="status">
      <span className="girando" aria-hidden="true" />
      <span>{mensagem}</span>
    </div>
  );
}

interface PropriedadesDoVazio {
  selo?: string;
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}

export function EstadoVazio({ selo = '🧾', titulo, descricao, acao }: PropriedadesDoVazio) {
  return (
    <div className="estado-vazio">
      <span className="estado-vazio-selo" aria-hidden="true">
        {selo}
      </span>
      <h3>{titulo}</h3>
      <p>{descricao}</p>
      {acao}
    </div>
  );
}

export function FaixaDeErro({ mensagem }: { mensagem: string }) {
  return (
    <div className="faixa-erro" role="alert">
      <span aria-hidden="true">⚠</span>
      <span>{mensagem}</span>
    </div>
  );
}
