import { test, expect } from './fixtures';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { USUARIO_DE_TESTE } from './support/constantes';

/// Fluxo de entrada e saída do app.
///
/// O Firebase é substituído pelo dublê de autenticação, então nenhuma conta
/// real é usada: qualquer e-mail serve e a senha precisa ter 6 caracteres ou
/// mais, como a própria tela valida antes de chamar o backend.

test.describe('Autenticação', () => {
  test('exibe a tela de entrada quando não há sessão', async ({ page }) => {
    const login = new LoginPage(page);

    await login.abrir();

    await expect(login.campoEmail).toBeVisible();
    await expect(login.campoSenha).toBeVisible();
    await expect(login.botaoEnviar).toHaveText('Entrar');
  });

  test('avisa que o e-mail é obrigatório', async ({ page }) => {
    const login = new LoginPage(page);

    await login.abrir();
    await login.botaoEnviar.click();

    await expect(login.avisoErro).toHaveText('Digite o e-mail.');
  });

  test('exige senha com pelo menos 6 caracteres', async ({ page }) => {
    const login = new LoginPage(page);

    await login.abrir();
    await login.campoEmail.fill(USUARIO_DE_TESTE.email);
    await login.campoSenha.fill('123');
    await login.botaoEnviar.click();

    await expect(login.avisoErro).toHaveText('A senha precisa de pelo menos 6 caracteres.');
  });

  test('alterna para o modo de criação de conta', async ({ page }) => {
    const login = new LoginPage(page);

    await login.abrir();
    await login.irParaCriarConta();

    await expect(login.campoNome).toBeVisible();
    await expect(login.botaoEnviar).toHaveText('Criar conta e começar');
  });

  test('pede o e-mail antes de enviar o link de nova senha', async ({ page }) => {
    const login = new LoginPage(page);

    await login.abrir();
    await login.pedirNovaSenha();

    await expect(login.avisoErro).toHaveText(
      'Digite o e-mail para receber o link de nova senha.',
    );
  });

  test('entra na conta, vê o painel e sai', async ({ page }) => {
    const login = new LoginPage(page);
    const painel = new DashboardPage(page);

    await login.abrir();
    await login.entrar(USUARIO_DE_TESTE.email, USUARIO_DE_TESTE.senha);
    await expect(painel.titulo).toBeVisible();

    await painel.sair();

    await expect(login.titulo).toBeVisible();
    await expect(login.campoEmail).toBeVisible();
  });
});
