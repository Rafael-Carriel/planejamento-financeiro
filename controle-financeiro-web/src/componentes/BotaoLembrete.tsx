
import { useNavigate } from 'react-router-dom';

import { useLembretes } from '../contextos/ContextoLembretes';

/// Sino de lembretes da tira superior (celular): mostra quantos avisos ainda
/// não foram lidos e leva à página de lembretes.
///
/// A contagem é ao vivo: marcar um lembrete como lido em outra aba derruba o
/// contador aqui na hora. Sem não lidos, o contador some e resta o sino.
export function BotaoLembrete({comRotulo=false}:{comRotulo?:boolean}) {
  const {naoLidos}=useLembretes();
  const navegar=useNavigate();
  return (
    <button
      type="button"
      className={comRotulo?"botao-tema botao-lembrete":"botao-lembrete"}
      onClick={() => navegar('/lembretes')}
      aria-label={
        naoLidos === 0
          ? 'Lembretes'
          : `${naoLidos} ${naoLidos === 1 ? 'lembrete não lido' : 'lembretes não lidos'}`
      }
    >
      <span aria-hidden="true">🔔</span>{comRotulo&&<span>Lembretes</span>}
      {naoLidos > 0 ? (
        <span className="selo-situacao selo-atencao selo-contador" aria-hidden="true">
          {naoLidos > 9 ? '9+' : naoLidos}
        </span>
      ) : null}
    </button>
  );
}
