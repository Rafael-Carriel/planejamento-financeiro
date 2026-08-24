<#
.SYNOPSIS
    Cria o projeto no Firebase e vincula este app a ele.

.DESCRIPTION
    Automatiza tudo o que a linha de comando do Firebase permite:

      1. confere as ferramentas necessarias (flutter, node, firebase, flutterfire);
      2. faz login na sua conta Google (abre o navegador);
      3. cria o projeto no Firebase;
      4. confere as pastas nativas e as dependencias;
      5. registra o app, gera lib/firebase_options.dart e google-services.json;
      6. cria o banco do Firestore em Sao Paulo;
      7. publica as regras de seguranca de firestore.rules.

    Sobra um passo manual: habilitar o login por e-mail/senha. O Firebase nao
    expoe isso na CLI. O script abre a pagina certa e espera voce confirmar.

    Pode rodar de novo com seguranca: se o projeto ja existir, ele reaproveita.

.PARAMETER ProjectId
    ID do projeto no Firebase. Precisa ser unico no mundo, entre 6 e 30
    caracteres, so minusculas, numeros e hifens. Se estiver em uso, o script
    tenta o mesmo nome com um sufixo numerico.

.PARAMETER Org
    Identificador reverso do app (package name no Android, bundle id no iOS).
    Usado apenas se as pastas nativas ainda nao existirem.

.PARAMETER PacoteAndroid
    Package name a registrar no Firebase. Se ficar vazio, o script le o
    applicationId de android/app/build.gradle.kts - que e o que voce quer em
    99% dos casos, porque garante que os dois batem.

.PARAMETER Regiao
    Regiao do Firestore. southamerica-east1 e Sao Paulo, a mais proxima.

.EXAMPLE
    .\criar-firebase.ps1

.EXAMPLE
    .\criar-firebase.ps1 -ProjectId controle-financeiro-rafael -Org br.com.rafael
#>
param(
    [string]$ProjectId = 'controle-financeiro-rafael',
    [string]$NomeExibicao = 'Controle Financeiro',
    [string]$Org = 'br.com.rafael',
    [string]$Regiao = 'southamerica-east1',
    # Vazio = ler o applicationId de android/app/build.gradle.kts.
    [string]$PacoteAndroid = ''
)

# Comandos externos nao lancam excecao no PowerShell: conferimos $LASTEXITCODE
# na mao. Estas duas linhas evitam que a saida de erro deles aborte o script.
$ErrorActionPreference = 'Continue'
if (Test-Path variable:PSNativeCommandUseErrorActionPreference) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$raiz = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
Set-Location $raiz

function Escrever-Titulo($texto) {
    Write-Host ''
    Write-Host "== $texto" -ForegroundColor Cyan
}
function Escrever-Ok($texto) { Write-Host "   [ok] $texto" -ForegroundColor Green }
function Escrever-Aviso($texto) { Write-Host "   [!] $texto" -ForegroundColor Yellow }
function Escrever-Erro($texto) { Write-Host "   [x] $texto" -ForegroundColor Red }

function Parar($texto) {
    Escrever-Erro $texto
    Write-Host ''
    exit 1
}

Write-Host ''
Write-Host '########################################################' -ForegroundColor Cyan
Write-Host '#  Controle Financeiro - criar e vincular o Firebase   #' -ForegroundColor Cyan
Write-Host '########################################################'

# ---------------------------------------------------------------- 1. ferramentas
Escrever-Titulo '1/7  Conferindo as ferramentas'

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    Parar 'Flutter nao encontrado. Instale: https://docs.flutter.dev/get-started/install/windows'
}
Escrever-Ok 'flutter'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Parar 'Node.js nao encontrado (a CLI do Firebase depende dele). Instale: https://nodejs.org'
}
Escrever-Ok 'node'

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Escrever-Aviso 'CLI do Firebase nao encontrada. Instalando com npm...'
    npm install -g firebase-tools
    if ($LASTEXITCODE -ne 0) {
        Parar 'Falha ao instalar firebase-tools. Rode "npm install -g firebase-tools" e tente de novo.'
    }
    if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
        # Mesma historia do flutterfire: instalou, mas a pasta de binarios
        # globais do npm pode nao estar no PATH desta janela.
        $pastaNpm = Join-Path $env:APPDATA 'npm'
        if (Test-Path (Join-Path $pastaNpm 'firebase.cmd')) {
            $env:Path = "$env:Path;$pastaNpm"
            Escrever-Ok "Achei o firebase em $pastaNpm"
        }
    }
    if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
        Parar 'firebase-tools instalou mas nao entrou no PATH. Abra um PowerShell novo e rode este script de novo.'
    }
}
Escrever-Ok 'firebase'

