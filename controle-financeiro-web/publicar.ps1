#Requires -Version 5.1
<#
    publicar.ps1

    Compila o app e publica no Firebase Hosting.

    A checagem de tipos roda antes do empacotamento (é o que 'npm run build'
    faz), então um erro de tipo interrompe aqui e não vai para o ar.

        .\publicar.ps1
#>

$ErrorActionPreference = 'Stop'

$pasta = $PSScriptRoot
$projeto = 'controle-financeiro-rafael'

function Escrever-Passo { param([string]$Texto) Write-Host "`n==> $Texto" -ForegroundColor Cyan }

Set-Location $pasta

if (-not (Test-Path (Join-Path $pasta '.env.local'))) {
    Write-Host @"

Falta o .env.local. Rode primeiro:

    .\configurar-web.ps1

"@ -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path (Join-Path $pasta 'node_modules'))) {
    Escrever-Passo 'Instalando as dependências'
    & npm install
    if ($LASTEXITCODE -ne 0) { throw 'npm install falhou.' }
}

Escrever-Passo 'Compilando (checagem de tipos + build)'
& npm run build
if ($LASTEXITCODE -ne 0) { throw 'O build falhou. Nada foi publicado.' }

Escrever-Passo 'Publicando no Firebase Hosting'
& firebase deploy --only hosting --project $projeto
if ($LASTEXITCODE -ne 0) { throw 'O deploy falhou.' }

Write-Host "`nPublicado: https://$projeto.web.app`n" -ForegroundColor Green
