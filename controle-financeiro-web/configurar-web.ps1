#Requires -Version 5.1
<#
    configurar-web.ps1

    Liga este app web ao projeto do Firebase que o aplicativo do celular já usa.

    O projeto do Flutter só registrou o app Android, então a configuração do SDK
    web ainda não existe. Este script registra o app web (se preciso), lê a
    configuração pela CLI do Firebase e grava o .env.local que o Vite lê.

    Rode uma vez:
        .\configurar-web.ps1

    Rodar de novo é seguro: se o app web já existir, ele só reescreve o
    .env.local (guardando o anterior em .env.local.backup).
#>

$ErrorActionPreference = 'Stop'

$projeto = 'controle-financeiro-rafael'
$nomeDoApp = 'Controle Financeiro Web'
$pasta = $PSScriptRoot
$arquivoDeAmbiente = Join-Path $pasta '.env.local'

function Escrever-Passo { param([string]$Texto) Write-Host "`n==> $Texto" -ForegroundColor Cyan }
function Escrever-Ok    { param([string]$Texto) Write-Host "    $Texto" -ForegroundColor Green }
function Escrever-Nota  { param([string]$Texto) Write-Host "    $Texto" -ForegroundColor DarkGray }

# A CLI do Firebase escreve o spinner de progresso ("- Creating your Web app")
# na saída de erro, não na saída padrão. Em PowerShell 5.1, com
# $ErrorActionPreference = 'Stop', qualquer linha de stderr vinda de um programa
# externo vira erro terminante (NativeCommandError) e derruba o script mesmo
# quando o comando deu certo. Por isso, aqui dentro a preferência volta para
# 'Continue' e quem decide sucesso ou falha é o código de saída.
function Invoke-Firebase {
    param([string[]]$Argumentos, [switch]$PermitirFalha)

    $anterior = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $bruto = & firebase @Argumentos 2>&1
    }
    finally {
        $ErrorActionPreference = $anterior
    }
    $codigo = $LASTEXITCODE

    $texto = (@($bruto) | ForEach-Object {
        if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.ToString() } else { "$_" }
    }) -join "`n"

    if ($codigo -ne 0 -and -not $PermitirFalha) {
        # As chaves em ${codigo} não são enfeite: sem elas o PowerShell lê
        # "$codigo:" como variável qualificada por unidade (tipo $env:PATH) e o
        # arquivo nem chega a rodar.
        throw "O comando 'firebase $($Argumentos -join ' ')' terminou com código ${codigo}:`n$texto"
    }
    return $texto
}

# A CLI mistura avisos e spinner com o JSON, então corto do primeiro { ao
# último } em vez de converter a saída inteira.
function ConvertFrom-SaidaJson {
    param([string]$Texto)

    $inicio = $Texto.IndexOf('{')
    $fim = $Texto.LastIndexOf('}')
    if ($inicio -lt 0 -or $fim -le $inicio) {
        throw "a resposta não tem JSON."
    }
    return ($Texto.Substring($inicio, $fim - $inicio + 1) | ConvertFrom-Json)
}

# Pesca um valor da configuração sem depender do formato exato da resposta:
# serve tanto para JSON com chaves entre aspas quanto para o objeto JavaScript
# que algumas versões da CLI devolvem.
function Get-ValorDaConfig {
    param([string]$Texto, [string]$Chave)

    $padrao = '["'']?' + [regex]::Escape($Chave) + '["'']?\s*:\s*["'']([^"'']+)["'']'
    $encontrado = [regex]::Match($Texto, $padrao)
    if ($encontrado.Success) { return $encontrado.Groups[1].Value }
    return ''
}

function Get-AppWeb {
    $texto = Invoke-Firebase @('apps:list', 'WEB', '--project', $projeto, '--json') -PermitirFalha
    try {
        $dados = ConvertFrom-SaidaJson $texto
        $apps = if ($null -ne $dados.result) { $dados.result } else { $dados }
        return (@($apps) |
            Where-Object { $_.appId -and "$($_.platform)".ToUpper() -eq 'WEB' } |
            Select-Object -First 1)
    }
    catch {
        Escrever-Nota "Não deu para ler a lista de apps ($($_.Exception.Message))."
        return $null
    }
}

Escrever-Passo 'Verificando a CLI do Firebase'
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host @"

A CLI do Firebase não foi encontrada. Instale e rode este script de novo:

    npm install -g firebase-tools
    firebase login

"@ -ForegroundColor Yellow
    exit 1
}
$versao = (Invoke-Firebase @('--version') -PermitirFalha) -split "`n" |
    Where-Object { $_ -match '^\s*\d+\.\d+' } | Select-Object -First 1
Escrever-Ok "firebase-tools $($versao.Trim())"

