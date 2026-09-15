import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { observarLembretes } from '../servicos/servicoLembretes';

/// Sino de lembretes da tira superior (celular): mostra quantos avisos ainda
/// não foram lidos e leva à página de lembretes.
///
/// A contagem é ao vivo: marcar um lembrete como lido em outra aba derruba o
/// contador aqui na hora. Sem não lidos, o contador some e resta o sino.
export function BotaoLembrete() {
  const { usuario } = useAutenticacao();
  const uid = usuario?.uid ?? null;
  const navegar = useNavigate();

  const [naoLidos, definirNaoLidos] = useState(0);

  useEffect(() => {
    if (!uid) return;

    const encerrar = observarLembretes(
      uid,
      (lembretes) =>
        definirNaoLidos(lembretes.filter((lembrete) => !lembrete.lido).length),
      // Sem contagem não há o que anunciar: o sino fica limpo e a página
      // cuida de mostrar o erro com mais contexto.
      () => definirNaoLidos(0),
    );

    return encerrar;
  }, [uid]);

  return (
    <button
      type="button"
      className="botao-lembrete"
      onClick={() => navegar('/lembretes')}
      aria-label={
        naoLidos === 0
          ? 'Lembretes'
          : `${naoLidos} ${naoLidos === 1 ? 'lembrete não lido' : 'lembretes não lidos'}`
      }
    >
      <span aria-hidden="true">🔔</span>
      {naoLidos > 0 ? (
        <span className="selo-situacao selo-atencao selo-contador" aria-hidden="true">
          {naoLidos > 9 ? '9+' : naoLidos}
        </span>
      ) : null}
    </button>
  );
}
