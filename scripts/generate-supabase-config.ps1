param(
  [string]$EnvFile = 'supabase.env',
  [string]$OutputFile = 'app/supabase-config.js'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Environment file not found: $EnvFile"
}

$values = @{}
Get-Content -LiteralPath $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#') -or -not $line.Contains('=')) { return }
  $separator = $line.IndexOf('=')
  $name = $line.Substring(0, $separator).Trim()
  $value = $line.Substring($separator + 1).Trim().Trim('"').Trim("'")
  $values[$name] = $value
}

$url = $values['SUPABASE_URL']
$key = $values['SUPABASE_PUBLISHABLE_KEY']
if (-not $url -or -not $key) {
  throw 'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required'
}

$urlJson = $url | ConvertTo-Json -Compress
$keyJson = $key | ConvertTo-Json -Compress
$content = "window.__SUTIAPP_CONFIG__ = Object.freeze({ supabase: Object.freeze({ url: $urlJson, publishableKey: $keyJson }) });`n"
Set-Content -LiteralPath $OutputFile -Value $content -Encoding UTF8
Write-Output "Generated ignored runtime configuration: $OutputFile"
