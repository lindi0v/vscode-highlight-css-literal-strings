import * as assert from 'assert';
import * as vscode from 'vscode';
import { findCssTemplatesInDocument } from '../../src/scanner';

suite('scanner.findCssTemplatesInDocument', () => {
  test('finds a /* css */ template literal and builds virtual doc', async () => {
    const content = [
      'const x = 1;',
      'const styles = /* css */ `div { color: red; }`;',
      'const y = 2;',
    ].join('\n');

    const doc = await vscode.workspace.openTextDocument({ language: 'typescript', content });
    const templates = findCssTemplatesInDocument(doc);

    assert.strictEqual(templates.length, 1);
    const tpl = templates[0]!;

    // /* css */ is treated as scss mode in this extension
    assert.strictEqual(tpl.languageId, 'scss');
    assert.ok(tpl.contentStartOffset < tpl.contentEndOffset);

    const raw = content.slice(tpl.contentStartOffset, tpl.contentEndOffset);
    assert.strictEqual(raw, 'div { color: red; }');

    assert.deepStrictEqual(tpl.expressionRanges, []);
    assert.strictEqual(tpl.virtualText, raw);
    assert.strictEqual(tpl.virtualDoc.getText(), raw);
  });

  test('respects language marker: /* less */', async () => {
    const content = 'const styles = /* less */ `@a: 1; .x { width: @a; }`';
    const doc = await vscode.workspace.openTextDocument({ language: 'typescript', content });
    const templates = findCssTemplatesInDocument(doc);

    assert.strictEqual(templates.length, 1);
    assert.strictEqual(templates[0]!.languageId, 'less');
  });

  test('captures ${...} expression ranges and blanks them in virtualText', async () => {
    const content = 'const styles = /* css */ `a{color:${' + 'x' + '};background:blue;}`;';
    const doc = await vscode.workspace.openTextDocument({ language: 'typescript', content });
    const templates = findCssTemplatesInDocument(doc);

    assert.strictEqual(templates.length, 1);
    const tpl = templates[0]!;

    const raw = content.slice(tpl.contentStartOffset, tpl.contentEndOffset);
    assert.strictEqual(raw, 'a{color:${x};background:blue;}');

    assert.strictEqual(tpl.expressionRanges.length, 1);
    const r = tpl.expressionRanges[0]!;
    assert.deepStrictEqual(r, { start: 'a{color:'.length, end: 'a{color:'.length + '${x}'.length });

    assert.strictEqual(tpl.virtualText.length, raw.length);

    const before = raw.slice(0, r.start);
    const blanked = tpl.virtualText.slice(r.start, r.end);
    const after = raw.slice(r.end);

    assert.strictEqual(before, tpl.virtualText.slice(0, r.start));
    assert.strictEqual(after, tpl.virtualText.slice(r.end));
    assert.ok(/^[ ]+$/.test(blanked), 'expected expression to be replaced with spaces');
  });

  test('does not match marker unless template starts immediately after (ignoring whitespace)', async () => {
    const content = 'const styles = /* css */ foo `div {}`;\nconst ok = /* css */\n`a{}`;';
    const doc = await vscode.workspace.openTextDocument({ language: 'typescript', content });
    const templates = findCssTemplatesInDocument(doc);

    assert.strictEqual(templates.length, 1);
    const tpl = templates[0]!;
    const raw = content.slice(tpl.contentStartOffset, tpl.contentEndOffset);
    assert.strictEqual(raw, 'a{}');
  });

  test('handles nested braces/strings inside ${...} without breaking', async () => {
    const content =
      'const styles = /* css */ `a{content:${' + 'fn({a: 1, b: \'}\', c: "{"})' + '};}`;';

    const doc = await vscode.workspace.openTextDocument({ language: 'typescript', content });
    const templates = findCssTemplatesInDocument(doc);

    assert.strictEqual(templates.length, 1);
    const tpl = templates[0]!;
    assert.strictEqual(tpl.expressionRanges.length, 1);

    const raw = content.slice(tpl.contentStartOffset, tpl.contentEndOffset);
    assert.ok(raw.includes('${'));
    assert.strictEqual(tpl.virtualText.length, raw.length);
  });
});