Escrever-Passo 'Verificando o login'
$contas = Invoke-Firebase @('login:list') -PermitirFalha
if ($contas -match 'No authorized accounts|Nenhuma conta') {
    Write-Host "`nVocê ainda não entrou na conta do Firebase. Rodando 'firebase login'…" -ForegroundColor Yellow
    $anterior = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & firebase login } finally { $ErrorActionPreference = $anterior }
    if ($LASTEXITCODE -ne 0) { throw 'O login no Firebase não foi concluído.' }
}
Escrever-Ok 'Sessão ativa.'

Escrever-Passo "Procurando um app web em $projeto"
$app = Get-AppWeb

if ($null -eq $app) {
    Escrever-Passo "Registrando o app web '$nomeDoApp'"
    $criado = Invoke-Firebase @('apps:create', 'WEB', $nomeDoApp, '--project', $projeto, '--json') -PermitirFalha
    try {
        $dados = ConvertFrom-SaidaJson $criado
        $app = if ($null -ne $dados.result) { $dados.result } else { $dados }
    }
    catch {
        Escrever-Nota "Não deu para ler a resposta da criação ($($_.Exception.Message)). Vou conferir na lista."
    }
    # Se a criação chegou a acontecer mas a resposta veio ilegível, a lista
    # resolve — e evita registrar um segundo app web à toa.
    if ($null -eq $app -or -not $app.appId) { $app = Get-AppWeb }
    if ($null -eq $app -or -not $app.appId) {
        Write-Host "`nResposta da CLI, para conferência:`n$criado" -ForegroundColor DarkGray
        throw 'Não consegui registrar nem encontrar o app web.'
    }
    Escrever-Ok "App web: $($app.appId)"
}
else {
    Escrever-Ok "App já existia: $($app.appId)"
}

Escrever-Passo 'Lendo a configuração do SDK'
$bruto = Invoke-Firebase @('apps:sdkconfig', 'WEB', $app.appId, '--project', $projeto, '--json')

$valores = [ordered]@{
    'VITE_FIREBASE_API_KEY'             = Get-ValorDaConfig $bruto 'apiKey'
    'VITE_FIREBASE_AUTH_DOMAIN'         = Get-ValorDaConfig $bruto 'authDomain'
    'VITE_FIREBASE_PROJECT_ID'          = Get-ValorDaConfig $bruto 'projectId'
    'VITE_FIREBASE_STORAGE_BUCKET'      = Get-ValorDaConfig $bruto 'storageBucket'
    'VITE_FIREBASE_MESSAGING_SENDER_ID' = Get-ValorDaConfig $bruto 'messagingSenderId'
    'VITE_FIREBASE_APP_ID'              = Get-ValorDaConfig $bruto 'appId'
}

$faltando = $valores.Keys | Where-Object { [string]::IsNullOrWhiteSpace($valores[$_]) }
if ($faltando.Count -gt 0) {
    Write-Host "`nNão consegui extrair: $($faltando -join ', ')" -ForegroundColor Yellow
    Write-Host "Resposta da CLI, para conferência:`n$bruto" -ForegroundColor DarkGray
    Write-Host @"

Preencha à mão: abra o .env.local e complete com os dados de Configurações do
projeto > Seus apps > app da Web, no console do Firebase.

"@ -ForegroundColor Yellow
    exit 1
}

if (Test-Path $arquivoDeAmbiente) {
    $reserva = "$arquivoDeAmbiente.backup"
    Copy-Item $arquivoDeAmbiente $reserva -Force
    Escrever-Nota "O .env.local anterior foi guardado em $(Split-Path $reserva -Leaf)."
}

$linhas = @(
    '# Gerado por configurar-web.ps1. Não precisa versionar: o .gitignore já ignora.',
    '# Estas chaves são públicas por natureza — o navegador precisa delas para',
    '# falar com o Firebase. Quem protege os dados são as regras do Firestore.',
    ''
)
foreach ($chave in $valores.Keys) { $linhas += "$chave=$($valores[$chave])" }

# UTF-8 sem BOM: o Vite lê o arquivo como texto simples e o BOM viraria parte do
# nome da primeira variável.
[System.IO.File]::WriteAllLines($arquivoDeAmbiente, $linhas, (New-Object System.Text.UTF8Encoding($false)))
Escrever-Ok "Escrevi $arquivoDeAmbiente"

Escrever-Passo 'Pronto'
Write-Host @"

Confira no console do Firebase se o login por e-mail e senha está ligado:
Authentication > Sign-in method > Email/Password.

Agora, na pasta do projeto (pare o 'npm run dev' se estiver aberto — o Vite só
lê o .env.local na inicialização):

    npm run dev

O app abre em http://localhost:5173

"@ -ForegroundColor Green
