# Guia de configuração

O código do app está escrito, as pastas nativas do Android foram geradas e o
projeto no Firebase já está criado e vinculado. Se você chegou agora num
computador novo, a seção 2 refaz o vínculo com um comando; a seção 3 tem o passo
a passo manual equivalente.

Estado atual do projeto:

| item | situação |
| --- | --- |
| código do app (`lib/`, `test/`) | pronto |
| pasta `android/` | gerada |
| pacote Android | `br.com.rafael.controle_financeiro` |
| `minSdk` | 23, como o `firebase_auth` exige |
| dependências (`pubspec.lock`) | resolvidas |
| pasta `ios/` | não gerada — veja a seção 8 |
| projeto no Firebase | `controle-financeiro-rafael` |
| `lib/firebase_options.dart` | gerado |
| `android/app/google-services.json` | gerado |

Todos os comandos rodam no PowerShell, dentro de
`C:\Users\Rafael\Documents\DESENVOLVIMENTO\Controle Financeiro\controle_financeiro`.

---

## 1. Pré-requisitos

```powershell
flutter --version    # precisa ser 3.29 ou superior
flutter doctor       # resolva o que aparecer com [X] em vermelho
node --version       # o Firebase CLI depende do Node
```

Você também vai precisar do Android Studio com um emulador criado, ou de um
celular Android com a depuração USB ligada, e de uma conta Google.

---

## 2. Caminho rápido: um comando

```powershell
cd "C:\Users\Rafael\Documents\DESENVOLVIMENTO\Controle Financeiro\controle_financeiro"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\criar-firebase.ps1
```

O `Set-ExecutionPolicy` com `-Scope Process` vale só para esta janela do
PowerShell; nada muda na configuração da máquina.

O script instala o que faltar (`firebase-tools`, `flutterfire_cli`), abre o
navegador para você entrar na conta Google, cria o projeto
`controle-financeiro-rafael`, registra o app Android, gera
`lib/firebase_options.dart` e `android/app/google-services.json`, cria o banco do
Firestore em São Paulo e publica as regras de `firestore.rules`.

**Duas pausas vão acontecer.** Na primeira, o navegador pede autorização para a
CLI do Firebase — aceite e volte para o terminal. Na segunda, no fim, o script
abre a página de provedores de login e espera: clique em **E-mail/senha**, ligue
a chave, clique em **Salvar** e aperte Enter no terminal. Habilitar provedor de
login é a única coisa que o Firebase não expõe na linha de comando.

Pode rodar o script mais de uma vez sem medo: se o projeto já existir, ele
reaproveita em vez de duplicar.

Se o ID `controle-financeiro-rafael` já estiver em uso por outra pessoa no mundo,
o script tenta variações com sufixo numérico e avisa qual ficou. Para escolher
outro:

```powershell
.\criar-firebase.ps1 -ProjectId meu-controle-financeiro
```

Terminou? Pule para a seção 4.

---

## 3. Caminho manual

Só leia esta seção se o script falhar ou se você quiser fazer à mão.

**3.1 Instalar as ferramentas**

```powershell
npm install -g firebase-tools
firebase login
dart pub global activate flutterfire_cli
```

Se depois disso o comando `flutterfire` não for reconhecido, falta o cache do
Dart no PATH. Adicione `%LOCALAPPDATA%\Pub\Cache\bin` às variáveis de ambiente e
abra um PowerShell novo.

**3.2 Criar o projeto**

Em <https://console.firebase.google.com>, **Adicionar projeto**. O Google
Analytics pode ficar desativado — este app não usa.

**3.3 Registrar o app e gerar as credenciais**

```powershell
flutterfire configure --android-package-name=br.com.rafael.controle_financeiro
```

Escolha o projeto e marque **android** (barra de espaço marca, Enter confirma).
O comando escreve `lib/firebase_options.dart`, que o `lib/main.dart` importa, e
`android/app/google-services.json`. O pacote precisa ser exatamente o mesmo do
`applicationId` em `android/app/build.gradle.kts`, senão o app compila mas falha
ao iniciar o Firebase.

**3.4 Habilitar o login por e-mail e senha**

No console: **Authentication → Vamos começar → E-mail/senha → Ativar → Salvar**.
Sem isso o cadastro falha com "Login por e-mail/senha não está habilitado".

**3.5 Criar o banco**

No console: **Firestore Database → Criar banco de dados**. Escolha o **modo de
produção** — as regras do passo seguinte dão o acesso certo — e a região
`southamerica-east1`, em São Paulo, a mais próxima e portanto a mais rápida.

