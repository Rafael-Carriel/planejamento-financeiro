#Requires -Version 5.1
<#
    enviar-para-o-github.ps1

    Envia este repositório para o GitHub:
    git@github.com:Rafael-Carriel/planejamento-financeiro.git

        .\enviar-para-o-github.ps1

    Só o envio. O repositório já está criado e com o primeiro commit feito.
#>

# De propósito 'Continue': o git escreve o progresso na saída de erro, e com
# 'Stop' o PowerShell trataria isso como falha (NativeCommandError). Aqui a
# checagem é pelo código de saída de cada comando.
$ErrorActionPreference = 'Continue'

Set-Location $PSScriptRoot

$remoto = 'git@github.com:Rafael-Carriel/planejamento-financeiro.git'

function Titulo($texto) {
    Write-Host ''
    Write-Host $texto -ForegroundColor Cyan
}

function Parar($texto) {
    Write-Host ''
    Write-Host $texto -ForegroundColor Yellow
    exit 1
}

Titulo 'Conferindo o git'

git --version | Out-Null
if ($LASTEXITCODE -ne 0) {
    Parar 'O git não está instalado ou não está no PATH. Baixe em https://git-scm.com/download/win'
}

git rev-parse --is-inside-work-tree 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Parar 'Esta pasta não é um repositório git. Rode o script na raiz do projeto.'
}

$urlAtual = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Sem remoto configurado. Adicionando origin...'
    git remote add origin $remoto
} elseif ($urlAtual.Trim() -ne $remoto) {
    Write-Host "O remoto origin aponta para outro lugar: $urlAtual"
    Write-Host "Trocando para $remoto"
    git remote set-url origin $remoto
}

Titulo 'Conferindo a chave SSH'

$pastaSsh = Join-Path $HOME '.ssh'
$chaves = @()
if (Test-Path $pastaSsh) {
    $chaves = @(Get-ChildItem $pastaSsh -Filter '*.pub' -ErrorAction SilentlyContinue)
}

if ($chaves.Count -eq 0) {
    Write-Host 'Nenhuma chave SSH encontrada. Vou criar uma agora.'
    Write-Host 'Aperte Enter nas perguntas para aceitar o padrão (pode deixar sem senha).'
    Write-Host ''

    if (-not (Test-Path $pastaSsh)) {
        New-Item -ItemType Directory -Path $pastaSsh | Out-Null
    }

    $caminhoChave = Join-Path $pastaSsh 'id_ed25519'
    ssh-keygen -t ed25519 -C 'planejamento-financeiro' -f $caminhoChave
    if ($LASTEXITCODE -ne 0) {
        Parar 'Não deu para criar a chave. Confira se o OpenSSH está instalado (Configurações > Aplicativos > Recursos opcionais).'
    }

    $publica = Get-Content "$caminhoChave.pub" -Raw

    Write-Host ''
    Write-Host 'Copie a chave abaixo e cole em github.com/settings/ssh/new:' -ForegroundColor Green
    Write-Host ''
    Write-Host $publica
    Write-Host ''

    try { $publica.Trim() | Set-Clipboard; Write-Host '(a chave já foi copiada para a área de transferência)' } catch { }

    Write-Host ''
    Read-Host 'Depois de colar a chave no GitHub, aperte Enter para continuar'
} else {
    Write-Host "Chave encontrada: $($chaves[0].FullName)"
}

Titulo 'Testando a conexão com o GitHub'

# O `ssh -T` do GitHub sempre sai com código 1, mesmo dando certo. O que vale é
# a frase que ele devolve.
$resposta = (ssh -o StrictHostKeyChecking=accept-new -T git@github.com 2>&1) | Out-String
Write-Host $resposta.Trim()

if ($resposta -notmatch 'successfully authenticated') {
    Parar @"
O GitHub não reconheceu a chave. Duas causas comuns:
  1. a chave pública ainda não foi colada em github.com/settings/keys
  2. o repositório planejamento-financeiro ainda não existe na sua conta —
     crie em github.com/new, vazio, sem README
"@
}

Titulo 'Enviando'

$ramo = (git rev-parse --abbrev-ref HEAD).Trim()
if ($ramo -ne 'main') {
    Write-Host "Renomeando o ramo $ramo para main"
    git branch -M main
    $ramo = 'main'
}

git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Parar @"
O envio falhou. Se a mensagem falou em 'rejected' ou 'fetch first', é porque o
repositório no GitHub já tem algo dentro (um README criado junto, por exemplo).
Nesse caso:

    git pull --rebase origin main
    git push -u origin main
"@
}

Write-Host ''
Write-Host 'Pronto. O projeto está em https://github.com/Rafael-Carriel/planejamento-financeiro' -ForegroundColor Green
Write-Host ''
Write-Host 'Daqui para a frente, para salvar mudanças:' -ForegroundColor DarkGray
Write-Host '    git add -A' -ForegroundColor DarkGray
Write-Host '    git commit -m "o que mudou"' -ForegroundColor DarkGray
Write-Host '    git push' -ForegroundColor DarkGray
