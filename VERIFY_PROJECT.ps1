$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectConfig = Join-Path $Root 'project.config.json'
$LoginWxml = Join-Path $Root 'miniprogram\pages\auth\login\index.wxml'
if (-not (Test-Path $ProjectConfig)) { throw "project.config.json is missing: $ProjectConfig" }
if (-not (Test-Path $LoginWxml)) { throw "Login WXML is missing: $LoginWxml" }
$item = Get-Item $LoginWxml
Write-Host "[OK] $($item.FullName) ($($item.Length) bytes)"
Write-Host '[OK] Import this exact folder in WeChat DevTools.'
