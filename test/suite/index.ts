import Mocha from 'mocha';
import * as path from 'path';

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  const testFiles = [
    path.resolve(__dirname, './scanner.test'),
    path.resolve(__dirname, './extension.test'),
  ];

  for (const f of testFiles) {
    mocha.addFile(f);
  }

  return new Promise((resolve, reject) => {
    mocha.run((failures: number) => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  });
}
