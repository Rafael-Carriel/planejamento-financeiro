# Operação de privacidade do Planeora

Versão: 20/10/2026. Este documento descreve procedimentos e pendências operacionais; não é certificação de conformidade nem substitui a análise jurídica da atividade efetivamente exercida.

## Registro inicial de tratamento

| Dados | Uso | Local | Acesso operacional |
|---|---|---|---|
| Nome, e-mail e UID | Conta, autenticação e atendimento | Firebase Auth e Firestore | Titular; proprietário para atendimento e administração |
| Receitas, despesas, dívidas, metas e categorias | Organização financeira | Firestore em `usuarios/{uid}` | Titular; acessos administrativos de infraestrutura devem ser restritos |
| CPF/CNPJ, cliente Asaas e cobranças | Contratação e conciliação, quando liberadas | Asaas; metadados no Firestore; processamento Back4App | Titular e proprietário autorizado |
| Aceite dos termos e leitura da política | Prova do cadastro por versão | Subcoleção `aceitesLegais` | Titular; atendimento via infraestrutura autorizada |
| Solicitações e mensagens de privacidade | Exercício de direitos | `solicitacoesPrivacidade` | Titular e proprietário verificado |
| Preferências e cache da interface | Tema, sessão e disponibilidade | Navegador | Pessoa com acesso ao dispositivo |

Base inicial: execução do contrato para dados necessários ao serviço, obrigações legais e exercício de direitos para conservação específica. Notificações dependem da permissão opcional do navegador. O aceite de termos não é consentimento abrangente para usos incompatíveis. Avaliar novas bases antes de adicionar anúncios, análise comportamental, dados de menores ou finalidades adicionais.

## Atendimento de direitos

1. Conferir a área Administração → Solicitações de privacidade e a caixa de atendimento diariamente. Registrar responsável e início da análise.
2. Confirmar identidade por canal vinculado à conta; não solicitar senha, número completo de cartão ou documento por mensagem livre. Um UID em uma mensagem não prova identidade.
3. Delimitar escopo: aplicativo original e eventual aplicativo separado podem compartilhar Firebase, mas têm coleções e relações distintas. Não apagar dados de outro serviço por inferência.
4. Para acesso, conferir a exportação e complementar dados que não estejam nela. O arquivo JSON do aplicativo não inclui todos os registros internos de operadores. Observar o prazo legal aplicável, em especial o acesso completo previsto no art. 19 da LGPD.
5. Para correção, preferir atualização pelo titular na conta, com confirmação adicional quando envolver autenticação ou cobrança.
6. Para encerramento, conferir assinatura e solicitar cancelamento de renovação, se houver. Verificar dados que devam ser conservados e informar a justificativa. Após confirmação e planejamento, remover recursivamente os registros pessoais aplicáveis e a identidade Auth; remover um documento pai não remove suas subcoleções. Desativar tokens de notificações. Conferir processadores e backups no escopo permitido. Não apagar registros necessários à obrigação legal ou defesa sem análise.
7. Comunicar conclusão ou justificativa ao titular por canal verificado e só então marcar atendimento concluído. A seleção “Atendimento concluído” no painel não executa as etapas acima.

## Retenção e transferências

O responsável deve aprovar e manter uma tabela com prazos e fundamento para conta, registros financeiros pessoais, comprovantes fiscais/contratuais, pedidos de direitos, logs e backups. Não conservar dados indefinidamente por conveniência. A política pública não promete eliminação imediata de cópias sob obrigação legal.

Confirmar localização, suboperadores, contratos de tratamento e mecanismo válido para transferências internacionais dos serviços Google/Firebase, Back4App e Asaas. A publicação de uma política não celebra aditivos contratuais nem comprova a adoção de cláusulas-padrão. Essa avaliação contratual continua a cargo do controlador.

Avaliar o enquadramento do Marco Civil da Internet, inclusive a obrigação de guardar registros de acesso a aplicações quando cabível. Não declarar que esse requisito foi cumprido somente pela existência dos logs padrão dos prestadores. Validar disponibilidade e prazo real de logs e backups sem ativar serviços pagos automaticamente.

## Resposta a incidente

Conter o acesso, preservar evidências com acesso restrito, identificar escopo e titulares, registrar decisões e corrigir a causa. Avaliar risco relevante com atenção a informações financeiras e autenticação. O prazo geral da Resolução ANPD 15/2024 para comunicação aplicável à ANPD e aos titulares é de três dias úteis, observadas regras específicas e eventuais hipóteses legalmente aplicáveis. Manter registro dos incidentes, inclusive não comunicados, pelo mínimo regulatório de cinco anos. Não publicar dados de afetados em issues do GitHub.

## Pendências que exigem operação ou análise profissional

- Confirmar identificação jurídica, contato efetivamente monitorado e eventual necessidade de encarregado; não presumir dispensa por pequeno porte.
- Formalizar retenção, restauração, contratos e transferências, considerando os dados e a escala reais.
- Validar emissão fiscal, identificação comercial e deveres de contratação eletrônica antes de iniciar cobrança. CPF/CNPJ e endereço do fornecedor não foram inventados pelo sistema.
- A conta Asaas de produção consultada em 20/10/2026 indicou documentação pendente. Não ativar cobrança até a regularização e a homologação do fluxo pendente de estorno Pix.

## Fontes oficiais consultadas

- [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [Código de Defesa do Consumidor](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm)
- [ANPD: segurança para agentes de pequeno porte](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte)
- [ANPD: comunicação de incidente](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis)
- [ANPD: transferências internacionais](https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados)
- [Firebase: privacidade e segurança](https://firebase.google.com/support/privacy/)
