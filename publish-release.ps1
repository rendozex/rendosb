#Requires -Version 5.1
<#
.SYNOPSIS
  Build (optional) and publish a pre-compiled Windows release to GitHub.

.PARAMETER Version
  Release version tag (default: version from package.json).

.PARAMETER SkipBuild
  Upload existing release/*.zip without rebuilding.

.PARAMETER Draft
  Create a draft release instead of publishing immediately.

.EXAMPLE
  .\publish-release.ps1
  .\publish-release.ps1 -SkipBuild
  .\publish-release.ps1 -Version 1.1.0
#>
param(
  [string]$Version = "",
  [switch]$SkipBuild,
  [switch]$Draft
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$PackageJson = Get-Content (Join-Path $ProjectRoot "package.json") -Raw | ConvertFrom-Json

if (-not $Version) {
  $Version = $PackageJson.version
}

$Tag = "v$Version"
$ZipName = "RendoSB-$Version-win-x64.zip"
$ZipPath = Join-Path $ProjectRoot "release\$ZipName"
$Repo = "rendozex/rendosb"

Write-Host "RendoSB - GitHub Release" -ForegroundColor Cyan
Write-Host "  Repo:    $Repo"
Write-Host "  Tag:     $Tag"
Write-Host "  Artifact: $ZipName"
Write-Host ""

if (-not $SkipBuild) {
  Write-Host "Building Windows app..." -ForegroundColor Yellow
  Get-Process -Name "RendoSB", "electron" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Push-Location $ProjectRoot
  try {
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE" }
  }
  finally {
    Pop-Location
  }
}

if (-not (Test-Path $ZipPath)) {
  throw "Release zip not found: $ZipPath`nRun: npm run build"
}

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
gh release view $Tag --repo $Repo 2>$null | Out-Null
$releaseExists = $LASTEXITCODE -eq 0
$ErrorActionPreference = $prevEap

if ($releaseExists) {
  Write-Host "Release $Tag already exists. Uploading asset..." -ForegroundColor Yellow
  gh release upload $Tag $ZipPath --repo $Repo --clobber
  if ($LASTEXITCODE -ne 0) { throw "gh release upload failed" }
  Write-Host ""
  Write-Host "Asset updated on existing release $Tag" -ForegroundColor Green
}
else {
  $notesFile = Join-Path $env:TEMP "rendosb-release-notes-$Version.md"
  @(
    "## RendoSB $Version - Windows x64"
    ''
    'Pre-built desktop app for Windows. No Node.js required.'
    ''
    '### Download'
    ''
    "1. Download $ZipName below."
    '2. Extract the zip to any folder.'
    '3. Run RendoSB.exe.'
    ''
    '### Requirements'
    ''
    '* Windows 10/11 x64'
    '* Grok CLI for AI chat'
    '* Docker + Ollama optional for local models'
    ''
    '### Highlights'
    ''
    '* VS Code-style UI with file explorer, editor, and chat panel'
    '* Grok CLI streaming'
    '* Docker/Ollama local models'
    '* 25 color themes'
    '* Live file watching while the agent works'
  ) | Set-Content -Path $notesFile -Encoding UTF8

  $ghArgs = @(
    "release", "create", $Tag, $ZipPath,
    "--repo", $Repo,
    "--title", "RendoSB $Version",
    "--notes-file", $notesFile
  )
  if ($Draft) { $ghArgs += "--draft" }

  & gh @ghArgs
  if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }
  Write-Host ""
  Write-Host "Release published: https://github.com/$Repo/releases/tag/$Tag" -ForegroundColor Green
}