#Requires -Version 5.1
<#
    iniciar.ps1

    Sobe o app em modo de desenvolvimento, instalando as dependências na
    primeira vez.

        .\iniciar.ps1
#>

$ErrorActionPreference = 'Stop'

$pasta = $PSScriptRoot
Set-Location $pasta

if (-not (Test-Path (Join-Path $pasta '.env.local'))) {
    Write-Host @"

Falta o .env.local — o app não sabe com qual projeto do Firebase falar.
Rode primeiro:

    .\configurar-web.ps1

"@ -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path (Join-Path $pasta 'node_modules'))) {
    Write-Host "`n==> Instalando as dependências (só na primeira vez)" -ForegroundColor Cyan
    & npm install
    if ($LASTEXITCODE -ne 0) { throw 'npm install falhou.' }
}

Write-Host "`n==> Subindo em http://localhost:5173`n" -ForegroundColor Cyan
& npm run dev
