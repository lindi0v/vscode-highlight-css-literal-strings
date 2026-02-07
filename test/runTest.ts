import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // Some environments (including certain git hook setups) may set this variable.
    // If it's set, VS Code's Electron binary behaves like plain Node and will
    // reject VS Code CLI flags (e.g. --extensionDevelopmentPath).
    delete process.env.ELECTRON_RUN_AS_NODE;

    const extensionDevelopmentPath = path.resolve(__dirname, '../..');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions'],
    });
  } catch (err) {
    console.error('Failed to run tests');
    console.error(err);
    process.exit(1);
  }
}

main();
