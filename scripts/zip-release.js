const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'release', 'win-unpacked');
const version = require(path.join(root, 'package.json')).version;
const zipName = `RendoSB-${version}-win-x64.zip`;
const zipPath = path.join(root, 'release', zipName);

if (!fs.existsSync(sourceDir)) {
  console.error('Missing release/win-unpacked. Run electron-builder first.');
  process.exit(1);
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const ps = [
  'Compress-Archive',
  `-Path "${sourceDir}\\*"`,
  `-DestinationPath "${zipPath}"`,
  '-Force',
].join(' ');

execSync(ps, { stdio: 'inherit', shell: 'powershell.exe' });

const exePath = path.join(sourceDir, 'RendoSB.exe');
console.log('');
console.log('Build complete:');
console.log(`  EXE:  ${exePath}`);
console.log(`  ZIP:  ${zipPath}`);