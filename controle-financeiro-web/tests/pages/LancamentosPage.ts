import { expect, type Locator, type Page } from '@playwright/test';

import { navegar } from '../fixtures';
import { ROTAS } from '../support/constantes';

/// tipo de lançamento: o mesmo componente serve Receitas e Despesas.
export type TipoLancamento = 'entrada' | 'saida';

interface NovoLancamento {
  descricao: string;
  valor: string;
  categoria?: string;
  data?: string;
}

/// Page Object de Receitas/Despesas (`src/componentes/PaginaDeLancamentos.tsx`).
///
/// O botão que abre o formulário fica no cabeçalho da página; o formulário em
/// si é um modal compartilhado (`FormularioDeTransacao`).

export class LancamentosPage {
  readonly page: Page;
  readonly titulo: Locator;
  readonly botaoNovo: Locator;
  readonly modal: Locator;
  readonly campoValor: Locator;
  readonly campoDescricao: Locator;
  readonly campoCategoria: Locator;
  readonly campoData: Locator;
  readonly botaoSalvar: Locator;
  readonly botaoSalvarMudancas: Locator;

  constructor(page: Page) {
    this.page = page;
    this.titulo = page.getByRole('heading', { level: 1 });
    this.botaoNovo = page
      .locator('.cabecalho-acoes-extras')
      .getByRole('button', { name: /\+ Nova (receita|despesa)/ });
    this.modal = page.getByRole('dialog');
    this.campoValor = this.modal.getByLabel('Valor');
    this.campoDescricao = this.modal.getByLabel('Descrição');
    this.campoCategoria = this.modal.getByLabel('Categoria');
    this.campoData = this.modal.getByLabel('Data');
    this.botaoSalvar = this.modal.getByRole('button', { name: 'Salvar lançamento' });
    this.botaoSalvarMudancas = this.modal.getByRole('button', { name: 'Salvar mudanças' });
  }

  async abrir(tipo: TipoLancamento): Promise<void> {
    const nome = tipo === 'entrada' ? 'Receitas' : 'Despesas';
    await navegar(this.page, tipo === 'entrada' ? ROTAS.receitas : ROTAS.despesas);
    await expect(this.titulo).toHaveText(nome);
  }

  async abrirFormulario(): Promise<void> {
    await this.botaoNovo.click();
    await expect(this.modal).toBeVisible();
    await expect(this.modal.getByRole('heading', { name: 'Novo lançamento' })).toBeVisible();
  }

  async preencher(dados: NovoLancamento): Promise<void> {
    await this.campoValor.fill(dados.valor);
    await this.campoDescricao.fill(dados.descricao);
    if (dados.categoria !== undefined) {
      await this.campoCategoria.selectOption({ label: dados.categoria });
    }
    if (dados.data !== undefined) {
      await this.campoData.fill(dados.data);
    }
  }

  async salvar(): Promise<void> {
    await this.botaoSalvar.click();
  }

  /// Cria um lançamento de ponta a ponta pelo formulário.
  async criar(dados: NovoLancamento): Promise<void> {
    await this.abrirFormulario();
    await this.preencher(dados);
    await this.salvar();
    await expect(this.modal).toBeHidden();
  }

  item(descricao: string): Locator {
    return this.page.locator('.lancamento').filter({ hasText: descricao });
  }

  async editar(descricao: string): Promise<void> {
    await this.page.getByRole('button', { name: `Editar ${descricao}` }).click();
    await expect(this.modal.getByRole('heading', { name: 'Editar lançamento' })).toBeVisible();
  }

  async confirmarEdicao(): Promise<void> {
    await this.botaoSalvarMudancas.click();
    await expect(this.modal).toBeHidden();
  }

  async excluir(descricao: string): Promise<void> {
    await this.page.getByRole('button', { name: `Excluir ${descricao}` }).click();
    await expect(this.modal.getByRole('heading', { name: 'Excluir lançamento' })).toBeVisible();
    await this.modal.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(this.modal).toBeHidden();
  }

  estadoVazio(tipo: TipoLancamento): Locator {
    return this.page.getByText(
      tipo === 'entrada' ? 'Nenhuma receita neste mês' : 'Nenhuma despesa neste mês',
    );
  }

  errorDeValidacao(): Locator {
    return this.modal.locator('.aviso-erro');
  }
}
