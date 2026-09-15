import { expect, type Locator, type Page } from '@playwright/test';

import { navegar } from '../fixtures';
import { ROTAS } from '../support/constantes';

/// Page Object do Painel (`src/paginas/Painel.tsx`).
///
/// Expõe os cartões de resumo, as ações rápidas de lançamento e o botão de
/// sair, que ficam na moldura do app (Layout).

export class DashboardPage {
  readonly page: Page;
  readonly titulo: Locator;
  readonly cartaoSaldo: Locator;
  readonly cartaoEntradas: Locator;
  readonly cartaoSaidas: Locator;
  readonly cartaoLancamentos: Locator;
  readonly botaoNovaReceita: Locator;
  readonly botaoNovaDespesa: Locator;
  readonly botaoPersonalizar: Locator;
  readonly botaoSair: Locator;

  constructor(page: Page) {
    this.page = page;
    this.titulo = page.getByRole('heading', { level: 1, name: 'Painel' });
    this.cartaoSaldo = page.getByText('Saldo do mês', { exact: true });
    this.cartaoEntradas = page.getByText('Entradas', { exact: true });
    this.cartaoSaidas = page.getByText('Saídas', { exact: true });
    this.cartaoLancamentos = page.getByText('Lançamentos', { exact: true });
    this.botaoNovaReceita = page
      .locator('.cabecalho-acoes-extras')
      .getByRole('button', { name: '+ Receita' });
    this.botaoNovaDespesa = page
      .locator('.cabecalho-acoes-extras')
      .getByRole('button', { name: '+ Despesa' });
    this.botaoPersonalizar = page
      .locator('.cabecalho-acoes-extras')
      .getByRole('button', { name: /Personalizar/ });
    this.botaoSair = page.getByRole('button', { name: 'Sair da conta' });
  }

  async irParaPainel(): Promise<void> {
    await navegar(this.page, ROTAS.painel);
    await expect(this.titulo).toBeVisible();
  }

  async sair(): Promise<void> {
    await this.botaoSair.click();
  }
}
