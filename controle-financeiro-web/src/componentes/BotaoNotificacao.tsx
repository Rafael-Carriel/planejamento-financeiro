import { useEffect, useState } from 'react';

import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import {
  lerTokenSalvo,
  mensagemDeErroDeNotificacao,
  removerToken,
  solicitarPermissao,
} from '../servicos/servicoNotificacoes';

/// Sino de notificações push: liga e desliga os avisos que o backend manda.
///
/// O estado vem do Firestore (`configuracoes.notificacoes`), não da permissão
/// do navegador — permissão concedida não pode ser revogada por código, então
/// é o token salvo que decide se o aviso chega. O ícone mostra o estado
/// atual; o rótulo, o que o clique faz.
///
/// `comRotulo` desenha a versão com texto, para o rodapé da barra lateral no
/// computador; sem ele vira o chip redondo da tira do celular — o mesmo
/// truque de CSS que o botão de tema usa com a classe botao-tema.
export function BotaoNotificacao({ comRotulo = false }: { comRotulo?: boolean }) {
  const { usuario } = useAutenticacao();
  const uid = usuario?.uid ?? null;

  const [ativo, definirAtivo] = useState(false);
  const [processando, definirProcessando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  // Estado inicial: existe token salvo para este usuário?
  useEffect(() => {
    let encerrado = false;

    if (!uid) {
      definirAtivo(false);
      return;
    }

    lerTokenSalvo(uid)
      .then((token) => {
        if (!encerrado) definirAtivo(token !== null);
      })
      .catch((falha: unknown) => {
        // Sem saber o estado, o mais honesto é mostrar desligado: quem quiser
        // ativar tenta, e o erro real aparece com contexto no lugar certo.
        if (!encerrado) {
          definirAtivo(false);
          console.warn('Não foi possível ler o token de notificação.', falha);
        }
      });

    return () => {
      encerrado = true;
    };
  }, [uid]);

  async function alternar() {
    definirProcessando(true);
    definirErro(null);

    try {
      if (ativo) {
        await removerToken();
        definirAtivo(false);
      } else {
        await solicitarPermissao();
        definirAtivo(true);
      }
    } catch (falha: unknown) {
      definirErro(mensagemDeErroDeNotificacao(falha));
    } finally {
      definirProcessando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="botao-tema"
        onClick={() => void alternar()}
        disabled={processando}
        aria-label={ativo ? 'Desativar notificações' : 'Ativar notificações'}
      >
        <span aria-hidden="true">{ativo ? '🔔' : '🔕'}</span>
        {comRotulo ? (ativo ? 'Desativar avisos' : 'Ativar avisos') : null}
      </button>
      {erro ? (
        <div className="aviso aviso-erro" role="alert">
          {erro}
        </div>
      ) : null}
    </>
  );
}
