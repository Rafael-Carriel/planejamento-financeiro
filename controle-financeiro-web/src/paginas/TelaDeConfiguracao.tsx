/// Tela que aparece quando o `.env.local` não está preenchido.
///
/// É o primeiro obstáculo de quem clona o projeto, então em vez de uma página
/// branca com erro no console, mostra exatamente o que falta e como resolver.
export function TelaDeConfiguracao({ faltando }: { faltando: string[] }) {
  return (
    <div className="tela-aviso">
      <div className="cartao tela-aviso-caixa">
        <span className="etiqueta">Configuração</span>
        <h1>Falta ligar o app ao Firebase</h1>

        <p className="texto-apoio">
          {faltando.length === 1
            ? 'Uma variável de ambiente está faltando:'
            : 'Estas variáveis de ambiente estão faltando:'}
        </p>

        <pre>{faltando.join('\n')}</pre>

        <p className="texto-apoio">
          O jeito mais rápido é rodar o script de configuração na pasta do projeto. Ele registra
          o app web no projeto do Firebase e grava o <code>.env.local</code> preenchido:
        </p>

        <pre>{'cd "C:\\Users\\Rafael\\Documents\\DESENVOLVIMENTO\\Controle Financeiro\\controle-financeiro-web"\n.\\configurar-web.ps1'}</pre>

        <p className="texto-apoio">
          Para fazer à mão: copie o <code>.env.example</code> para <code>.env.local</code> e
          preencha com os dados de Configurações do projeto &gt; Seus apps &gt; app da Web, no
          console do Firebase.
        </p>

        <p className="texto-miudo">
          O Vite lê o <code>.env.local</code> só na inicialização — pare o <code>npm run dev</code>{' '}
          e rode de novo depois de criar o arquivo.
        </p>
      </div>
    </div>
  );
}
