import { expect, type Locator, type Page } from '@playwright/test';

/// Page Object da tela de entrada (`src/paginas/Entrada.tsx`).
///
/// Cobre tanto o login quanto a criação de conta e a recuperação de senha.
/// Os localizadores evitam depender de classes de estilo frágeis, apoiando-se
/// em rótulos e papéis acessíveis que a própria tela já declara.

export class LoginPage {
  readonly page: Page;
  readonly titulo: Locator;
  readonly campoEmail: Locator;
  readonly campoSenha: Locator;
  readonly campoNome: Locator;
  readonly botaoEnviar: Locator;
  readonly abaCriarConta: Locator;
  readonly botaoEsqueciSenha: Locator;
  readonly avisoErro: Locator;
  readonly avisoSucesso: Locator;

  constructor(page: Page) {
    this.page = page;
    this.titulo = page.getByRole('heading', { name: 'O mês inteiro numa página.' });
    this.campoEmail = page.getByLabel('E-mail');
    this.campoSenha = page.getByLabel('Senha');
    this.campoNome = page.getByLabel('Nome');
    this.botaoEnviar = page.locator('form.formulario button[type="submit"]');
    this.abaCriarConta = page.getByRole('button', { name: 'Criar conta', exact: true });
    this.botaoEsqueciSenha = page.getByRole('button', { name: 'Esqueci minha senha' });
    this.avisoErro = page.locator('.aviso-erro');
    this.avisoSucesso = page.locator('.aviso-sucesso');
  }

  /// Carrega o app do zero. É o único ponto dos testes que recarrega a página.
  async abrir(): Promise<void> {
    await this.page.goto('/');
    await expect(this.titulo).toBeVisible();
  }

  async entrar(email: string, senha: string): Promise<void> {
    await this.campoEmail.fill(email);
    await this.campoSenha.fill(senha);
    await this.botaoEnviar.click();
  }

  async irParaCriarConta(): Promise<void> {
    await this.abaCriarConta.click();
    await expect(this.campoNome).toBeVisible();
  }

  async criarConta(nome: string, email: string, senha: string): Promise<void> {
    await this.irParaCriarConta();
    await this.campoNome.fill(nome);
    await this.campoEmail.fill(email);
    await this.campoSenha.fill(senha);
    await this.botaoEnviar.click();
  }

  async pedirNovaSenha(): Promise<void> {
    await this.botaoEsqueciSenha.click();
  }
}
