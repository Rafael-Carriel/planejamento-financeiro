import type { Page } from '@playwright/test';

import { FONTE_FIREBASE_APP } from './firebaseApp';
import { FONTE_FIREBASE_AUTH } from './firebaseAuth';
import { FONTE_FIREBASE_FIRESTORE } from './firebaseFirestore';
import { FONTE_FIREBASE_MESSAGING } from './firebaseMessaging';

/// Substitui o SDK do Firebase por dublês em memória durante um teste.
///
/// O Vite serve cada pacote pré-bundizado em
/// `/node_modules/.vite/deps/firebase_<pacote>.js`. Aqui essas respostas são
/// interceptadas e trocadas pelo dublê correspondente, sem tocar no código do
/// app. As rotas de `/node_modules/firebase/...` cobrem o caso em que o Vite
/// resolve o pacote sem pré-bundização.
///
/// Deve ser chamado **antes** do primeiro `page.goto`.

interface RotaDeMock {
  padrao: RegExp;
  fonte: string;
}

const ROTAS: RotaDeMock[] = [
  { padrao: /\/deps\/firebase_app\.js/, fonte: FONTE_FIREBASE_APP },
  { padrao: /\/deps\/firebase_auth\.js/, fonte: FONTE_FIREBASE_AUTH },
  { padrao: /\/deps\/firebase_firestore\.js/, fonte: FONTE_FIREBASE_FIRESTORE },
  { padrao: /\/deps\/firebase_messaging\.js/, fonte: FONTE_FIREBASE_MESSAGING },
  { padrao: /\/node_modules\/firebase\/app\//, fonte: FONTE_FIREBASE_APP },
  { padrao: /\/node_modules\/firebase\/auth\//, fonte: FONTE_FIREBASE_AUTH },
  { padrao: /\/node_modules\/firebase\/firestore\//, fonte: FONTE_FIREBASE_FIRESTORE },
  { padrao: /\/node_modules\/firebase\/messaging\//, fonte: FONTE_FIREBASE_MESSAGING },
];

export async function instalarMocks(page: Page): Promise<void> {
  for (const rota of ROTAS) {
    await page.route(
      (url) => rota.padrao.test(url.pathname),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body: rota.fonte,
        }),
    );
  }
}

/// Injeta lançamentos no banco em memória antes do app carregar.
///
/// `documentos` são pares `{ path, data }` no formato do Firestore. Datas podem
/// vir como `{ __date: '<ISO>' }` para serem convertidas em `Timestamp`.

export interface DocumentoSemeado {
  path: string;
  data: Record<string, unknown>;
}

export async function semearFirestore(page: Page, documentos: DocumentoSemeado[]): Promise<void> {
  await page.addInitScript((semente) => {
    (window as unknown as { __E2E_SEED__?: unknown }).__E2E_SEED__ = semente;
  }, documentos);
}
