import { useCallback, useEffect, useState } from 'react';

/// Dicas de educação financeira num carrossel simples.
///
/// É o widget "extra" do Painel: conteúdo estático, sem dados do Firestore, que
/// gira sozinho a cada 8 segundos — o suficiente para exibir uma ideia sem que
/// o usuário precise interagir. As setas e os pontos dão controle manual.

interface Dica {
  emoji: string;
  titulo: string;
  texto: string;
}

const DICAS: Dica[] = [
  {
    emoji: '🎯',
    titulo: 'Pague-se primeiro',
    texto:
      'Assim que a renda entrar, separe uma parte para os objetivos antes de gastar. O que sobra é o que você pode gastar sem culpa.',
  },
  {
    emoji: '📊',
    titulo: 'Acompanhe por categoria',
    texto:
      'Lançar cada gasto na categoria certa mostra para onde o dinheiro vai e onde dá para cortar sem dor.',
  },
  {
    emoji: '🏦',
    titulo: 'Construa a reserva de emergência',
    texto:
      'Mire de 3 a 6 meses de despesas guardados num lugar de resgate fácil antes de assumir riscos maiores.',
  },
  {
    emoji: '💳',
    titulo: 'Fuja do rotativo do cartão',
    texto:
      'O rotativo tem alguns dos juros mais altos do mercado. Se a fatura não fechar, negocie antes de parcelar e pagar o mínimo.',
  },
  {
    emoji: '🧾',
    titulo: 'Revise os gastos fixos',
    texto:
      'Assinaturas e planos esquecidos pesam no fim do mês. Uma revisão a cada trimestre costuma liberar um bom dinheiro.',
  },
  {
    emoji: '🤖',
    titulo: 'Automatize o que puder',
    texto:
      'Débito automático de contas e aportes evita esquecimento e libera sua atenção para as decisões que importam.',
  },
];

const INTERVALO_DO_GIRO = 8000;

export function DicasFinanceiras() {
  const [indice, definirIndice] = useState(0);
  const total = DICAS.length;

  const irPara = useCallback(
    (destino: number) => {
      definirIndice(((destino % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    const relogio = window.setInterval(() => {
      definirIndice((atual) => (atual + 1) % total);
    }, INTERVALO_DO_GIRO);
    return () => window.clearInterval(relogio);
  }, [total]);

  const dica = DICAS[indice];

  return (
    <section className="cartao">
      <div className="cartao-cabeca">
        <h2>Dicas financeiras</h2>
        <span className="texto-miudo">
          {indice + 1} de {total}
        </span>
      </div>

      <div className="cartao-corpo">
        <div className="dica-financeira" aria-live="polite">
          <span className="dica-financeira-emoji" aria-hidden="true">
            {dica.emoji}
          </span>
          <div className="dica-financeira-textos">
            <h3 className="dica-financeira-titulo">{dica.titulo}</h3>
            <p className="dica-financeira-texto">{dica.texto}</p>
          </div>
        </div>

        <div className="dica-financeira-rodape">
          <button
            type="button"
            className="botao-texto"
            onClick={() => irPara(indice - 1)}
            aria-label="Dica anterior"
          >
            ‹ Anterior
          </button>

          <div className="dica-financeira-pontos">
            {DICAS.map((item, posicao) => (
              <button
                key={item.titulo}
                type="button"
                className={`dica-ponto${posicao === indice ? ' ativo' : ''}`}
                onClick={() => irPara(posicao)}
                aria-label={`Ir para a dica ${posicao + 1}: ${item.titulo}`}
                aria-current={posicao === indice}
              />
            ))}
          </div>

          <button
            type="button"
            className="botao-texto"
            onClick={() => irPara(indice + 1)}
            aria-label="Próxima dica"
          >
            Próxima ›
          </button>
        </div>
      </div>
    </section>
  );
}
