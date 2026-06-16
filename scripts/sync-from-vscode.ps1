#Requires -Version 5.1
<#
.SYNOPSIS
  Copy updated VS Code UI assets from vscode-main into RendoSB.

.PARAMETER VscodeRoot
  Path to the vscode-main checkout (default: ../vscode-main next to grok-gui).

.EXAMPLE
  .\scripts\sync-from-vscode.ps1
  .\scripts\sync-from-vscode.ps1 -VscodeRoot "C:\path\to\vscode-main"
#>
param(
  [string]$VscodeRoot = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent

if (-not $VscodeRoot) {
  $VscodeRoot = Join-Path (Split-Path $ProjectRoot -Parent) "vscode-main"
}

$VscodeRoot = (Resolve-Path $VscodeRoot -ErrorAction SilentlyContinue).Path
if (-not $VscodeRoot -or -not (Test-Path $VscodeRoot)) {
  throw "vscode-main not found at: $VscodeRoot"
}

Write-Host "Syncing VS Code assets into RendoSB" -ForegroundColor Cyan
Write-Host "  Source: $VscodeRoot"
Write-Host "  Target: $ProjectRoot"
Write-Host ""

$FileMap = @(
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\media\chat.css"; Dst = "renderer\styles\vscode-ui\chat.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\media\chatViewWelcome.css"; Dst = "renderer\styles\vscode-ui\chatViewWelcome.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\media\chatThinkingContent.css"; Dst = "renderer\styles\vscode-ui\chatThinkingContent.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\media\chatMarkdownPart.css"; Dst = "renderer\styles\vscode-ui\chatMarkdownPart.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\media\codeBlockPart.css"; Dst = "renderer\styles\vscode-ui\codeBlockPart.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\media\chatCodeBlockPill.css"; Dst = "renderer\styles\vscode-ui\chatCodeBlockPill.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\chatIncrementalRendering\media\chatIncrementalRendering.css"; Dst = "renderer\styles\vscode-ui\chatIncrementalRendering.css" },
  @{ Src = "src\vs\base\browser\ui\codicons\codicon\codicon.css"; Dst = "renderer\styles\vscode-ui\codicon.css" },
  @{ Src = "src\vs\base\browser\ui\codicons\codicon\codicon-modifiers.css"; Dst = "renderer\styles\vscode-ui\codicon-modifiers.css" },
  @{ Src = "extensions\theme-defaults\themes\dark_modern.json"; Dst = "renderer\styles\vscode-ui\dark_modern.json" }
)

$CodiconFontCandidates = @(
  @{ Root = $VscodeRoot; Rel = "src\vs\base\browser\ui\codicons\codicon\codicon.ttf" },
  @{ Root = $VscodeRoot; Rel = "node_modules\@vscode\codicons\dist\codicon.ttf" },
  @{ Root = $ProjectRoot; Rel = "node_modules\@vscode\codicons\dist\codicon.ttf" }
)

$ThemeDir = Join-Path $ProjectRoot "renderer\styles\vscode-ui\themes"
New-Item -ItemType Directory -Force -Path $ThemeDir | Out-Null

$copied = 0
$updated = 0
$missing = @()

foreach ($entry in $FileMap) {
  $srcPath = Join-Path $VscodeRoot $entry.Src
  $dstPath = Join-Path $ProjectRoot $entry.Dst
  $dstDir = Split-Path $dstPath -Parent
  if (-not (Test-Path $dstDir)) {
    New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
  }

  if (-not (Test-Path $srcPath)) {
    $missing += $entry.Src
    Write-Host "  MISSING  $($entry.Src)" -ForegroundColor Yellow
    continue
  }

  $changed = $true
  if (Test-Path $dstPath) {
    $srcHash = (Get-FileHash $srcPath).Hash
    $dstHash = (Get-FileHash $dstPath).Hash
    $changed = $srcHash -ne $dstHash
  }

  Copy-Item -Path $srcPath -Destination $dstPath -Force
  $copied++
  if ($changed) {
    $updated++
    Write-Host "  UPDATED  $($entry.Dst)" -ForegroundColor Green
  }
  else {
    Write-Host "  OK       $($entry.Dst)" -ForegroundColor DarkGray
  }
}

$codiconCopied = $false
foreach ($candidate in $CodiconFontCandidates) {
  $fontSrc = Join-Path $candidate.Root $candidate.Rel
  if (Test-Path $fontSrc) {
    $fontDst = Join-Path $ProjectRoot "renderer\styles\vscode-ui\codicon.ttf"
    $changed = -not (Test-Path $fontDst) -or ((Get-FileHash $fontSrc).Hash -ne (Get-FileHash $fontDst).Hash)
    Copy-Item $fontSrc $fontDst -Force
    $copied++
    if ($changed) { $updated++ }
    Write-Host "  $(if ($changed) { 'UPDATED' } else { 'OK      ' })  renderer/styles/vscode-ui/codicon.ttf" -ForegroundColor $(if ($changed) { 'Green' } else { 'DarkGray' })
    $codiconCopied = $true
    break
  }
}
if (-not $codiconCopied) {
  Write-Host "  MISSING  codicon.ttf (run npm install in vscode-main)" -ForegroundColor Yellow
  $missing += "codicon.ttf"
}

$themeSrcDir = Join-Path $VscodeRoot "extensions\theme-defaults\themes"
$themeCount = 0
if (Test-Path $themeSrcDir) {
  Get-ChildItem -Path $themeSrcDir -Filter "*.json" | ForEach-Object {
    $dstTheme = Join-Path $ThemeDir $_.Name
    $changed = -not (Test-Path $dstTheme) -or ((Get-FileHash $_.FullName).Hash -ne (Get-FileHash $dstTheme).Hash)
    Copy-Item $_.FullName $dstTheme -Force
    $themeCount++
    if ($changed) {
      $updated++
      Write-Host "  UPDATED  renderer/styles/vscode-ui/themes/$($_.Name)" -ForegroundColor Green
    }
  }
}

Write-Host ""
Write-Host "Done: $copied files synced, $themeCount theme JSON files, $updated changed." -ForegroundColor Cyan

if ($missing.Count) {
  Write-Host "Warning: $($missing.Count) source file(s) missing in vscode-main." -ForegroundColor Yellow
}

$manifest = @{
  syncedAt = (Get-Date).ToString("o")
  vscodeRoot = $VscodeRoot
  files = $FileMap | ForEach-Object { $_.Dst }
  themeJsonDir = "renderer/styles/vscode-ui/themes"
}
$manifestPath = Join-Path $ProjectRoot "renderer\styles\vscode-ui\sync-manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8
Write-Host "Manifest: renderer/styles/vscode-ui/sync-manifest.json"