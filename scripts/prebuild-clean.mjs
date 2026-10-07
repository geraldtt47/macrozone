import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const androidDir = join(root, 'android');
const isWindows = process.platform === 'win32';
const gradlew = isWindows ? 'gradlew.bat' : './gradlew';

const platform = process.argv[2];
if (platform && platform !== 'android' && platform !== 'ios') {
  console.error('Usage: node scripts/prebuild-clean.mjs [android|ios]');
  process.exit(1);
}

function run(command, args, cwd, { allowFailure = false, shell = false } = {}) {
  const result = shell
    ? spawnSync([command, ...args].join(' '), {
        cwd,
        stdio: 'inherit',
        shell: true,
      })
    : spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
      });

  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status ?? 1);
  }
}

function stopGradleDaemon() {
  const gradlewPath = join(androidDir, gradlew);
  if (!existsSync(gradlewPath)) {
    return;
  }

  console.log('Stopping Gradle daemon...');
  run(gradlew, ['--stop'], androidDir, {
    allowFailure: true,
    shell: isWindows,
  });
}

function runPrebuildClean() {
  const args = ['expo', 'prebuild', '--clean'];

  if (platform === 'android') {
    args.push('--platform', 'android');
  } else if (platform === 'ios') {
    args.push('--platform', 'ios');
  }

  run('bunx', args, root, { shell: isWindows });
}

if (!platform || platform === 'android') {
  stopGradleDaemon();
}

runPrebuildClean();
