# Mensalidades do Planeora — Asaas + Back4App

> Estado em 20/10/2026: funções planeja publicadas no Back4App; conexão do aplicativo local configurada; proprietário com e-mail verificado vinculado; painel consultou 11 perfis existentes e o histórico de pagamentos sem erro. A tarefa horária compartilhada foi confirmada e executada com status Succeeded. Cobranças e bloqueios seguem desativados por autorização explícita do proprietário; regras novas e site público não foram publicados. Pagamento e renovação reais continuam sem validação.


Mantém o aplicativo antigo em controle-financeiro-web. O Planeora encontrado depois permanece em repositório, funções e coleções próprios. A integração usa o aplicativo Back4App existente Planeora Assinaturas, sem Web Hosting pago.

## Regra aprovada

| Inserções acumuladas de receitas e despesas | Mensalidade |
| --- | --- |
| Até 20 | Grátis |
| 21 a 50 | R$ 20 |
| 51 a 80 | R$ 40 |
| 81 a 110 | R$ 60 |
| Cada bloco de mais 30 | Mais R$ 20/mês |

A contagem não reinicia no mês nem com o pagamento. Excluir não devolve inserções; editar não consome. Uma ocorrência automática consome somente quando é criada. Registros existentes são incluídos uma vez na primeira contagem; lançamentos apagados antes da ativação não podem ser reconstruídos.

O usuário escolhe e aceita seu plano antes da contratação. Pagamento pendente não libera cota. Não há cobrança automática apenas por atingir o limite. Cancelamento encerra a renovação e mantém o período já pago; o histórico continua acessível. Quando o período expira, novas inserções acima das 20 grátis exigem pagamento vigente.

Ao ampliar um plano, a tela informa a cobrança da diferença integral para o restante do período. Após confirmação, a próxima mensalidade passa ao novo valor. Reduções de plano não estão disponíveis nesta primeira implementação; cancele e espere encerrar o período antes de contratar um plano menor. O administrador é isento.

## Proprietário

O servidor aceita somente o token Firebase com e-mail verificado rafaelcarriel.deo@gmail.com para vincular o primeiro UID em billingSystem/owner. Depois do vínculo, outro UID não assume a permissão apenas por reutilizar o endereço. ADMIN_UIDS também permite definir UIDs explicitamente no ambiente do servidor. Nenhuma permissão vem de um e-mail digitado no frontend.

O painel mostra os perfis do aplicativo antigo em usuarios, com consumo, capacidade, mensalidade e validade; não lista as contas exclusivas do Planeora. Há busca nos registros carregados e paginação. Pagamentos têm filtro por situação, links do Asaas e identificação do usuário. Indicadores referem-se às páginas carregadas, sem apresentar totais parciais como globais.

## Código e operação no plano gratuito

- cloud/routes.js: regras, contador transacional, checkout, cancelamento, conciliação e administração.
- cloud/policy.js: preços, validade e cotas.
- cloud/parse-entry.js: adaptador das Cloud Functions, sem depender de Web Hosting.
- cloud/runtime.js: reutiliza as credenciais privadas já configuradas no Back4App; cria uma instância Firebase separada para o Planeja.
- prepare-deploy.ps1: gera cinco módulos com prefixo planeja- e prepara as entradas existentes, preservando as funções do Planeora.

As credenciais privadas ASAAS_API_KEY_BASE64 e FIREBASE_SERVICE_ACCOUNT_BASE64 já usadas no aplicativo remoto são lidas apenas no servidor. Também há suporte a ASAAS_API_KEY e FIREBASE_SERVICE_ACCOUNT_JSON. Base64 não é criptografia. Nenhum segredo deve entrar em variáveis VITE_, Git, prints ou mensagens.

As funções públicas novas são planejaHealth, planejaMe, planejaCheckout, planejaCreateTransaction, planejaCancel, planejaSync, planejaAdminUsers e planejaAdminPayments. Todas as funções de dados exigem token Firebase verificado; as duas administrativas exigem ainda o proprietário. planejaActivate é a operação administrativa de ativação das cotas.

O único job já agendado, syncAsaasSubscriptions, passa a conciliar as duas integrações isoladas. O frontend consulta a situação a cada dois minutos enquanto está visível e o servidor limita conciliações solicitadas pela conta a uma por minuto. Não há webhook HTTP no modo gratuito; o webhook opcional em routes.js serve apenas para instalações com Web Hosting. A confirmação depende de consulta à cobrança real no Asaas, nunca de retornar da página de pagamento.

## Publicação coordenada

