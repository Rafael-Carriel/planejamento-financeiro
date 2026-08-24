# Controle Financeiro

App Flutter para controlar entradas e saídas de dinheiro, com Firebase
Authentication, Cloud Firestore e Cloud Messaging.

## O que já está pronto

- Cadastro e login por e-mail/senha, com recuperação de senha e mensagens de
  erro em português.
- Lançamentos de entrada e saída com valor, descrição, categoria, data e
  observação.
- Resumo do mês: saldo, total de entradas e total de saídas.
- Lista do mês agrupada por dia, com filtro (todos / entradas / saídas),
  edição ao toque e exclusão arrastando para o lado.
- Relatório por categoria com barra proporcional ao peso de cada uma.
- Navegação entre meses compartilhada por todas as abas.
- Registro do aparelho no Cloud Messaging e aviso interno quando chega uma
  notificação com o app aberto.

## Primeiros passos

As pastas nativas do Android já estão geradas. Falta criar o projeto no Firebase
e trazer as credenciais para cá, o que gera `lib/firebase_options.dart` — sem
esse arquivo o app não compila.

Um comando resolve quase tudo:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\criar-firebase.ps1
```

Sobra um clique no console, habilitar o login por e-mail/senha, que o Firebase
não expõe na linha de comando — o script abre a página e espera. O passo a passo
completo, incluindo o caminho manual, está no [SETUP.md](SETUP.md).

## Testes

As regras que não dependem do Firebase (leitura do valor digitado,
consolidação de saldo e agrupamento por categoria) têm testes:

```powershell
flutter test
```

## Estrutura

```text
lib/
  main.dart                  inicialização do Firebase e do intl
  app.dart                   MaterialApp, tema e injeção dos serviços
  core/                      tema, formatação (R$, datas) e categorias
  models/                    Transacao, ResumoFinanceiro, TotalPorCategoria
  services/                  AuthService, FirestoreService, NotificacoesService
  state/                     mês selecionado e transações do mês
  screens/                   login, cadastro, resumo, lançamentos, relatórios, perfil
  widgets/                   cartão de resumo, item da lista, seletor de mês
```

## Modelo de dados

```text
usuarios/{uid}
  nome, email, criadoEm, atualizadoEm, tokensFcm[]

usuarios/{uid}/transacoes/{id}
  descricao  string
  valor      number   sempre positivo
  tipo       string   'entrada' | 'saida'
  categoria  string
  data       timestamp
  observacao string?
  criadoEm, atualizadoEm  timestamp (servidor)
```

O sinal do lançamento vem do campo `tipo`, nunca de um valor negativo — isso
evita registros contraditórios e simplifica as somas.
