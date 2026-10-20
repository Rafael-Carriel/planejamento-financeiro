import { useState } from 'react';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { useAssinatura } from '../contextos/ContextoAssinatura';

export function VerificacaoDaConta() {
  const { usuario, enviarVerificacaoEmail } = useAutenticacao();
  const { atualizar } = useAssinatura();
  const [mensagem, informar] = useState('');
  const [ocupado, ocupar] = useState(false);
  async function executar(enviar: boolean) {
    ocupar(true); informar('');
    try {
      if (enviar) {
        await enviarVerificacaoEmail();
        informar('Enviamos o link para seu e-mail. Abra o link e depois clique em “Já confirmei meu e-mail”.');
      } else {
        await usuario?.reload();
        await usuario?.getIdToken(true);
        await atualizar();
        informar(usuario?.emailVerified ? 'E-mail confirmado.' : 'A confirmação ainda não apareceu. Confira também a pasta de spam.');
      }
    } catch (e) { informar(e instanceof Error ? e.message : 'Não foi possível verificar a conta.'); }
    finally { ocupar(false); }
  }
  if (!usuario || usuario.emailVerified) return null;
  return <section className="assinatura-aviso" aria-label="Verificação de e-mail">
    <p>Confirme seu e-mail para contratar um plano ou acessar a administração autorizada.</p>
    <div className="assinatura-verificacao-acoes">
      <button className="botao" disabled={ocupado} onClick={() => void executar(true)}>Enviar link de verificação</button>
      <button className="botao" disabled={ocupado} onClick={() => void executar(false)}>Já confirmei meu e-mail</button>
    </div>
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
