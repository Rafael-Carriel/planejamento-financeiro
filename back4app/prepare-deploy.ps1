param([Parameter(Mandatory=$true)][string]$ExistingCloudPath, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'cloud'
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
$utf8 = [System.Text.UTF8Encoding]::new($false)
$mapping = @{ 'analytics.js'='planeja-analytics.js'; 'policy.js'='planeja-policy.js'; 'asaas.js'='planeja-asaas.js'; 'routes.js'='planeja-routes.js'; 'runtime.js'='planeja-runtime.js'; 'parse-entry.js'='planeja-entry.js' }
foreach ($file in $mapping.Keys) {
  $text = Get-Content -LiteralPath (Join-Path $source $file) -Raw
  $text = $text.Replace("require('./analytics')", "require('./planeja-analytics')").Replace("require('./policy')", "require('./planeja-policy')").Replace("require('./asaas')", "require('./planeja-asaas')").Replace("require('./routes')", "require('./planeja-routes')").Replace("require('./runtime')", "require('./planeja-runtime')")
  [System.IO.File]::WriteAllText((Join-Path $Destination $mapping[$file]), $text, $utf8)
}
# Existing code is retained byte-for-byte except for the coordinated scheduled job.
$entry = Get-Content -LiteralPath (Join-Path $ExistingCloudPath 'entry.js') -Raw
$old = 'const result = await getRuntime().service.syncAll();'
if (-not $entry.Contains($old) -and -not $entry.Contains("require('./planeja-entry').reconcile()")) { throw 'A entrada existente mudou. Revise antes de preparar o deploy.' }
$replacement = @'
const results = await Promise.allSettled([getRuntime().service.syncAll(), require('./planeja-entry').reconcile()]);
  if (results.some(result => result.status === 'rejected')) throw new Error('Uma das integrações precisa de nova conciliação.');
  const result = results[0].value;
'@
[System.IO.File]::WriteAllText((Join-Path $Destination 'entry.js'), $entry.Replace($old, $replacement), $utf8)
$main = Get-Content -LiteralPath (Join-Path $ExistingCloudPath 'main.js') -Raw
if (-not $main.Contains("'./planeja-entry'")) {
  if (-not $main.Contains("'./entry', './runtime', './billing', './policy'")) { throw 'main.js não reconhecido. Revise antes de publicar.' }
  $main = $main.Replace("'./entry', './runtime', './billing', './policy'", "'./entry', './runtime', './billing', './policy', './planeja-entry', './planeja-runtime', './planeja-routes', './planeja-policy', './planeja-asaas'")
}
if (-not $main.Contains("'./planeja-analytics'")) { $main = $main.Replace("'./planeja-asaas'", "'./planeja-asaas', './planeja-analytics'") }
if (-not $main.Contains("require('./planeja-entry');")) { $main += "`nrequire('./planeja-entry');`n" }
[System.IO.File]::WriteAllText((Join-Path $Destination 'main.js'), $main, $utf8)
Write-Output 'Pacote preparado com 6 módulos isolados e as 2 entradas coordenadas. Sem chaves privadas.'
