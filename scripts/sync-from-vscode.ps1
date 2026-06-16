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
  @{ Src = "extensions\theme-defaults\themes\dark_modern.json"; Dst = "renderer\styles\vscode-ui\dark_modern.json" },
  # Batch 2 — chat UI polish
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\media\chatAgentHover.css"; Dst = "renderer\styles\vscode-ui\chatAgentHover.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\chatStatus\media\chatStatus.css"; Dst = "renderer\styles\vscode-ui\chatStatus.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widgetHosts\viewPane\media\chatViewPane.css"; Dst = "renderer\styles\vscode-ui\chatViewPane.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\media\chatConfirmationWidget.css"; Dst = "renderer\styles\vscode-ui\chatConfirmationWidget.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\media\chatTipContent.css"; Dst = "renderer\styles\vscode-ui\chatTipContent.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\media\chatTerminalToolProgressPart.css"; Dst = "renderer\styles\vscode-ui\chatTerminalToolProgressPart.css" },
  # Batch 2 — workbench chrome
  @{ Src = "src\vs\workbench\browser\parts\activitybar\media\activitybarpart.css"; Dst = "renderer\styles\vscode-ui\activitybarpart.css" },
  @{ Src = "src\vs\workbench\browser\parts\statusbar\media\statusbarpart.css"; Dst = "renderer\styles\vscode-ui\statusbarpart.css" },
  @{ Src = "src\vs\workbench\browser\parts\panel\media\panelpart.css"; Dst = "renderer\styles\vscode-ui\panelpart.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\editortabscontrol.css"; Dst = "renderer\styles\vscode-ui\editortabscontrol.css" },
  # Batch 3 — workbench shell + editor
  @{ Src = "src\vs\workbench\browser\parts\sidebar\media\sidebarpart.css"; Dst = "renderer\styles\vscode-ui\sidebarpart.css" },
  @{ Src = "src\vs\workbench\browser\parts\titlebar\media\titlebarpart.css"; Dst = "renderer\styles\vscode-ui\titlebarpart.css" },
  @{ Src = "src\vs\workbench\browser\parts\views\media\views.css"; Dst = "renderer\styles\vscode-ui\views.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\editorgroupview.css"; Dst = "renderer\styles\vscode-ui\editorgroupview.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\editorplaceholder.css"; Dst = "renderer\styles\vscode-ui\editorplaceholder.css" },
  @{ Src = "src\vs\workbench\browser\parts\activitybar\media\activityaction.css"; Dst = "renderer\styles\vscode-ui\activityaction.css" },
  @{ Src = "src\vs\workbench\browser\parts\media\compositepart.css"; Dst = "renderer\styles\vscode-ui\compositepart.css" },
  # Batch 3 — chat view polish
  @{ Src = "src\vs\workbench\contrib\chat\browser\widgetHosts\viewPane\media\chatViewTitleControl.css"; Dst = "renderer\styles\vscode-ui\chatViewTitleControl.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\input\media\chatGoalBannerWidget.css"; Dst = "renderer\styles\vscode-ui\chatGoalBannerWidget.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widgetHosts\viewPane\media\chatContextUsageWidget.css"; Dst = "renderer\styles\vscode-ui\chatContextUsageWidget.css" },
  # Batch 4 — base Monaco UI (11)
  @{ Src = "src\vs\base\browser\ui\actionbar\actionbar.css"; Dst = "renderer\styles\vscode-ui\actionbar.css" },
  @{ Src = "src\vs\base\browser\ui\aria\aria.css"; Dst = "renderer\styles\vscode-ui\aria.css" },
  @{ Src = "src\vs\base\browser\ui\button\button.css"; Dst = "renderer\styles\vscode-ui\button.css" },
  @{ Src = "src\vs\base\browser\ui\contextview\contextview.css"; Dst = "renderer\styles\vscode-ui\contextview.css" },
  @{ Src = "src\vs\base\browser\ui\dropdown\dropdown.css"; Dst = "renderer\styles\vscode-ui\dropdown.css" },
  @{ Src = "src\vs\base\browser\ui\inputbox\inputBox.css"; Dst = "renderer\styles\vscode-ui\inputBox.css" },
  @{ Src = "src\vs\base\browser\ui\list\list.css"; Dst = "renderer\styles\vscode-ui\list.css" },
  @{ Src = "src\vs\base\browser\ui\sash\sash.css"; Dst = "renderer\styles\vscode-ui\sash.css" },
  @{ Src = "src\vs\base\browser\ui\scrollbar\media\scrollbars.css"; Dst = "renderer\styles\vscode-ui\scrollbars.css" },
  @{ Src = "src\vs\base\browser\ui\splitview\splitview.css"; Dst = "renderer\styles\vscode-ui\splitview.css" },
  @{ Src = "src\vs\base\browser\ui\tree\media\tree.css"; Dst = "renderer\styles\vscode-ui\tree.css" },
  # Batch 4 — workbench parts (19)
  @{ Src = "src\vs\workbench\browser\parts\auxiliarybar\media\auxiliaryBarPart.css"; Dst = "renderer\styles\vscode-ui\auxiliaryBarPart.css" },
  @{ Src = "src\vs\workbench\browser\parts\banner\media\bannerpart.css"; Dst = "renderer\styles\vscode-ui\bannerpart.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\breadcrumbscontrol.css"; Dst = "renderer\styles\vscode-ui\breadcrumbscontrol.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\editordroptarget.css"; Dst = "renderer\styles\vscode-ui\editordroptarget.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\editorquickaccess.css"; Dst = "renderer\styles\vscode-ui\editorquickaccess.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\editorstatus.css"; Dst = "renderer\styles\vscode-ui\editorstatus.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\editortitlecontrol.css"; Dst = "renderer\styles\vscode-ui\editortitlecontrol.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\modalEditorPart.css"; Dst = "renderer\styles\vscode-ui\modalEditorPart.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\multieditortabscontrol.css"; Dst = "renderer\styles\vscode-ui\multieditortabscontrol.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\sidebysideeditor.css"; Dst = "renderer\styles\vscode-ui\sidebysideeditor.css" },
  @{ Src = "src\vs\workbench\browser\parts\editor\media\singleeditortabscontrol.css"; Dst = "renderer\styles\vscode-ui\singleeditortabscontrol.css" },
  @{ Src = "src\vs\workbench\browser\parts\media\paneCompositePart.css"; Dst = "renderer\styles\vscode-ui\paneCompositePart.css" },
  @{ Src = "src\vs\workbench\browser\parts\notifications\media\notificationsActions.css"; Dst = "renderer\styles\vscode-ui\notificationsActions.css" },
  @{ Src = "src\vs\workbench\browser\parts\notifications\media\notificationsCenter.css"; Dst = "renderer\styles\vscode-ui\notificationsCenter.css" },
  @{ Src = "src\vs\workbench\browser\parts\notifications\media\notificationsList.css"; Dst = "renderer\styles\vscode-ui\notificationsList.css" },
  @{ Src = "src\vs\workbench\browser\parts\notifications\media\notificationsToasts.css"; Dst = "renderer\styles\vscode-ui\notificationsToasts.css" },
  @{ Src = "src\vs\workbench\browser\parts\titlebar\media\menubarControl.css"; Dst = "renderer\styles\vscode-ui\menubarControl.css" },
  @{ Src = "src\vs\workbench\browser\parts\views\media\paneviewlet.css"; Dst = "renderer\styles\vscode-ui\paneviewlet.css" },
  @{ Src = "src\vs\workbench\electron-browser\media\window.css"; Dst = "renderer\styles\vscode-ui\window.css" },
  # Batch 4 — explorer, settings, chat polish (16)
  @{ Src = "src\vs\workbench\contrib\files\browser\media\explorerviewlet.css"; Dst = "renderer\styles\vscode-ui\explorerviewlet.css" },
  @{ Src = "src\vs\workbench\contrib\files\browser\views\media\openeditors.css"; Dst = "renderer\styles\vscode-ui\openeditors.css" },
  @{ Src = "src\vs\workbench\contrib\preferences\browser\media\settingsWidgets.css"; Dst = "renderer\styles\vscode-ui\settingsWidgets.css" },
  @{ Src = "src\vs\workbench\contrib\preferences\browser\media\settingsEditor2.css"; Dst = "renderer\styles\vscode-ui\settingsEditor2.css" },
  @{ Src = "src\vs\workbench\contrib\preferences\browser\media\preferencesEditor.css"; Dst = "renderer\styles\vscode-ui\preferencesEditor.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widgetHosts\viewPane\media\chatContextUsageDetails.css"; Dst = "renderer\styles\vscode-ui\chatContextUsageDetails.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\input\media\chatInputNotificationWidget.css"; Dst = "renderer\styles\vscode-ui\chatInputNotificationWidget.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\media\chatSubagentContent.css"; Dst = "renderer\styles\vscode-ui\chatSubagentContent.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\media\chatQuestionCarousel.css"; Dst = "renderer\styles\vscode-ui\chatQuestionCarousel.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\media\chatToolConfirmationCarousel.css"; Dst = "renderer\styles\vscode-ui\chatToolConfirmationCarousel.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\toolInvocationParts\media\toolRiskBadge.css"; Dst = "renderer\styles\vscode-ui\toolRiskBadge.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\widget\chatContentParts\media\chatInlineAnchorWidget.css"; Dst = "renderer\styles\vscode-ui\chatInlineAnchorWidget.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\chatEditing\media\chatEditingEditorOverlay.css"; Dst = "renderer\styles\vscode-ui\chatEditingEditorOverlay.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\chatEditing\media\chatEditingExplanationWidget.css"; Dst = "renderer\styles\vscode-ui\chatEditingExplanationWidget.css" },
  @{ Src = "src\vs\workbench\contrib\chat\browser\chatEditing\media\chatEditorController.css"; Dst = "renderer\styles\vscode-ui\chatEditorController.css" },
  @{ Src = "src\vs\workbench\contrib\markdown\browser\media\markdown.css"; Dst = "renderer\styles\vscode-ui\markdown.css" }
)