if (-not (Get-Command flutterfire -ErrorAction SilentlyContinue)) {
    Escrever-Aviso 'flutterfire_cli nao encontrado. Instalando...'
    dart pub global activate flutterfire_cli
}

# O `dart pub global activate` instala em <pub cache>\bin, que o instalador do
# Flutter nao acrescenta ao PATH. Sem isso o comando existe mas nao e achado.
if (-not (Get-Command flutterfire -ErrorAction SilentlyContinue)) {
    $candidatos = @(
        $(if ($env:PUB_CACHE) { Join-Path $env:PUB_CACHE 'bin' }),
        (Join-Path $env:LOCALAPPDATA 'Pub\Cache\bin'),
        (Join-Path $env:APPDATA 'Pub\Cache\bin')
    ) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'flutterfire.bat')) }

    $pastaPub = $candidatos | Select-Object -First 1

    if (-not $pastaPub) {
        Write-Host ''
        Escrever-Erro 'Nao encontrei o flutterfire.bat em nenhum cache do Pub.'
        Write-Host '   Rode "dart pub global activate flutterfire_cli" e veja em qual pasta'
        Write-Host '   ele diz que instalou; depois acrescente essa pasta ao PATH.'
        exit 1
    }

    # 1) vale para esta janela, para o script poder continuar agora
    $env:Path = "$env:Path;$pastaPub"
    Escrever-Ok "Achei o flutterfire em $pastaPub"

    # 2) grava no PATH do usuario, para as proximas janelas tambem acharem.
    #    Mexe so no PATH do usuario, nunca no da maquina.
    $pathUsuario = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($pathUsuario -notlike "*$pastaPub*") {
        $novo = if ($pathUsuario) { "$pathUsuario;$pastaPub" } else { $pastaPub }
        [Environment]::SetEnvironmentVariable('Path', $novo, 'User')
        Escrever-Ok 'Pasta acrescentada ao PATH do seu usuario (vale para os proximos terminais).'
    }

    if (-not (Get-Command flutterfire -ErrorAction SilentlyContinue)) {
        Parar 'Mesmo com o PATH ajustado o flutterfire nao respondeu. Abra um PowerShell novo e rode o script de novo.'
    }
}
Escrever-Ok 'flutterfire'

# ---------------------------------------------------------------------- 2. login
Escrever-Titulo '2/7  Entrando na sua conta Google'

firebase projects:list 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host '   Vai abrir o navegador para voce autorizar a CLI do Firebase.'
    firebase login
    if ($LASTEXITCODE -ne 0) { Parar 'Login no Firebase nao concluido.' }
}
Escrever-Ok 'Conta autenticada'

# ------------------------------------------------------------------- 3. projeto
Escrever-Titulo '3/7  Criando o projeto no Firebase'

# Teste direto de acesso: se a CLI consegue listar os apps do projeto, o projeto
# existe e e nosso. Nao depende de parsear lista nenhuma, entao e o caminho
# principal - listar em JSON fica so para montar o menu de escolha no fim.
function Testar-Projeto([string]$id) {
    if (-not $id) { return $false }
    firebase apps:list --project $id 2>$null 1>$null
    return ($LASTEXITCODE -eq 0)
}

# `firebase ... --json` escreve o spinner ("Preparing the list...") na saida de
# erro. Juntar as duas com 2>&1 estraga o JSON - foi o que aconteceu antes.
# Aqui a saida de erro vai para o lixo e ainda recortamos do primeiro { ao
# ultimo }, para o caso de a CLI imprimir algo extra na saida normal.
function Obter-ProjetosFirebase {
    $bruto = (firebase projects:list --json 2>$null) | Out-String
    $inicio = $bruto.IndexOf('{')
    $fim = $bruto.LastIndexOf('}')
    if ($inicio -lt 0 -or $fim -le $inicio) { return @() }
    try {
        $dados = $bruto.Substring($inicio, $fim - $inicio + 1) | ConvertFrom-Json
        if ($dados.result) {
            return @($dados.result | ForEach-Object { $_.projectId })
        }
    } catch {
        Escrever-Aviso 'Nao consegui ler a lista de projetos em JSON.'
    }
    return @()
}

