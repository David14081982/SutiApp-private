param(
  [ValidateSet('all', 'sources', 'mocks', 'architecture', 'legacy', 'security')]
  [string]$Check = 'all'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$targets = @(
  (Join-Path $repoRoot 'app'),
  (Join-Path $repoRoot 'SutiApp.html'),
  (Join-Path $repoRoot 'sw.js'),
  (Join-Path $repoRoot 'manifest.webmanifest')
)
$files = foreach ($target in $targets) {
  if (Test-Path -LiteralPath $target -PathType Container) {
    Get-ChildItem -LiteralPath $target -Recurse -File | Where-Object { $_.Name -ne 'bundle.js' }
  } elseif (Test-Path -LiteralPath $target -PathType Leaf) {
    Get-Item -LiteralPath $target
  }
}

$checks = [ordered]@{
  sources = 'localStorage|sessionStorage|indexedDB|window\.DATA|FUNDS_SEED|\.json|fetch\(|caches\.|fallback|seed\w*\s*\('
  mocks = '\bmock\b|\bmocks\b|fixture|defaultData|initialData|sample|\bdemo\b|\bseed\b|hardcoded'
  architecture = 'window\.DATA|localStorage|fetch\(|window\.[A-Za-z0-9_]+Store|\|\|\s*(window\.DATA|DATA)|\?\?\s*(window\.DATA|DATA)'
  legacy = 'Google Sheets|Apps Script|ahorro|pr[eé]stamo|amortiza|concili|saldo|tasa|financ|n[oó]mina'
  security = 'service_role|api[_-]?key|secret|bearer|authorization|password|contrase[nñ]a|login\s*[:=]|isAuth|actingRole|role|permiso|auth'
}

$selected = if ($Check -eq 'all') { @($checks.Keys) } else { @($Check) }
$total = 0
foreach ($name in $selected) {
  Write-Output "=== audit:$name ==="
  $hits = $files | Select-String -Pattern $checks[$name] -CaseSensitive:$false
  foreach ($hit in $hits) {
    $relative = if ($hit.Path.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      $hit.Path.Substring($repoRoot.Length).TrimStart([char[]]@('\', '/'))
    } else {
      $hit.Path
    }
    Write-Output ("{0}:{1}: {2}" -f $relative, $hit.LineNumber, $hit.Line.Trim())
  }
  $count = @($hits).Count
  $total += $count
  Write-Output "FINDINGS: $count"
}

Write-Output 'AUDIT STATUS: PASS'
if ($total -gt 0) {
  Write-Output 'VERDICT: REVIEW REQUIRED'
} else {
  Write-Output 'VERDICT: SAFE (no static matches)'
}
Write-Output 'NOTE: Static matches require classification; absence of matches is not proof of runtime safety.'
