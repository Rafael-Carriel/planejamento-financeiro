import { Component, type ErrorInfo, type ReactNode } from 'react';

/// Rede de segurança para erro de renderização.
///
/// Sem isto, um erro em qualquer componente apaga a tela e deixa a página
/// branca — o usuário não tem como saber se travou ou se está carregando. Aqui
/// pelo menos aparece o que aconteceu e um caminho de volta.

interface Propriedades {
  children: ReactNode;
}

interface Estado {
  erro: Error | null;
}

/// A mesma tela serve ao `main.tsx`: quando o módulo do app falha ao carregar,
/// o erro acontece antes de existir árvore React para o limite capturar, e sem
/// isso a página ficaria branca.
export function TelaDeFalha({ detalhe }: { detalhe: string }) {
  return (
    <div className="tela-aviso">
      <div className="cartao tela-aviso-caixa">
        <h1>O app parou aqui</h1>
        <p className="texto-apoio">
          Um erro interrompeu a tela. A mensagem abaixo diz o que aconteceu; o console do
          navegador tem o rastro completo.
        </p>
        <pre>{detalhe}</pre>
        <div>
          <button
            type="button"
            className="botao botao-principal"
            onClick={() => window.location.reload()}
          >
            Recarregar o app
          </button>
        </div>
      </div>
    </div>
  );
}

export class LimiteDeErro extends Component<Propriedades, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  componentDidCatch(erro: Error, informacao: ErrorInfo): void {
    console.error('Erro de renderização.', erro, informacao.componentStack);
  }

  render(): ReactNode {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    return <TelaDeFalha detalhe={erro.message} />;
  }
}