$Batch4DstFiles = @(
  "actionbar.css", "aria.css", "button.css", "contextview.css", "dropdown.css", "inputBox.css",
  "list.css", "sash.css", "scrollbars.css", "splitview.css", "tree.css",
  "auxiliaryBarPart.css", "bannerpart.css", "breadcrumbscontrol.css", "editordroptarget.css",
  "editorquickaccess.css", "editorstatus.css", "editortitlecontrol.css", "modalEditorPart.css",
  "multieditortabscontrol.css", "sidebysideeditor.css", "singleeditortabscontrol.css",
  "paneCompositePart.css", "notificationsActions.css", "notificationsCenter.css",
  "notificationsList.css", "notificationsToasts.css", "menubarControl.css", "paneviewlet.css",
  "window.css", "explorerviewlet.css", "openeditors.css", "settingsWidgets.css",
  "settingsEditor2.css", "preferencesEditor.css", "chatContextUsageDetails.css",
  "chatInputNotificationWidget.css", "chatSubagentContent.css", "chatQuestionCarousel.css",
  "chatToolConfirmationCarousel.css", "toolRiskBadge.css", "chatInlineAnchorWidget.css",
  "chatEditingEditorOverlay.css", "chatEditingExplanationWidget.css", "chatEditorController.css",
  "markdown.css"
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
$ExtThemeDir = Join-Path $ThemeDir "extensions"
New-Item -ItemType Directory -Force -Path $ExtThemeDir | Out-Null
$themeCount = 0

if (Test-Path $themeSrcDir) {
  Get-ChildItem -Path $themeSrcDir -Filter "*.json" | ForEach-Object {
    $dstTheme = Join-Path $ThemeDir $_.Name
    $changed = $true
    if (Test-Path $dstTheme) {
      $changed = (Get-FileHash $_.FullName).Hash -ne (Get-FileHash $dstTheme).Hash
    }
    Copy-Item $_.FullName $dstTheme -Force
    $themeCount++
    if ($changed) {
      $updated++
      Write-Host "  UPDATED  renderer/styles/vscode-ui/themes/$($_.Name)" -ForegroundColor Green
    }
  }
}

$extensionThemePacks = @(
  "theme-abyss",
  "theme-tomorrow-night-blue",
  "theme-quietlight",
  "theme-red",
  "theme-kimbie-dark",
  "theme-monokai-dimmed",
  "theme-monokai",
  "theme-solarized-dark",
  "theme-solarized-light"
)
foreach ($pack in $extensionThemePacks) {
  $packDir = Join-Path $VscodeRoot "extensions\$pack\themes"
  if (-not (Test-Path $packDir)) { continue }
  Get-ChildItem -Path $packDir -Filter "*.json" | ForEach-Object {
    $dstTheme = Join-Path $ExtThemeDir $_.Name
    $changed = $true
    if (Test-Path $dstTheme) {
      $changed = (Get-FileHash $_.FullName).Hash -ne (Get-FileHash $dstTheme).Hash
    }
    Copy-Item $_.FullName $dstTheme -Force
    $themeCount++
    if ($changed) {
      $updated++
      Write-Host "  UPDATED  renderer/styles/vscode-ui/themes/extensions/$($_.Name)" -ForegroundColor Green
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
$batch4ImportPath = Join-Path $ProjectRoot "renderer\styles\vscode-ui\batch4-imports.css"
$importLines = @(
  "/* Auto-generated by sync-from-vscode.ps1 - Batch 4 ($($Batch4DstFiles.Count) files) */"
)
foreach ($file in $Batch4DstFiles) {
  $importLines += "@import url(`"./$file`");"
}
$importLines | Set-Content -Path $batch4ImportPath -Encoding UTF8
Write-Host "  WROTE    renderer/styles/vscode-ui/batch4-imports.css ($($Batch4DstFiles.Count) imports)" -ForegroundColor Green

$manifest = @{
  syncedAt = (Get-Date).ToString("o")
  vscodeRoot = $VscodeRoot
  files = $FileMap | ForEach-Object { $_.Dst }
  batch4Count = $Batch4DstFiles.Count
  batch4Imports = "renderer/styles/vscode-ui/batch4-imports.css"
  themeJsonDir = "renderer/styles/vscode-ui/themes"
}
$manifestPath = Join-Path $ProjectRoot "renderer\styles\vscode-ui\sync-manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8
Write-Host "Manifest: renderer/styles/vscode-ui/sync-manifest.json"