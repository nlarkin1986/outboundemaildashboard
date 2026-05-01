import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const sourceDir = resolve(root, 'skills/account-sequencer');
const outputDir = resolve(root, 'dist');
const outputFile = resolve(outputDir, 'account-sequencer.skill');

if (!existsSync(sourceDir)) {
  console.error(`Missing skill source: ${sourceDir}`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
if (existsSync(outputFile)) rmSync(outputFile);

const result = spawnSync('zip', ['-qr', outputFile, 'account-sequencer'], {
  cwd: resolve(root, 'skills'),
  stdio: 'inherit',
});

if (result.status !== 0) {
  console.error('Failed to package account-sequencer skill. Ensure the zip command is available.');
  process.exit(result.status ?? 1);
}

console.log(`Packaged ${outputFile}`);
