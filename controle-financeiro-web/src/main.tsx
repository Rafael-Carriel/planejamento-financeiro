import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { LimiteDeErro, TelaDeFalha } from './componentes/LimiteDeErro';
import { TelaDeConfiguracao } from './paginas/TelaDeConfiguracao';
import './index.css';

/// Ponto de partida.
///
/// A checagem das variáveis vem antes de qualquer coisa e o `App` entra por
/// import dinâmico: o módulo do Firebase lança erro assim que é carregado sem
/// configuração, e um erro em tempo de import deixaria a página em branco. Com
/// a ordem invertida, quem não configurou vê a tela explicando o que fazer.

const OBRIGATORIAS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const ambiente = import.meta.env as unknown as Record<string, string | undefined>;

const faltando = OBRIGATORIAS.filter((nome) => {
  const valor = ambiente[nome];
  return valor === undefined || valor.trim().length === 0;
});

const elementoRaiz = document.getElementById('raiz');
if (!elementoRaiz) throw new Error('Elemento #raiz não encontrado no index.html.');

const raiz = createRoot(elementoRaiz);

if (faltando.length > 0) {
  raiz.render(
    <StrictMode>
      <TelaDeConfiguracao faltando={[...faltando]} />
    </StrictMode>,
  );
} else {
  void import('./App')
    .then(({ default: App }) => {
      raiz.render(
        <StrictMode>
          <LimiteDeErro>
            <App />
          </LimiteDeErro>
        </StrictMode>,
      );
    })
    .catch((falha: unknown) => {
      // Um erro aqui acontece antes de existir árvore React, então o
      // LimiteDeErro não alcança: sem esta mensagem a página ficaria branca.
      console.error('Falha ao carregar o app.', falha);
      raiz.render(
        <StrictMode>
          <TelaDeFalha detalhe={falha instanceof Error ? falha.message : String(falha)} />
        </StrictMode>,
      );
    });
}
