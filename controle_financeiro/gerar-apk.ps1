<#
.SYNOPSIS
    Compila o app e deixa um APK pronto para instalar no celular.

.DESCRIPTION
    Faz, nesta ordem:

      1. confere se o Firebase foi vinculado (firebase_options.dart e
         google-services.json), porque sem isso o build falha;
      2. roda `flutter analyze`, que acha erro de codigo em segundos em vez de
         minutos - vale muito na primeira compilacao;
      3. compila o APK;
      4. copia o resultado para a raiz do projeto com um nome decente e mostra
         o tamanho e o caminho.

    A primeira compilacao baixa bastante coisa do Gradle e pode levar de 5 a 15
    minutos. As seguintes levam menos de um minuto.

.PARAMETER Modo
    release (padrao) gera um APK rapido e pequeno, do jeito que voce usaria no
    dia a dia. debug gera um APK maior e mais lento, com a faixa de debug na
    tela, mas que mostra mensagens de erro mais detalhadas.

.PARAMETER PularAnalise
    Vai direto para a compilacao, sem rodar o flutter analyze.

.EXAMPLE
    .\gerar-apk.ps1

.EXAMPLE
    .\gerar-apk.ps1 -Modo debug
#>
param(
    [ValidateSet('release', 'debug')]
    [string]$Modo = 'release',
    [switch]$PularAnalise
)

# Comandos externos nao lancam excecao no PowerShell: conferimos $LASTEXITCODE.
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
Write-Host '######################################################' -ForegroundColor Cyan
Write-Host '#  Controle Financeiro - gerar APK para o celular    #' -ForegroundColor Cyan
Write-Host '######################################################'

# --------------------------------------------------------------- 1. pre-checagem
Escrever-Titulo '1/4  Conferindo o que o build precisa'

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    Parar 'Flutter nao encontrado no PATH.'
}
Escrever-Ok 'flutter'

if (-not (Test-Path (Join-Path $raiz 'lib\firebase_options.dart'))) {
    Parar 'Falta lib/firebase_options.dart. Rode ".\criar-firebase.ps1" primeiro.'
}
Escrever-Ok 'lib/firebase_options.dart'

if (-not (Test-Path (Join-Path $raiz 'android\app\google-services.json'))) {
    Parar 'Falta android/app/google-services.json. Rode ".\criar-firebase.ps1" primeiro.'
}
Escrever-Ok 'android/app/google-services.json'

# O pacote do google-services.json tem que casar com o applicationId, senao o
# app compila e depois quebra ao iniciar o Firebase, com erro pouco obvio.
$gradle = Get-Content (Join-Path $raiz 'android\app\build.gradle.kts') -Raw
$servicos = Get-Content (Join-Path $raiz 'android\app\google-services.json') -Raw
if ($gradle -match 'applicationId\s*=\s*"([^"]+)"') {
    $pacote = $Matches[1]
    if ($servicos -match [regex]::Escape("`"package_name`": `"$pacote`"")) {
        Escrever-Ok "Pacote $pacote confere com o google-services.json"
    } else {
        Escrever-Aviso "O google-services.json nao menciona $pacote."
        Write-Host '   O app vai compilar, mas pode falhar ao iniciar o Firebase.'
        Write-Host "   Para corrigir: flutterfire configure --android-package-name=$pacote" -ForegroundColor White
    }
}

# -------------------------------------------------------------------- 2. analise
Escrever-Titulo '2/4  Analisando o codigo'

if ($PularAnalise) {
    Escrever-Aviso 'Analise pulada por opcao (-PularAnalise).'
} else {
    flutter analyze
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Escrever-Aviso 'O analyze apontou problemas (veja acima).'
        Write-Host '   Se a mensagem falar de tipo de tema, algo como "CardThemeData nao pode'
        Write-Host '   ser atribuido a CardTheme", e so renomear a classe em lib/core/theme.dart'
        Write-Host '   para o nome que o erro pedir - a secao 7 do SETUP.md explica.'
        Write-Host ''
        Write-Host '   Avisos e sugestoes nao impedem a compilacao; erros impedem.'
        $seguir = Read-Host '   Compilar mesmo assim? (s/N)'
        if ($seguir -notmatch '^[sS]') {
            Write-Host ''
            Write-Host '   Corrija e rode de novo. Nada foi compilado.'
            exit 1
        }
    } else {
        Escrever-Ok 'Nenhum problema encontrado'
    }
}

# ------------------------------------------------------------------ 3. compilacao
Escrever-Titulo "3/4  Compilando o APK em modo $Modo"

Write-Host '   A primeira vez costuma levar de 5 a 15 minutos. Pode deixar rodando.'
Write-Host ''

if ($Modo -eq 'debug') {
    flutter build apk --debug
} else {
    flutter build apk --release
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Escrever-Erro 'A compilacao falhou.'
    Write-Host '   Se o erro citar Gradle ou Java, rode "flutter doctor -v" e veja qual JDK'
    Write-Host '   o Flutter esta usando; normalmente basta atualizar o Android Studio.'
    Write-Host '   Se citar minSdk, confirme que android/app/build.gradle.kts tem minSdk = 23.'
    Write-Host ''
    exit 1
}

# ------------------------------------------------------------------- 4. resultado
Escrever-Titulo '4/4  APK pronto'

$origem = Join-Path $raiz "build\app\outputs\flutter-apk\app-$Modo.apk"
if (-not (Test-Path $origem)) {
    Parar "A compilacao terminou mas nao achei $origem."
}

$destino = Join-Path $raiz "ControleFinanceiro-$Modo.apk"
Copy-Item $origem $destino -Force

$tamanho = [math]::Round((Get-Item $destino).Length / 1MB, 1)
Escrever-Ok "$tamanho MB"
Write-Host ''
Write-Host '   Arquivo:' -NoNewline
Write-Host " $destino" -ForegroundColor White
Write-Host ''
Write-Host '   Para instalar no celular, escolha um caminho:'
Write-Host ''
Write-Host '   - Mande o arquivo para voce mesmo no WhatsApp, Telegram ou Google Drive'
Write-Host '     e abra pelo celular.'
Write-Host '   - Ou ligue o cabo USB, copie o APK para a pasta Download do aparelho e'
Write-Host '     abra pelo gerenciador de arquivos.'
Write-Host ''
Write-Host '   Na primeira instalacao o Android vai pedir para autorizar a instalacao de'
Write-Host '   apps dessa origem. E o aviso normal de app fora da Play Store.'
Write-Host ''
Write-Host '   Precisa de Android 6.0 ou superior (o minSdk do projeto e 23).'
Write-Host ''
Write-Host '   Se o app abrir e fechar na hora, o APK nao mostra o motivo. Nesse caso'
Write-Host '   ligue o celular no cabo com a depuracao USB ativada e rode:'
Write-Host '     flutter run' -ForegroundColor White
Write-Host '   que ai o erro aparece no terminal.'
Write-Host ''