1. Rode os testes, gere o pacote com prepare-deploy.ps1 e compare entry.js e main.js com o que está no painel remoto antes de substituir. O gerador falha se não reconhecer a entrada existente. Não envie as dependências, arquivos locais ou testes.
2. Envie ao Cloud Code os cinco arquivos novos e as entradas coordenadas entry.js/main.js. Preserve billing.js, policy.js, runtime.js, package.json, package-lock.json e os arquivos públicos do Planeora. Os novos módulos usam apenas firebase-admin já disponível no servidor; Express não é carregado pelo adaptador Parse.
3. Publique e confirme planejaHealth e a recusa de requisições sem autenticação. Confirme também que billingHealth do Planeora continua funcionando. Não crie cobranças reais para validar disponibilidade.
4. No .env.local da web, configure VITE_BILLING_API_URL=https://parseapi.back4app.com, VITE_BACK4APP_APP_ID e VITE_BACK4APP_JAVASCRIPT_KEY com os identificadores públicos existentes. Reinicie o servidor local. Não use a chave master do Parse no navegador.
5. Entre com a conta verificada do proprietário. Confira o painel administrativo e os perfis existentes. O servidor vincula o UID; contas comuns continuam sem acesso administrativo.
6. Publique as regras combinadas em controle_financeiro/firestore.rules, que preservam as coleções e regras do Planeora, e coordene a atualização de todos os clientes do aplicativo antigo. Ative billingSystem/config com enabled=true e usageMode=lifetime somente quando os clientes usarem o servidor de inserções. A ativação pode ser feita por planejaActivate, exclusivamente pelo proprietário.
7. O Flutter deste repositório ainda cria registros diretamente no Firestore. Ele deve migrar para planejaCreateTransaction antes de ativar as cotas para usuários móveis; após a ativação, as regras recusam inserções diretas de versões antigas. A leitura e edição permanecem disponíveis.
8. Antes de liberar contratação, valide pagamento, renovação, ampliação e estorno em sandbox separado. A conta remota existente usa produção; testes automatizados locais não movimentam essa conta. Não mudar as credenciais compartilhadas da integração Planeora para sandbox.

A implementação preparada não equivale a uma integração financeira publicada e validada. Só anuncie a cobrança ativa após confirmar publicação, regras, conta administrativa e ciclo de pagamento. Uma publicação de backend expõe novas funções autenticadas de administração e deve ser revisada pelo proprietário.

## Consistência e limites conhecidos

O contador e o lançamento são gravados na mesma transação Firestore. O servidor decide o UID pelo token. IDs estáveis evitam consumir duas vezes a mesma requisição ou recorrência. Coleções billingAccounts, billingOrders, billingPayments, billingEvents e billingSystem são privadas e só o Firebase Admin as acessa.

Eventos duplicados não somam benefícios; o estado financeiro é consultado no Asaas. A validade termina no mês seguinte ao vencimento, ajustando meses curtos no fuso de São Paulo. Mensalidades antigas pagas em atraso não quitam automaticamente períodos seguintes. Estornos e contestações retiram os benefícios correspondentes.

Um timeout durante a criação externa mantém o pedido em processamento. A conciliação busca pela referência externa e nunca repete cegamente uma criação. Se não encontrar objeto no Asaas, o operador precisa investigar o pedido antes de permitir outra contratação. A conciliação percorre contas em páginas de 25 e até 1.000 cobranças por assinatura; bases grandes exigem dimensionamento de frequência e cotas. A confirmação automática no plano gratuito é eventual, não instantânea.

Tokens Firebase são validados por assinatura e expiração. A identidade de servidor existente não tem acesso administrativo ao Firebase Auth: não há consulta adicional à revogação a cada chamada; tokens já emitidos podem permanecer válidos até expirar. A lista administrativa usa somente os perfis Firestore do aplicativo antigo.

## Verificação local

Em cloud/: npm ci e npm test. Na web: npm run build, npm run teste e npx playwright test. Os testes de servidor usam gateway e banco isolados e não substituem validação real em sandbox.

Referências: https://docs.asaas.com/docs/assinaturas e https://www.back4app.com/docs/get-started/cloud-functions.

## Diagnóstico de conexão

Em 20/10/2026, planejaAsaasStatus confirmou a autenticação no Asaas de produção por uma consulta GET de clientes, descartando os dados retornados e sem gerar cobrança. A Administração oferece o botão Verificar conexão com o Asaas. O endpoint é exclusivo do proprietário; não substitui o teste de pagamento e renovação. A responsividade foi corrigida para manter perfil e tema acessíveis em 7 tamanhos de tela.

## Homologação de 20/10/2026

O nome público do aplicativo original passou a Planeora. Os nomes internos `planeja*` são preservados por compatibilidade com as funções publicadas e com o aplicativo separado no mesmo projeto. Esta alteração não troca a base de usuários nem as credenciais de produção.

Passaram 23 testes do servidor, 7 cenários com Firestore emulado (incluindo inserções e checkouts concorrentes), 60 testes unitários web, 30 cenários de navegador e um teste do build PWA com recarregamento offline. A auditoria local de dependências de produção terminou sem vulnerabilidades conhecidas.

No Asaas Sandbox foram confirmados pagamento Pix, ampliação de plano, atualização do valor recorrente, renovação sem zerar consumo, cancelamento e pagamento/estorno de cartão. O estorno Pix passou pela autorização, mas a transferência falhou no provedor; o painel não permitiu confirmá-la nesse ambiente. Esse cenário não está aprovado. Solicitação de estorno pendente/falho não revoga acesso pago; devolução total concluída revoga.

O script manual `cloud/test/sandbox-validation.cjs` contém as operações de homologação, sempre com URL sandbox fixa e dados fictícios sem notificações. Não faz parte de `npm test` e não deve ser executado automaticamente em CI: cria registros no sandbox. O arquivo de credenciais fica fora do repositório. Os testes web adicionais ficam em `controle-financeiro-web/validation/` e `tests/cobranca-conectada.spec.ts`.

As correções das funções foram publicadas. A web pública, as regras e a ativação da cobrança continuam pendentes. O Flutter direto no Firestore, as limitações de conciliação gratuita e a ausência de verificação imediata de revogação de tokens continuam aplicáveis.
