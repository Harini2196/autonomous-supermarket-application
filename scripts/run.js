import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Use the supported runtime without changing the system's active Node version.
const major = Number(process.versions.node.split('.')[0]);
let runtime = process.execPath;
if (major < 24) {
  const candidates = [
    process.env.NODE24_PATH,
    join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
      'dependencies', 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node'),
  ].filter(Boolean);
  runtime = candidates.find(candidate => {
    if (!existsSync(candidate)) return false;
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8', windowsHide: true });
    return probe.status === 0 && Number(probe.stdout.trim().replace(/^v/, '').split('.')[0]) >= 24;
  });
  if (!runtime) {
    console.error(`This project needs Node.js 24 or later; your terminal is using ${process.version}.\nInstall Node.js 24, reopen your terminal, and run npm run dev again.\nAlternatively, set NODE24_PATH to a compatible Node executable.`);
    process.exit(1);
  }
  console.log(`Using Node.js 24+ from ${runtime}`);
}

const tasks = {
  build: [['scripts/build.js']],
  start: [['server/index.js']],
  dev: [['scripts/build.js'], ['server/index.js']],
  seed: [['server/seed.js']],
  test: [['--test', 'tests/brain.test.js', 'tests/simulation.test.js']],
};
const commands = tasks[process.argv[2]];
if (!commands) {
  console.error('Choose build, start, dev, seed or test.');
  process.exit(1);
}
for (const args of commands) {
  const child = spawnSync(runtime, args, { stdio: 'inherit', windowsHide: true });
  if (child.error) {
    console.error(child.error.message);
    process.exit(1);
  }
  if (child.status !== 0) process.exit(child.status ?? 1);
}
