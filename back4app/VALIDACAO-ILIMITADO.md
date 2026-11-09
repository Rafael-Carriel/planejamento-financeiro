# Homologação do Ilimitado

Executada em 08/11/2026 com a API real do Asaas Sandbox, cliente sintético sem notificações e armazenamento local isolado. Nenhum dinheiro real foi movimentado.

Regra: R$19,90/mês; cancelar encerra a renovação seguinte, mantém o acesso até o vencimento e não solicita estorno automático.

## Resultados

Pix: 15 verificações aprovadas. Cartão: 16 verificações aprovadas.

- Assinatura pendente não libera acesso pago.
- Preço no provedor: R$19,90.
- Repetição do checkout não duplica assinatura.
- Cartão recusado não libera acesso; cartão de aprovação confirma pagamento.
- Pagamento confirmado libera Ilimitado, incluindo mais de 50 registros.
- Reprocessamento da confirmação não duplica benefício.
- Cancelamento mantém acesso já pago e cobrança confirmada, sem solicitar estorno.
- Provedor fica sem assinatura ativa e sem cobranças pendentes após cancelamento.
- Cancelar novamente e reconciliar não reativa renovação.
- Relógio local: acesso termina exatamente no vencimento; histórico preservado; 20 registros gratuitos no novo mês e bloqueio do 21º.
- Entidades sintéticas da execução arquivadas no Sandbox.

Seis testes de interface de cobrança e 36 testes do servidor também aprovados. Testes automatizados de estorno/contestação continuam garantindo que um evento recebido do provedor seja conciliado; isso não faz parte da ação de cancelamento.

## Reprodução

Com chave de Sandbox válida no arquivo local ignorado `work/.env.sandbox-validation`, executar da raiz:

```powershell
node back4app/cloud/test/sandbox-flat-validation.cjs
node back4app/cloud/test/sandbox-flat-validation.cjs --card
```

O script fixa o domínio Sandbox e recusa redirecionamentos. Não recebe URL de produção. Resultados detalhados ficam em `analises/Validacao-Asaas-Ilimitado*.json`, fora deste documento público.

Cartão específico de homologação conferido em [FAQ oficial do Sandbox](https://docs.asaas.com/docs/faq-sandbox). Dados de exemplo genéricos da API não necessariamente simulam aprovação.

## Limites

O teste não esperou um mês real: a inexistência de assinatura ativa foi consultada no provedor, e a expiração do acesso foi verificada avançando o relógio do serviço local. Autenticação e persistência usam adaptadores de teste nesta execução; isolamento e transações do Firestore possuem validação separada por emulador. Não houve publicação no Firebase/Back4App nem cobrança de produção nesta homologação.