# Gera um ID alternativo dentro do limite de 30 caracteres, cortando a base.
function Novo-IdComSufixo([string]$base) {
    $sufixo = '-' + (Get-Random -Minimum 1000 -Maximum 9999)
    $espaco = 30 - $sufixo.Length
    if ($base.Length -gt $espaco) { $base = $base.Substring(0, $espaco) }
    return ($base.TrimEnd('-') + $sufixo)
}

$projetoFinal = $null

Write-Host "   Conferindo se $ProjectId ja e seu..."
if (Testar-Projeto $ProjectId) {
    Escrever-Ok "Projeto $ProjectId acessivel - reaproveitando."
    $projetoFinal = $ProjectId
}

if (-not $projetoFinal) {
    # Uma rodada anterior pode ter criado o projeto com sufixo numerico, porque
    # o ID sem sufixo ja estava em uso por outra pessoa.
    $comSufixo = @(Obter-ProjetosFirebase |
        Where-Object { $_ -match ('^' + [regex]::Escape($ProjectId) + '-\d+$') })
    if ($comSufixo.Count -gt 0) {
        $projetoFinal = $comSufixo[0]
        Escrever-Ok "Achei $projetoFinal, de uma rodada anterior - reaproveitando."
    }
}

if (-not $projetoFinal) {
    $candidatos = @($ProjectId) + (1..3 | ForEach-Object { Novo-IdComSufixo $ProjectId })
    foreach ($candidato in $candidatos) {
        Write-Host "   Tentando criar: $candidato"
        firebase projects:create $candidato --display-name "$NomeExibicao"
        if ($LASTEXITCODE -eq 0) {
            $projetoFinal = $candidato
            break
        }

        # A criacao falha tambem quando o ID ja existe. Se ele for seu, da para
        # usar do mesmo jeito - so nao da para criar de novo.
        if (Testar-Projeto $candidato) {
            Escrever-Ok "$candidato ja existia e e seu - vou usar esse."
            $projetoFinal = $candidato
            break
        }

        Escrever-Aviso "$candidato nao esta disponivel nem acessivel. Tentando outro ID..."
    }
}

# Projeto recem-criado leva alguns segundos para responder na API.
if ($projetoFinal) {
    $confirmado = $false
    foreach ($tentativa in 1..6) {
        if (Testar-Projeto $projetoFinal) { $confirmado = $true; break }
        Write-Host "   Esperando o projeto responder na API ($tentativa/6)..."
        Start-Sleep -Seconds 5
    }
    if (-not $confirmado) {
        Escrever-Aviso "$projetoFinal nao respondeu na API."
        $projetoFinal = $null
    }
}

# Ultimo recurso: mostrar o que existe de fato e deixar voce escolher.
if (-not $projetoFinal) {
    $existentes = Obter-ProjetosFirebase
    Write-Host ''
    Escrever-Erro 'Nao consegui chegar num projeto valido automaticamente.'

    if ($existentes.Count -gt 0) {
        Write-Host ''
        Write-Host '   Projetos que existem nesta conta:'
        for ($i = 0; $i -lt $existentes.Count; $i++) {
            Write-Host ("     [{0}] {1}" -f ($i + 1), $existentes[$i]) -ForegroundColor White
        }
        Write-Host ''
        $escolha = Read-Host '   Digite o numero do projeto a usar (ou Enter para sair)'
        if ($escolha -match '^\d+$') {
            $indice = [int]$escolha - 1
            if ($indice -ge 0 -and $indice -lt $existentes.Count) {
                $projetoFinal = $existentes[$indice]
                Escrever-Ok "Usando $projetoFinal"
            }
        }
    }

    if (-not $projetoFinal) {
        Write-Host ''
        Write-Host '   Crie o projeto em https://console.firebase.google.com e depois rode:'
        Write-Host '   .\criar-firebase.ps1 -ProjectId o-id-que-voce-criou' -ForegroundColor White
        exit 1
    }
}
Escrever-Ok "Projeto: $projetoFinal"

# Fixa o projeto para os proximos comandos do firebase nesta pasta.
# ASCII de proposito: o Set-Content -Encoding UTF8 do PowerShell 5.1 grava BOM,
# e o firebase-tools (Node) quebra ao ler JSON com BOM.
Set-Content -Path (Join-Path $raiz '.firebaserc') -Encoding ascii -Value @"
{
  "projects": {
    "default": "$projetoFinal"
  }
}
"@
Escrever-Ok '.firebaserc gravado'

