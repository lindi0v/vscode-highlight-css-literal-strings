import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

async function createTempFile(ext: string, content: string): Promise<vscode.Uri> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'highlight-css-strings-'));
  const filePath = path.join(dir, `sample.${ext}`);
  await fs.writeFile(filePath, content, 'utf8');
  return vscode.Uri.file(filePath);
}

suite('extension integration', () => {
  test('extension activates', async () => {
    const ext = vscode.extensions.getExtension('lindi0v.highlight-css-strings');
    assert.ok(ext, 'Extension not found (id: lindi0v.highlight-css-strings)');

    await ext.activate();
    assert.ok(ext.isActive);
  });

  test('provides CSS completions inside /* css */ template', async () => {
    const ext = vscode.extensions.getExtension('lindi0v.highlight-css-strings');
    assert.ok(ext);
    await ext.activate();

    const uri = await createTempFile(
      'ts',
      ['const styles = /* css */ `', '  div {', '    col', '  }', '`;'].join('\n')
    );

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.languages.setTextDocumentLanguage(doc, 'typescript');
    const editor = await vscode.window.showTextDocument(doc);

    const idx = doc.getText().indexOf('col');
    assert.ok(idx >= 0);
    const pos = doc.positionAt(idx + 'col'.length);

    const list = (await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      doc.uri,
      pos,
      ':'
    )) as vscode.CompletionList | undefined;

    assert.ok(list);
    assert.ok(Array.isArray(list.items));
    assert.ok(list.items.length > 0, 'expected some completion items');

    const labels = list.items.map((i) => {
      return typeof i.label === 'string' ? i.label : i.label.label;
    });
    assert.ok(labels.includes('color'), 'expected completion to include "color"');

    assert.strictEqual(editor.document.uri.toString(), doc.uri.toString());
  });

  test('does not provide completions inside ${...} expression', async () => {
    const ext = vscode.extensions.getExtension('lindi0v.highlight-css-strings');
    assert.ok(ext);
    await ext.activate();

    const uri = await createTempFile(
      'ts',
      ['const x = 123;', 'const styles = /* css */ `', '  a { color: ${x}; }', '`;'].join('\n')
    );

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.languages.setTextDocumentLanguage(doc, 'typescript');
    await vscode.window.showTextDocument(doc);

    const idx = doc.getText().indexOf('${x');
    assert.ok(idx >= 0);
    const posInsideExpr = doc.positionAt(idx + 3); // inside the expression

    const list = (await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      doc.uri,
      posInsideExpr,
      ':'
    )) as vscode.CompletionList | undefined;

    // Our extension returns undefined inside expressions, but TypeScript completion can still appear.
    // So we assert that CSS-specific completions are NOT present.
    assert.ok(list);
    const labels = list.items.map((i) => {
      return typeof i.label === 'string' ? i.label : i.label.label;
    });
    assert.ok(!labels.includes('color'), 'did not expect CSS completion "color" inside expression');
    assert.ok(labels.includes('x'), 'expected TypeScript completion to include variable "x"');
  });
});
