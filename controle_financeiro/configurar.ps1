<#
.SYNOPSIS
    Prepara o projeto Controle Financeiro para rodar.

.DESCRIPTION
    O `flutter create` sobrescreve pubspec.yaml e lib/main.dart pelos modelos
    padrão. Para não perder o código do app, este script:

      1. guarda lib/, pubspec.yaml e analysis_options.yaml em .backup_app;
      2. roda `flutter create .` para gerar as pastas nativas (android/, ios/);
      3. devolve os arquivos guardados por cima dos modelos;
      4. ajusta o minSdk do Android para 23 (exigido pelo firebase_auth);
      5. baixa as dependências.

.PARAMETER Org
    Identificador reverso da sua aplicação. Vira o package name no Android e o
    bundle id no iOS. Use algo seu, por exemplo br.com.rafael.

.EXAMPLE
    .\configurar.ps1 -Org br.com.rafael
#>
param(
    # Mesmo valor ja usado no applicationId de android/app/build.gradle.kts.
    [string]$Org = 'br.com.rafael',
    [string]$Plataformas = 'android'
)

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
Set-Location $raiz

Write-Host ''
Write-Host '== Controle Financeiro: configuracao inicial ==' -ForegroundColor Cyan
Write-Host ''

# --- 1. Flutter instalado? ---------------------------------------------------
if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    Write-Host 'Flutter nao encontrado no PATH.' -ForegroundColor Red
    Write-Host 'Instale em https://docs.flutter.dev/get-started/install/windows'
    exit 1
}
Write-Host '-> Flutter encontrado.' -ForegroundColor Green

# --- 2. Backup do codigo do app ---------------------------------------------
$backup = Join-Path $raiz '.backup_app'
if (Test-Path $backup) { Remove-Item $backup -Recurse -Force }
New-Item -ItemType Directory -Path $backup | Out-Null

Copy-Item (Join-Path $raiz 'lib') -Destination (Join-Path $backup 'lib') -Recurse -Force
if (Test-Path (Join-Path $raiz 'test')) {
    Copy-Item (Join-Path $raiz 'test') -Destination (Join-Path $backup 'test') -Recurse -Force
}
foreach ($arquivo in @('pubspec.yaml', 'analysis_options.yaml')) {
    if (Test-Path (Join-Path $raiz $arquivo)) {
        Copy-Item (Join-Path $raiz $arquivo) -Destination $backup -Force
    }
}
Write-Host '-> Codigo do app guardado em .backup_app' -ForegroundColor Green

# --- 3. Gera as pastas nativas ----------------------------------------------
Write-Host ''
Write-Host "-> Rodando flutter create (org: $Org)..." -ForegroundColor Cyan
flutter create . --project-name controle_financeiro --org $Org --platforms=$Plataformas
if ($LASTEXITCODE -ne 0) {
    Write-Host 'flutter create falhou. Nada foi perdido: seu codigo esta em .backup_app' -ForegroundColor Red
    exit 1
}

# --- 4. Restaura o codigo do app --------------------------------------------
Remove-Item (Join-Path $raiz 'lib') -Recurse -Force
Copy-Item (Join-Path $backup 'lib') -Destination (Join-Path $raiz 'lib') -Recurse -Force
if (Test-Path (Join-Path $backup 'test')) {
    if (Test-Path (Join-Path $raiz 'test')) {
        Remove-Item (Join-Path $raiz 'test') -Recurse -Force
    }
    Copy-Item (Join-Path $backup 'test') -Destination (Join-Path $raiz 'test') -Recurse -Force
}
# O teste de exemplo do Flutter aponta para uma classe MyApp que nao existe
# aqui; deixa-lo quebraria o `flutter test`.
$testeExemplo = Join-Path $raiz 'test\widget_test.dart'
if (Test-Path $testeExemplo) { Remove-Item $testeExemplo -Force }
foreach ($arquivo in @('pubspec.yaml', 'analysis_options.yaml')) {
    $origem = Join-Path $backup $arquivo
    if (Test-Path $origem) { Copy-Item $origem -Destination $raiz -Force }
}
Write-Host '-> Codigo do app restaurado sobre os modelos do Flutter.' -ForegroundColor Green

# --- 5. minSdk 23 (exigencia do firebase_auth) ------------------------------
$ajustou = $false
$kts = Join-Path $raiz 'android\app\build.gradle.kts'
if (Test-Path $kts) {
    $conteudo = Get-Content $kts -Raw
    if ($conteudo -match 'minSdk\s*=\s*flutter\.minSdkVersion') {
        ($conteudo -replace 'minSdk\s*=\s*flutter\.minSdkVersion', 'minSdk = 23') |
            Set-Content $kts -NoNewline
        $ajustou = $true
    }
}
$groovy = Join-Path $raiz 'android\app\build.gradle'
if (-not $ajustou -and (Test-Path $groovy)) {
    $conteudo = Get-Content $groovy -Raw
    if ($conteudo -match 'minSdkVersion\s+flutter\.minSdkVersion') {
        ($conteudo -replace 'minSdkVersion\s+flutter\.minSdkVersion', 'minSdkVersion 23') |
            Set-Content $groovy -NoNewline
        $ajustou = $true
    }
}
if ($ajustou) {
    Write-Host '-> minSdk do Android ajustado para 23.' -ForegroundColor Green
} else {
    Write-Host '!! Nao consegui ajustar o minSdk automaticamente.' -ForegroundColor Yellow
    Write-Host '   Abra android/app/build.gradle.kts e defina minSdk = 23.' -ForegroundColor Yellow
}

# --- 6. Dependencias --------------------------------------------------------
Write-Host ''
Write-Host '-> Baixando dependencias...' -ForegroundColor Cyan
flutter pub get
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'Conflito de versoes. Tentando resolver nas versoes atuais...' -ForegroundColor Yellow
    flutter pub upgrade --major-versions
}

Write-Host ''
Write-Host '== Pronto ==' -ForegroundColor Cyan
Write-Host 'Proximo passo: gerar o lib/firebase_options.dart com'
Write-Host '  dart pub global activate flutterfire_cli'
Write-Host '  flutterfire configure'
Write-Host ''
Write-Host 'O passo a passo completo esta no SETUP.md (passo 4 em diante).'
Write-Host ''