**3.6 Publicar as regras**

As regras deixam cada pessoa ler e escrever apenas dentro de
`usuarios/{seu-uid}`, e validam os campos de cada lançamento. Sem elas
publicadas, o app mostra "Sem permissão para ler estes dados".

```powershell
firebase use --add          # escolha o projeto e dê o apelido "default"
firebase deploy --only firestore:rules
```

O `firebase.json` deste repositório já aponta para `firestore.rules` e
`firestore.indexes.json`, então não precisa rodar `firebase init`. Alternativa
pelo console: **Firestore Database → Regras**, apague o conteúdo, cole o texto de
`firestore.rules` e clique em **Publicar**.

Não é preciso criar índice composto: as consultas filtram e ordenam pelo mesmo
campo (`data`), que o Firestore já indexa sozinho.

---

## 4. Rodar o app

**4.1 Com emulador ou celular no cabo**

```powershell
flutter analyze    # confere o código antes de compilar
flutter test       # roda os testes de regra de negócio, sem precisar do Firebase
flutter devices    # confirme que seu emulador ou celular aparece
flutter run
```

Crie uma conta, registre uma saída e uma entrada, e veja o saldo do mês mudar.
Vale abrir o console do Firestore em paralelo: os documentos aparecem em
`usuarios/{uid}/transacoes` na hora.

A primeira compilação Android baixa bastante coisa do Gradle e pode levar
alguns minutos. As seguintes são rápidas.

Se o `flutter devices` disser **"No supported devices connected"**, o celular não
está visível para o `adb`. No aparelho: **Configurações → Sobre o telefone**,
toque sete vezes em **Número da versão** para liberar as opções do
desenvolvedor, e lá ligue a **Depuração USB**. Ao conectar o cabo, o celular
mostra um aviso pedindo para autorizar o computador — aceite. Sem emulador
criado, o Android Studio faz um em **Tools → Device Manager**.

**4.2 Gerando um APK para instalar no celular**

Não precisa de cabo nem de depuração USB:

```powershell
.\gerar-apk.ps1
```

O script confere se o Firebase está vinculado, roda o `flutter analyze`,
compila e deixa o arquivo em `ControleFinanceiro-release.apk`, na raiz do
projeto. Mande esse arquivo para o celular por WhatsApp, Telegram, Google Drive
ou pelo cabo, e abra pelo aparelho. Na primeira vez o Android pede autorização
para instalar apps daquela origem, que é o aviso normal de app fora da Play
Store. Precisa de Android 6.0 ou superior.

Esse APK é assinado com a chave de depuração, e é por isso que ele instala sem
você criar keystore nenhum. Serve para uso pessoal; para publicar na Play Store
seria preciso gerar uma chave de release de verdade.

A troca é que o APK não mostra mensagens de erro: se algo falhar, o app apenas
fecha. Nesse caso vale ligar o cabo e usar o `flutter run` da seção 4.1, que
imprime o motivo no terminal. Para ver o log detalhado do APK já instalado,
`adb logcat` filtrado por `flutter`:

```powershell
adb logcat -s flutter
```

O `.\gerar-apk.ps1 -Modo debug` gera uma versão maior e mais lenta, com faixa de
debug na tela, mas com mensagens de erro mais completas.

---

## 5. Testar as notificações

No Android não há configuração extra: o `flutterfire configure` já deixou tudo
pronto, e o app pede a permissão no primeiro login.

Para mandar um teste você precisa do token do aparelho. Ele fica salvo no
Firestore, em `usuarios/{seu-uid}`, no campo `tokensFcm` — copie um dos valores.
Depois vá em **Messaging → Criar sua primeira campanha → Mensagens do Firebase
Notification**, escreva título e texto, clique em **Enviar mensagem de teste** e
cole o token.

Com o app fechado ou em segundo plano, a notificação aparece na bandeja do
sistema. Com o app aberto, o Android não mostra banner — nesse caso o próprio
app exibe um aviso na parte de baixo da tela (`ShellScreen`). Se quiser banner
também com o app aberto, acrescente o pacote `flutter_local_notifications`.

---

## 6. Onde mexer no código

Categorias de entrada e saída ficam em `lib/core/categorias.dart` — é só
acrescentar itens à lista, com um ícone do Material. As cores e o estilo geral
estão em `lib/core/theme.dart`, e a formatação de valores e datas em
`lib/core/formatters.dart`.