# ------------------------------------------------------------- 4. pastas nativas
Escrever-Titulo '4/7  Projeto local: pastas nativas, dependencias e pacote'

if (-not (Test-Path (Join-Path $raiz 'android'))) {
    Escrever-Aviso 'android/ ainda nao existe. Chamando o configurar.ps1...'
    & (Join-Path $raiz 'configurar.ps1') -Org $Org
    if (-not (Test-Path (Join-Path $raiz 'android'))) {
        Parar 'configurar.ps1 nao gerou a pasta android/. Rode ".\configurar.ps1" e veja a mensagem de erro.'
    }
}
Escrever-Ok 'android/ presente'

if (-not (Test-Path (Join-Path $raiz '.dart_tool'))) {
    Write-Host '   Baixando as dependencias (flutter pub get)...'
    flutter pub get
    if ($LASTEXITCODE -ne 0) {
        Escrever-Aviso 'flutter pub get falhou. Tentando resolver nas versoes atuais...'
        flutter pub upgrade --major-versions
        if ($LASTEXITCODE -ne 0) { Parar 'Nao consegui resolver as dependencias. Veja a saida acima.' }
    }
}
Escrever-Ok 'Dependencias resolvidas'

# O pacote precisa ser o mesmo aqui e no Firebase, senao o google-services.json
# nao casa com o app e o Firebase.initializeApp falha em tempo de execucao.
if (-not $PacoteAndroid) {
    $gradle = Get-Content (Join-Path $raiz 'android\app\build.gradle.kts') -Raw -ErrorAction SilentlyContinue
    if ($gradle -match 'applicationId\s*=\s*"([^"]+)"') {
        $PacoteAndroid = $Matches[1]
    }
}
if ($PacoteAndroid) {
    Escrever-Ok "Pacote Android: $PacoteAndroid"
    if ($PacoteAndroid -like 'com.example.*') {
        Escrever-Aviso 'O pacote comeca com com.example - a Play Store recusa esse prefixo.'
    }
} else {
    Escrever-Aviso 'Nao achei o applicationId; vou deixar o flutterfire decidir.'
}

# ------------------------------------------------------- 5. vincular o app
Escrever-Titulo '5/7  Registrando o app e gerando as credenciais'

$plataformas = if (Test-Path (Join-Path $raiz 'ios')) { 'android,ios' } else { 'android' }
Write-Host "   Plataformas: $plataformas"

$arquivoOpcoes = Join-Path $raiz 'lib\firebase_options.dart'

# Se ja rodou antes e apontando para o mesmo projeto, nao ha o que refazer.
$jaConfigurado = $false
if (Test-Path $arquivoOpcoes) {
    $opcoes = Get-Content $arquivoOpcoes -Raw
    if ($opcoes -match [regex]::Escape("projectId: '$projetoFinal'")) {
        $jaConfigurado = $true
        Escrever-Ok "lib/firebase_options.dart ja aponta para $projetoFinal - pulando."
    }
}

if (-not $jaConfigurado) {
    # Tres chamadas explicitas em vez de montar um array de argumentos: mais
    # verboso, mas nao depende de como o PowerShell trata splatting em comando nativo.
    # O flutterfire monta a propria lista de projetos, e ela as vezes demora mais
    # a incluir um projeto novo do que a lista da CLI do Firebase - daí as tentativas.
    $tentativasFf = 3
    foreach ($n in 1..$tentativasFf) {
        if ($PacoteAndroid -and $plataformas -like '*ios*') {
            flutterfire configure --project=$projetoFinal --platforms=$plataformas --android-package-name=$PacoteAndroid --ios-bundle-id=$PacoteAndroid --yes
        } elseif ($PacoteAndroid) {
            flutterfire configure --project=$projetoFinal --platforms=$plataformas --android-package-name=$PacoteAndroid --yes
        } else {
            flutterfire configure --project=$projetoFinal --platforms=$plataformas --yes
        }
        if ($LASTEXITCODE -eq 0) { break }
        if ($n -lt $tentativasFf) {
            Escrever-Aviso "flutterfire nao achou o projeto ainda. Esperando 20s e tentando de novo ($n/$tentativasFf)..."
            Start-Sleep -Seconds 20
        }
    }
}

