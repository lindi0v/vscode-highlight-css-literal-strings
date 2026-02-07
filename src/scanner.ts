import * as vscode from 'vscode';
import { TextDocument as LspTextDocument } from 'vscode-languageserver-textdocument';

export type OffsetRange = { start: number; end: number };

export type CssTemplate = {
  languageId: 'css' | 'scss' | 'less';
  contentStartOffset: number;
  contentEndOffset: number;
  expressionRanges: OffsetRange[];
  virtualText: string;
  virtualDoc: LspTextDocument;
};

const MARKER_RE = /\/\*\s*(css|scss|less)\s*\*\//g;

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}

function buildVirtualText(raw: string, exprRanges: OffsetRange[]): string {
  if (exprRanges.length === 0) {
    return raw;
  }
  const chars = raw.split('');
  for (const r of exprRanges) {
    for (let i = r.start; i < r.end; i++) {
      chars[i] = ' ';
    }
  }
  return chars.join('');
}

function scanTemplateLiteral(
  source: string,
  startBacktickOffset: number
):
  | {
      contentStartOffset: number;
      contentEndOffset: number;
      expressionRanges: OffsetRange[];
      endBacktickOffset: number;
    }
  | undefined {
  const contentStartOffset = startBacktickOffset + 1;
  const expressionRanges: OffsetRange[] = [];

  let i = contentStartOffset;
  while (i < source.length) {
    const ch = source[i];

    if (ch === '\\') {
      i += 2;
      continue;
    }

    if (ch === '`') {
      const contentEndOffset = i;
      return { contentStartOffset, contentEndOffset, expressionRanges, endBacktickOffset: i };
    }

    if (ch === '$' && source[i + 1] === '{') {
      const exprStart = i;
      i += 2; // skip ${

      let braceDepth = 1;
      while (i < source.length && braceDepth > 0) {
        const c = source[i];

        if (c === '\\') {
          i += 2;
          continue;
        }

        if (c === "'" || c === '"') {
          const quote = c;
          i++;
          while (i < source.length) {
            const qc = source[i];
            if (qc === '\\') {
              i += 2;
              continue;
            }
            i++;
            if (qc === quote) {
              break;
            }
          }
          continue;
        }

        if (c === '`') {
          // nested template inside expression
          i++;
          while (i < source.length) {
            const tc = source[i];
            if (tc === '\\') {
              i += 2;
              continue;
            }
            if (tc === '`') {
              i++;
              break;
            }
            if (tc === '$' && source[i + 1] === '{') {
              // skip nested ${...}
              i += 2;
              let nested = 1;
              while (i < source.length && nested > 0) {
                const nc = source[i];
                if (nc === '\\') {
                  i += 2;
                  continue;
                }
                if (nc === '{') {
                  nested++;
                } else if (nc === '}') {
                  nested--;
                }
                i++;
              }
              continue;
            }
            i++;
          }
          continue;
        }

        if (c === '{') {
          braceDepth++;
        } else if (c === '}') {
          braceDepth--;
        }
        i++;
      }

      const exprEnd = i; // includes closing }
      expressionRanges.push({
        start: exprStart - contentStartOffset,
        end: exprEnd - contentStartOffset,
      });
      continue;
    }

    i++;
  }

  return undefined;
}

export function findCssTemplatesInDocument(document: vscode.TextDocument): CssTemplate[] {
  const text = document.getText();
  const templates: CssTemplate[] = [];

  for (const m of text.matchAll(MARKER_RE)) {
    const markerIndex = m.index;
    if (markerIndex === undefined) {
      continue;
    }
    const markerLang = (m[1] as 'css' | 'scss' | 'less') ?? 'css';
    // VS Code's CSS grammar / language service support for nesting is limited.
    // To provide correct highlighting for nested selectors (like in the example),
    // treat /* css */ as SCSS mode (SCSS is a CSS superset for most editing features).
    const languageId: 'css' | 'scss' | 'less' = markerLang === 'less' ? 'less' : 'scss';

    let i = markerIndex + m[0].length;
    while (i < text.length && isWhitespace(text[i])) {
      i++;
    }
    if (text[i] !== '`') {
      continue;
    } // must be immediately after marker (ignoring whitespace)

    const parsed = scanTemplateLiteral(text, i);
    if (!parsed) {
      continue;
    }

    const raw = text.slice(parsed.contentStartOffset, parsed.contentEndOffset);
    const virtualText = buildVirtualText(raw, parsed.expressionRanges);
    const virtualDoc = LspTextDocument.create(
      `inmemory://css-template/${encodeURIComponent(document.uri.toString())}/${parsed.contentStartOffset}.${languageId}`,
      languageId,
      document.version,
      virtualText
    );

    templates.push({
      languageId,
      contentStartOffset: parsed.contentStartOffset,
      contentEndOffset: parsed.contentEndOffset,
      expressionRanges: parsed.expressionRanges,
      virtualText,
      virtualDoc,
    });
  }

  return templates;
}
