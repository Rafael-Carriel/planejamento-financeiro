# Segurança do Planeora

Não publique falhas, tokens, CPF, documentos, dados financeiros ou passos que exponham usuários em issues públicas. Use o canal de atendimento indicado na Política de Privacidade do aplicativo. Nunca envie senhas ou chaves de API.

## Proteções implementadas

- Autenticação Firebase; regras do Firestore delimitadas pelo UID; administração vinculada ao UID do proprietário, sem confiar no e-mail editável do perfil.
- Coleções de cobrança privadas, gravação de cota e lançamento na mesma transação, referências estáveis e recuperação de resultados incertos do provedor.
- Segredos de servidor fora do front-end, do Git e da hospedagem. Chaves públicas de configuração Firebase/Parse não substituem autenticação nem autorização.
- CSP, bloqueio de enquadramento, HTTPS, proteção contra MIME sniffing e política de referência restritiva no Firebase Hosting.
- Downloads CSV neutralizam textos interpretáveis como fórmulas. React apresenta mensagens e descrições como texto.
- Dados de sessão montados por UID; ausência de cache de respostas de autenticação/Firestore no service worker; detalhes de erro de renderização restritos ao desenvolvimento.
- Solicitações de privacidade visíveis ao titular e ao proprietário verificado; somente o proprietário altera o atendimento. Aceites legais têm versão e data do servidor e não permitem reescrita pelo cliente.

## Operação necessária

Ativar autenticação multifator nas contas de administração de Firebase, Back4App, Asaas e GitHub; manter credenciais com menor privilégio; revisar acessos periodicamente. Não conceder acesso administrativo a desenvolvedores apenas para facilitar testes. Não enviar dumps de produção para logs ou ferramentas externas.

Revisar alertas de dependências e executar testes antes de mudanças. Backups, retenção, restauração, quotas e plano de resposta devem ser operados pelo responsável; a existência deste arquivo não comprova que estejam configurados nos prestadores.

## Limites conhecidos

Tokens Firebase são validados por assinatura e validade. A identidade de serviço atual não consulta revogação de tokens em cada chamada; um token já emitido pode continuar válido até expirar. Reavaliar essa limitação antes de ampliar o risco da operação. App Check e limites globais de abuso no provedor não foram habilitados por esta alteração. Não houve pentest externo ou teste de carga de produção.

O plano gratuito faz conciliação eventual de pagamentos, sem webhook HTTP de produção publicado. Cobrança permanece desativada até homologação e liberação operacional. O Flutter legado precisa migrar gravações para a API antes da ativação da cota.

Exclusão de conta é um atendimento administrativo verificado, não uma exclusão automática de Firebase Auth. Ações reais irreversíveis só devem ocorrer com confirmação do titular e análise de retenção. Não usar a conta do proprietário para testar exclusão.
