import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

/// Envolve um cartão do Painel e liga-o ao layout personalizável.
///
/// Fora do modo de personalização é transparente: devolve o cartão direto, sem
/// moldura nem controles, exatamente como o Painel sempre foi. Ao entrar em
/// edição, vira uma peça arrastável com alça e olho (mostrar/ocultar).

interface Propriedades {
  id: string;
  titulo: string;
  editando: boolean;
  visivel: boolean;
  aoAlternarVisibilidade: () => void;
  children: ReactNode;
}

export function Widget({
  id,
  titulo,
  editando,
  visivel,
  aoAlternarVisibilidade,
  children,
}: Propriedades) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editando,
  });

  if (!editando) {
    return visivel ? <>{children}</> : null;
  }

  const classes = [
    'widget',
    'widget-editavel',
    visivel ? '' : 'widget-oculto',
    isDragging ? 'widget-arrastando' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={classes}
    >
      <div className="widget-controles">
        <button
          type="button"
          className="widget-alca"
          aria-label={`Arrastar ${titulo} para reordenar`}
          title="Arraste para reordenar"
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⠿</span>
        </button>

        <span className="widget-titulo">{titulo}</span>

        <button
          type="button"
          className="widget-olho"
          onClick={aoAlternarVisibilidade}
          aria-pressed={visivel}
          aria-label={visivel ? `Ocultar ${titulo}` : `Mostrar ${titulo}`}
          title={visivel ? 'Ocultar este cartão' : 'Mostrar este cartão'}
        >
          <span aria-hidden="true">{visivel ? '👁️' : '🙈'}</span>
        </button>
      </div>

      <div className="widget-conteudo">{children}</div>
    </div>
  );
}
