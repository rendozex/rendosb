#Requires -Version 5.1
<#
.SYNOPSIS
  Initialize git (if needed), commit the RendoSB project, and push to GitHub.

.DESCRIPTION
  Uses GitHub CLI (gh) to create the remote repo and push. Source code only —
  node_modules/ and release/ are excluded via .gitignore.

.PARAMETER RepoName
  GitHub repository name (default: rendosb).

.PARAMETER Visibility
  public or private (default: public).

.PARAMETER Description
  Repository description.

.PARAMETER SkipCreate
  Only commit and push; do not create a new GitHub repo.

.EXAMPLE
  .\push-to-github.ps1
  .\push-to-github.ps1 -RepoName rendosb -Visibility private
#>
param(
  [string]$RepoName = "rendosb",
  [ValidateSet("public", "private")]
  [string]$Visibility = "public",
  [string]$Description = "RendoSB - custom LLM GUI with VS Code chat UI, Grok CLI, and Ollama support",
  [switch]$SkipCreate
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Set-Location $ProjectRoot

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Test-GhAuth {
  gh auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "GitHub CLI is not logged in. Run: gh auth login" -ForegroundColor Yellow
    throw "gh auth required"
  }
}

Write-Host "RendoSB - push to GitHub" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host ""

Require-Command git
Require-Command gh
Test-GhAuth

$ghUser = (gh api user --jq .login).Trim()
$ghId = (gh api user --jq .id).Trim()
Write-Host "GitHub account: $ghUser" -ForegroundColor Green

if (-not (git config user.name 2>$null)) {
  git config user.name $ghUser
}
if (-not (git config user.email 2>$null)) {
  git config user.email "$ghId+$ghUser@users.noreply.github.com"
}

if (-not (Test-Path ".gitignore")) {
  throw ".gitignore not found in $ProjectRoot"
}

if (-not (Test-Path ".git")) {
  Write-Host "Initializing git repository..." -ForegroundColor Yellow
  git init -b main
}

$hasRemote = $false
$remoteCheck = git remote 2>$null
if ($LASTEXITCODE -eq 0 -and ($remoteCheck -match 'origin')) {
  $hasRemote = $true
}

if (-not $hasRemote -and -not $SkipCreate) {
  $fullName = "$ghUser/$RepoName"
  Write-Host "Checking if github.com/$fullName exists..." -ForegroundColor Yellow

  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  gh repo view $fullName 2>$null | Out-Null
  $repoExists = $LASTEXITCODE -eq 0
  $ErrorActionPreference = $prevEap

  if ($repoExists) {
    Write-Host "Repository already exists. Adding remote origin..." -ForegroundColor Yellow
    git remote add origin "https://github.com/$fullName.git"
  }
  else {
    Write-Host "Creating GitHub repo: $fullName ($Visibility)..." -ForegroundColor Yellow
    gh repo create $RepoName `
      --$Visibility `
      --description $Description `
      --source . `
      --remote origin `
      --push=false
    if ($LASTEXITCODE -ne 0) { throw "gh repo create failed" }
  }
  $hasRemote = $true
}

Write-Host "Staging files..." -ForegroundColor Yellow
git add -A

$status = git status --porcelain
if (-not $status) {
  Write-Host "Nothing to commit - working tree clean." -ForegroundColor Green
}
else {
  Write-Host "Committing..." -ForegroundColor Yellow
  git commit -m "Initial commit: RendoSB LLM GUI"
  if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
}

if (-not $hasRemote) {
  throw "No git remote 'origin'. Run without -SkipCreate or add: git remote add origin URL"
}

$branch = (git branch --show-current).Trim()
if (-not $branch) { $branch = "main" }

Write-Host "Pushing to origin/$branch ..." -ForegroundColor Yellow
git push -u origin $branch
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

$origin = (git remote get-url origin).Trim() -replace '\.git$', ''
Write-Host ""
Write-Host "Done! Repository:" -ForegroundColor Green
Write-Host "  $origin"
Write-Host ""
Write-Host "Open in browser: gh repo view --web" -ForegroundColor DarkGray