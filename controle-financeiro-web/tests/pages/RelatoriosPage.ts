import { expect, type Locator, type Page } from '@playwright/test';

import { navegar } from '../fixtures';
import { ROTAS } from '../support/constantes';

type Periodo = 3 | 6 | 12;

/// Page Object de Relatórios (`src/paginas/Relatorios.tsx`).
///
/// Foca no que a tela oferece de interação imediata: escolher o período e
/// exportar o PDF. As seções analíticas só aparecem quando há lançamentos.

export class RelatoriosPage {
  readonly page: Page;
  readonly titulo: Locator;
  readonly seletorPeriodo: Locator;
  readonly botaoExportar: Locator;
  readonly estadoVazio: Locator;

  constructor(page: Page) {
    this.page = page;
    this.titulo = page.getByRole('heading', { level: 1, name: 'Relatórios' });
    this.seletorPeriodo = page.getByLabel('Período');
    this.botaoExportar = page.getByRole('button', { name: 'Exportar PDF' });
    this.estadoVazio = page.getByText('Nenhum lançamento no período');
  }

  async abrir(): Promise<void> {
    await navegar(this.page, ROTAS.relatorios);
    await expect(this.titulo).toBeVisible();
  }

  async selecionarPeriodo(periodo: Periodo): Promise<void> {
    await this.seletorPeriodo.selectOption(String(periodo));
  }

  opcoesDePeriodo(): Locator {
    return this.seletorPeriodo.locator('option');
  }
}
