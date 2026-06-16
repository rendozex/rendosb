const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function pickDirectoryWindows(defaultPath) {
  const scriptPath = path.join(os.tmpdir(), `rendosb-folder-picker-${process.pid}.ps1`);
  const lines = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    '$dialog.Description = "Select Working Directory"',
    '$dialog.ShowNewFolderButton = $true',
  ];
  if (defaultPath) {
    lines.push(`$dialog.SelectedPath = ${JSON.stringify(defaultPath)}`);
  }
  lines.push(
    '$owner = New-Object System.Windows.Forms.Form',
    '$owner.TopMost = $true',
    '$owner.ShowInTaskbar = $false',
    '$owner.WindowState = [System.Windows.Forms.FormWindowState]::Minimized',
    '$owner.Show()',
    '$owner.Hide()',
    '$result = $dialog.ShowDialog($owner)',
    '$owner.Close()',
    'if ($result -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  [Console]::Out.Write($dialog.SelectedPath)',
    '}',
  );

  try {
    fs.writeFileSync(scriptPath, `${lines.join('\r\n')}\r\n`, 'utf8');
    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { encoding: 'utf8', windowsHide: false, timeout: 120000 },
    );

    if (result.error) throw result.error;
    if (result.status !== 0 && result.stderr?.trim()) {
      throw new Error(result.stderr.trim());
    }

    const dir = (result.stdout || '').trim();
    return dir || null;
  } finally {
    try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
  }
}

function pickDirectoryMac(defaultPath) {
  const start = defaultPath ? `POSIX file ${JSON.stringify(defaultPath)}` : 'alias "Macintosh HD"';
  const script = `set chosen to choose folder with prompt "Select Working Directory" default location ${start}
return POSIX path of chosen`;

  const result = spawnSync('osascript', ['-e', script], {
    encoding: 'utf8',
    timeout: 120000,
  });

  if (result.status !== 0) return null;
  const dir = (result.stdout || '').trim();
  return dir || null;
}

function pickDirectoryLinux(defaultPath) {
  const args = ['--file-selection', '--directory', '--title=Select Working Directory'];
  if (defaultPath) args.push(`--filename=${path.join(defaultPath, '')}`);

  let result = spawnSync('zenity', args, { encoding: 'utf8', timeout: 120000 });
  if (result.status === 0) {
    const dir = (result.stdout || '').trim();
    return dir || null;
  }

  result = spawnSync('kdialog', ['--getexistingdirectory', defaultPath || os.homedir()], {
    encoding: 'utf8',
    timeout: 120000,
  });
  if (result.status === 0) {
    const dir = (result.stdout || '').trim();
    return dir || null;
  }

  return null;
}

function pickDirectory({ defaultPath } = {}) {
  if (process.platform === 'win32') {
    return pickDirectoryWindows(defaultPath);
  }
  if (process.platform === 'darwin') {
    return pickDirectoryMac(defaultPath);
  }
  return pickDirectoryLinux(defaultPath);
}

module.exports = { pickDirectory };