import * as vscode from 'vscode';
import {
  getCSSLanguageService,
  getSCSSLanguageService,
  getLESSLanguageService,
  type LanguageService,
} from 'vscode-css-languageservice';
import {
  InsertTextFormat,
  type CompletionItem as LspCompletionItem,
  type CompletionList,
  type Hover as LspHover,
  type MarkedString,
  type MarkupContent,
  type TextEdit,
  Position as LspPosition,
} from 'vscode-languageserver-types';
import { findCssTemplatesInDocument, CssTemplate } from './scanner';

// todo: add diagnostics

const cssService = getCSSLanguageService();
const scssService = getSCSSLanguageService();
const lessService = getLESSLanguageService();

function serviceFor(tpl: CssTemplate): LanguageService {
  switch (tpl.languageId) {
    case 'scss':
      return scssService;
    case 'less':
      return lessService;
    default:
      return cssService;
  }
}

type CompletionResult = CompletionList | LspCompletionItem[];

function isCompletionList(value: CompletionResult): value is CompletionList {
  return !Array.isArray(value);
}

function isMarkupContent(value: unknown): value is MarkupContent {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return typeof rec.kind === 'string' && typeof rec.value === 'string';
}

function markedStringToString(value: MarkedString): string {
  return typeof value === 'string' ? value : value.value;
}

function hoverToMarkdown(hover: LspHover): vscode.MarkdownString | undefined {
  const contents = hover.contents;
  const text = Array.isArray(contents)
    ? contents.map(markedStringToString).filter(Boolean).join('\n\n')
    : isMarkupContent(contents)
      ? contents.value
      : markedStringToString(contents);

  if (!text) {
    return undefined;
  }
  const md = new vscode.MarkdownString(text);
  md.isTrusted = false;
  return md;
}

function isTextEdit(edit: LspCompletionItem['textEdit']): edit is TextEdit {
  return !!edit && typeof edit === 'object' && 'range' in edit;
}

type CacheEntry = {
  version: number;
  templates: CssTemplate[];
};

const cache = new Map<string, CacheEntry>();

function getTemplates(document: vscode.TextDocument): CssTemplate[] {
  const key = document.uri.toString();
  const hit = cache.get(key);
  if (hit && hit.version === document.version) {
    return hit.templates;
  }
  const templates = findCssTemplatesInDocument(document);
  cache.set(key, { version: document.version, templates });
  return templates;
}

function templateAt(document: vscode.TextDocument, offset: number): CssTemplate | undefined {
  for (const tpl of getTemplates(document)) {
    if (offset >= tpl.contentStartOffset && offset <= tpl.contentEndOffset) {
      return tpl;
    }
  }
  return undefined;
}

function isInsideExpression(tpl: CssTemplate, innerOffset: number): boolean {
  for (const r of tpl.expressionRanges) {
    if (innerOffset >= r.start && innerOffset < r.end) {
      return true;
    }
  }
  return false;
}

function toVscodeCompletionItems(
  document: vscode.TextDocument,
  tpl: CssTemplate,
  lspItems: CompletionResult
): vscode.CompletionItem[] {
  const out: vscode.CompletionItem[] = [];
  const items = isCompletionList(lspItems) ? lspItems.items : lspItems;

  for (const item of items) {
    const ci = new vscode.CompletionItem(item.label ?? '');
    ci.detail = item.detail;
    ci.documentation = item.documentation
      ? typeof item.documentation === 'string'
        ? item.documentation
        : new vscode.MarkdownString(item.documentation.value ?? '')
      : undefined;

    if (typeof item.sortText === 'string') {
      ci.sortText = item.sortText;
    }
    if (typeof item.filterText === 'string') {
      ci.filterText = item.filterText;
    }
    if (typeof item.commitCharacters !== 'undefined') {
      ci.commitCharacters = item.commitCharacters;
    }

    const isSnippet = item.insertTextFormat === InsertTextFormat.Snippet;

    if (isTextEdit(item.textEdit) && typeof item.textEdit.newText === 'string') {
      const start = document.positionAt(
        tpl.contentStartOffset + tpl.virtualDoc.offsetAt(item.textEdit.range.start)
      );
      const end = document.positionAt(
        tpl.contentStartOffset + tpl.virtualDoc.offsetAt(item.textEdit.range.end)
      );
      ci.range = new vscode.Range(start, end);
      ci.insertText = isSnippet
        ? new vscode.SnippetString(item.textEdit.newText)
        : item.textEdit.newText;
    } else if (typeof item.insertText === 'string') {
      ci.insertText = isSnippet ? new vscode.SnippetString(item.insertText) : item.insertText;
    }

    out.push(ci);
  }

  return out;
}

export function activate(context: vscode.ExtensionContext) {
  const selector: vscode.DocumentSelector = [
    { language: 'typescript', scheme: 'file' },
    { language: 'javascript', scheme: 'file' },
    { language: 'typescriptreact', scheme: 'file' },
    { language: 'javascriptreact', scheme: 'file' },
  ];

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(document, position, token) {
        if (token.isCancellationRequested) {
          return;
        }

        const offset = document.offsetAt(position);
        const tpl = templateAt(document, offset);
        if (!tpl) {
          return;
        }

        const innerOffset = offset - tpl.contentStartOffset;
        if (innerOffset < 0 || innerOffset > tpl.virtualText.length) {
          return;
        }
        if (isInsideExpression(tpl, innerOffset)) {
          return;
        }

        const lspPos = tpl.virtualDoc.positionAt(innerOffset);
        const svc = serviceFor(tpl);
        const stylesheet = svc.parseStylesheet(tpl.virtualDoc);
        const list = svc.doComplete(tpl.virtualDoc, lspPos, stylesheet);
        return toVscodeCompletionItems(document, tpl, list);
      },
    },
    ':',
    '-',
    ' ',
    '#',
    '.',
    '@',
    '('
  );

  const hoverProvider = vscode.languages.registerHoverProvider(selector, {
    provideHover(document, position, token) {
      if (token.isCancellationRequested) {
        return;
      }

      const offset = document.offsetAt(position);
      const tpl = templateAt(document, offset);
      if (!tpl) {
        return;
      }

      const innerOffset = offset - tpl.contentStartOffset;
      if (innerOffset < 0 || innerOffset > tpl.virtualText.length) {
        return;
      }
      if (isInsideExpression(tpl, innerOffset)) {
        return;
      }

      const lspPos: LspPosition = tpl.virtualDoc.positionAt(innerOffset);
      const svc = serviceFor(tpl);
      const stylesheet = svc.parseStylesheet(tpl.virtualDoc);
      const hover = svc.doHover(tpl.virtualDoc, lspPos, stylesheet);
      if (!hover?.contents) {
        return;
      }

      const md = hoverToMarkdown(hover);
      return md ? new vscode.Hover(md) : undefined;
    },
  });

  context.subscriptions.push(completionProvider, hoverProvider);

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      cache.delete(doc.uri.toString());
    })
  );
}

export function deactivate() {
  cache.clear();
}
