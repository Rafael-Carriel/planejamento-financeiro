import { useEffect, useRef, type ReactNode } from 'react';

/// Caixa de diálogo.
///
/// Cuida do que se espera de um modal e costuma faltar: fecha no Esc, fecha ao
/// clicar fora, tranca o rolamento do fundo e devolve o foco para o elemento que
/// abriu a caixa quando ela fecha.

interface Propriedades {
  titulo: string;
  descricao?: string;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largo?: boolean;
}

export function Modal({
  titulo,
  descricao,
  aoFechar,
  children,
  rodape,
  largo = false,
}: Propriedades) {
  const caixa = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const focoAnterior = document.activeElement as HTMLElement | null;
    const rolagemAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Leva o foco para dentro do modal: o primeiro campo, se houver.
    const alvo = caixa.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-fechar])',
    );
    alvo?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        aoFechar();
      }
    }

    document.addEventListener('keydown', aoTeclar);

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = rolagemAnterior;
      focoAnterior?.focus?.();
    };
  }, [aoFechar]);

  return (
    <div
      className="fundo-modal"
      data-modal-animacao="escala"
      onMouseDown={(evento) => {
        // Só fecha se o clique começou no fundo. Sem esta checagem, arrastar a
        // seleção de um texto de dentro para fora fecharia o modal.
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div
        className={`modal${largo ? ' modal-largo' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        aria-describedby={descricao ? 'modal-descricao' : undefined}
        ref={caixa}
      >
        {/* Cabeçalho */}
        <header className="modal-cabeca">
          <div className="modal-cabeca-textos">
            <h2 id="modal-titulo" className="modal-titulo">
              {titulo}
            </h2>
            {descricao ? (
              <p id="modal-descricao" className="modal-descricao texto-miudo">
                {descricao}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="botao-icone modal-fechar"
            onClick={aoFechar}
            aria-label="Fechar"
            data-fechar="sim"
          >
            ✕
          </button>
        </header>

        {/* Corpo */}
        <div className="modal-corpo">{children}</div>

        {/* Rodapé */}
        {rodape ? (
          <footer className="modal-rodape">{rodape}</footer>
        ) : null}
      </div>
    </div>
  );
}