if (-not (Test-Path $arquivoOpcoes)) {
    Write-Host ''
    Escrever-Erro 'O flutterfire nao gerou lib/firebase_options.dart.'
    Write-Host ''
    Write-Host '   O projeto existe (a CLI do Firebase responde por ele), mas o flutterfire'
    Write-Host '   mantem a propria lista e pode estar desatualizada. Nesta ordem:'
    Write-Host ''
    Write-Host '   1) atualize o flutterfire e rode este script de novo:'
    Write-Host '      dart pub global activate flutterfire_cli' -ForegroundColor White
    Write-Host ''
    Write-Host '   2) se insistir, rode a mao para ver o erro completo:'
    Write-Host "      flutterfire configure --project=$projetoFinal" -ForegroundColor White
    Write-Host ''
    Write-Host '   3) ultimo recurso, pelo console: Configuracoes do projeto > Seus apps >'
    Write-Host "      Android, com o pacote $PacoteAndroid, baixe o google-services.json"
    Write-Host '      para android/app/ e rode o flutterfire de novo.'
    Write-Host ''
    exit 1
}
Escrever-Ok 'lib/firebase_options.dart gerado'

if (Test-Path (Join-Path $raiz 'android\app\google-services.json')) {
    Escrever-Ok 'android/app/google-services.json gerado'
} else {
    Escrever-Aviso 'google-services.json nao apareceu em android/app/. O push pode nao funcionar.'
}

# ------------------------------------------------------------------ 6. Firestore
Escrever-Titulo '6/7  Banco de dados Firestore'

$saidaBanco = firebase firestore:databases:create "(default)" --location=$Regiao --project $projetoFinal 2>&1 | Out-String
$bancoCriado = ($LASTEXITCODE -eq 0)

if (-not $bancoCriado -and ($saidaBanco -match 'already exists|ALREADY_EXISTS')) {
    $bancoCriado = $true
    Escrever-Ok 'O banco ja existia.'
}

if ($bancoCriado) {
    Escrever-Ok "Firestore pronto em $Regiao"
} else {
    Escrever-Aviso 'Nao consegui criar o banco pela CLI (a sintaxe muda entre versoes).'
    Write-Host '   Abra a pagina abaixo, clique em "Criar banco de dados", escolha o modo'
    Write-Host "   de producao e a regiao $Regiao :"
    Write-Host "   https://console.firebase.google.com/project/$projetoFinal/firestore" -ForegroundColor White
    Start-Process "https://console.firebase.google.com/project/$projetoFinal/firestore"
    Read-Host '   Quando o banco estiver criado, aperte Enter para continuar'
}

# --------------------------------------------------------------- 7. regras
Escrever-Titulo '7/7  Publicando as regras de seguranca'

firebase deploy --only firestore:rules --project $projetoFinal
if ($LASTEXITCODE -eq 0) {
    Escrever-Ok 'Regras de firestore.rules publicadas'
} else {
    Escrever-Aviso 'O deploy das regras falhou (comum se o banco acabou de ser criado).'
    Write-Host "   Tente de novo em alguns segundos com:"
    Write-Host "   firebase deploy --only firestore:rules" -ForegroundColor White
}

# --------------------------------------- passo manual: login por e-mail/senha
Escrever-Titulo 'Falta um passo, e so este'

Write-Host '   O Firebase nao permite habilitar provedores de login pela CLI.'
Write-Host '   Na pagina que vou abrir: clique em "E-mail/senha", ligue a chave'
Write-Host '   e clique em Salvar.'
Write-Host ''
Write-Host "   https://console.firebase.google.com/project/$projetoFinal/authentication/providers" -ForegroundColor White
Start-Process "https://console.firebase.google.com/project/$projetoFinal/authentication/providers"
Read-Host '   Aperte Enter quando tiver salvo'

# ------------------------------------------------------------------- conclusao
Escrever-Titulo 'Tudo pronto'

Write-Host "   Projeto Firebase: $projetoFinal"
Write-Host "   Console: https://console.firebase.google.com/project/$projetoFinal"
Write-Host ''
Write-Host '   Agora rode o app:'
Write-Host '     flutter analyze' -ForegroundColor White
Write-Host '     flutter run' -ForegroundColor White
Write-Host ''
Write-Host '   Crie uma conta na tela de login e registre um lancamento. Ele aparece'
Write-Host "   no console em Firestore > usuarios > {seu-uid} > transacoes."
Write-Host ''