Toda a conversa com o Firebase está isolada em `lib/services/`: autenticação em
`auth_service.dart`, leitura e escrita em `firestore_service.dart`, push em
`notificacoes_service.dart`. As telas não falam com o Firebase direto, então
mudar uma consulta não obriga a mexer na interface.

O mês exibido é um `ChangeNotifier` em `lib/state/mes_selecionado.dart`, e
`lib/state/estado_transacoes.dart` mantém uma única assinatura no Firestore
compartilhada pelas quatro abas.

---

## 7. Problemas comuns

**"Target of URI doesn't exist: 'firebase_options.dart'"** — o
`flutterfire configure` não rodou, ou rodou em outra pasta. Refaça a seção 2.

**"Manifest merger failed... minSdkVersion"** — abra
`android/app/build.gradle.kts` e confirme que está `minSdk = 23`.

**MissingPluginException** — acontece quando um plugin novo entra com o app já
rodando. Pare (`q`) e rode `flutter run` de novo; hot reload não resolve.

**permission-denied** — as regras não foram publicadas, ou foram publicadas em
outro projeto Firebase. Confira o ID em `.firebaserc` e rode
`firebase deploy --only firestore:rules`.

**"Default FirebaseApp is not initialized" ou erro de API key ao abrir o app** —
o `applicationId` do Gradle e o pacote registrado no Firebase estão diferentes.
Rode `flutterfire configure --android-package-name=<o applicationId do Gradle>`.

**"Because controle_financeiro depends on ... version solving failed"** — rode
`flutter pub upgrade --major-versions` para resolver os pacotes nas versões
atuais do seu SDK.

**O `flutter analyze` reclama de um tipo de tema, algo como "The argument type
'CardThemeData' can't be assigned to the parameter type 'CardTheme'"** — o
Flutter vem renomeando essas classes (`CardTheme` para `CardThemeData`,
`AppBarTheme` para `AppBarThemeData` e assim por diante) conforme a versão. Abra
`lib/core/theme.dart` e use exatamente o nome que a mensagem de erro pede: é só
acrescentar ou remover o sufixo `Data`. Nada além do tema muda.

**Erro de Gradle ou de versão do Java** — `flutter doctor -v` mostra qual JDK o
Flutter está usando; normalmente basta atualizar o Android Studio.

**"FirebaseProjectNotFoundException: Firebase project id ... could not be
found on this Firebase account", logo depois de criar o projeto** — e o
`flutterfire` diz "Found 1 Firebase projects" quando você tem mais. O projeto
existe; a API que lista projetos é eventualmente consistente e leva de segundos
a alguns minutos para incluir um projeto recém-criado. O `firebase
projects:list` já mostra, o `flutterfire` ainda não.

A saída é esperar e rodar de novo:

```powershell
firebase projects:list          # confirme o ID real
.\criar-firebase.ps1            # ele reaproveita o projeto que já existe
```

O script tenta o `flutterfire` três vezes, com 20 segundos entre as tentativas,
e não recria o projeto quando ele já está acessível. Se persistir por mais de
alguns minutos, atualize o `flutterfire` com
`dart pub global activate flutterfire_cli`.

**`.\criar-firebase.ps1` não é reconhecido como um script** — rode
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` na mesma janela
antes de chamar o script.

**"flutterfire instalou mas não está no PATH"** — o `dart pub global activate`
guarda os executáveis em `%LOCALAPPDATA%\Pub\Cache\bin`, e o instalador do
Flutter não acrescenta essa pasta ao PATH. O script agora acha a pasta e a
acrescenta sozinho, ao PATH desta janela e ao do seu usuário. Para resolver à
mão, numa janela só:

```powershell
$env:Path += ";$env:LOCALAPPDATA\Pub\Cache\bin"
```

---

## 8. Acrescentar o iOS depois

O projeto foi gerado só com Android. Para incluir o iOS mais tarde, num Mac:

```powershell
flutter create --platforms=ios --org br.com.rafael .
flutterfire configure --platforms=android,ios
```

Push no iOS pede dois passos a mais: enviar uma chave de autenticação APNs em
**Configurações do projeto → Cloud Messaging** e ativar *Push Notifications* nas
capacidades do target Runner no Xcode. Não funciona no simulador, só em aparelho
real.

---

## 9. Ideias para depois

Metas de gasto por categoria, com aviso quando passar do limite. Lembrete diário
por push usando Cloud Functions com agendamento (os tokens já estão salvos em
`tokensFcm`). Login com Google, acrescentando `google_sign_in` e um método novo
no `AuthService`. Exportar os lançamentos do mês em CSV. Contas recorrentes que
se lançam sozinhas todo mês.
