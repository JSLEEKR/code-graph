import type { LanguagePlugin, ParseResult, SymbolNode, ImportInfo, CallInfo } from '../types.js';

export class PythonPlugin implements LanguagePlugin {
  name = 'python';
  extensions = ['.py'];

  parse(filePath: string, source: string): ParseResult {
    const lines = source.split('\n');
    const symbols = this.extractSymbols(filePath, source, lines);
    const imports = this.extractImports(filePath, source);
    const calls = this.extractCalls(filePath, lines, symbols);
    return { symbols, imports, calls };
  }

  private extractSymbols(filePath: string, source: string, lines: string[]): SymbolNode[] {
    const symbols: SymbolNode[] = [];

    // Track class boundaries for method extraction
    const classRanges: Array<{ name: string; id: string; startLine: number; endLine: number }> = [];

    // Extract classes: lines starting with "class ClassName:"
    const classRegex = /^class\s+(\w+).*:/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(classRegex);
      if (match) {
        const name = match[1];
        const startLine = i + 1;
        const endLine = this.findIndentBlockEnd(lines, i);
        const id = `${filePath}::${name}`;
        const blockSource = lines.slice(i, endLine).join('\n');
        symbols.push({
          id,
          name,
          kind: 'class',
          filePath,
          startLine,
          endLine,
          source: blockSource,
        });
        classRanges.push({ name, id, startLine, endLine });
      }
    }

    // Extract top-level functions: "def function_name(...):"
    const funcRegex = /^def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*[^:]+)?:/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(funcRegex);
      if (match) {
        const name = match[1];
        const paramsStr = match[2];
        const startLine = i + 1;
        const endLine = this.findIndentBlockEnd(lines, i);
        const blockSource = lines.slice(i, endLine).join('\n');
        const params = this.parseParams(paramsStr);
        symbols.push({
          id: `${filePath}::${name}`,
          name,
          kind: 'function',
          filePath,
          startLine,
          endLine,
          source: blockSource,
          params,
        });
      }
    }

    // Extract class methods: indented "def method_name(...):"
    const methodRegex = /^(\s+)def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*[^:]+)?:/;
    for (const cls of classRanges) {
      // Scan inside the class block (lines after the class definition line)
      for (let i = cls.startLine; i < cls.endLine && i < lines.length; i++) {
        const match = lines[i].match(methodRegex);
        if (!match) continue;

        const indent = match[1];
        const name = match[2];
        const paramsStr = match[3];

        // Only pick up direct methods (one level of indentation inside the class)
        // Ensure the def is directly inside the class, not nested deeper
        const classIndent = this.getIndent(lines[cls.startLine - 1]);
        const expectedIndent = classIndent + '    ';
        if (!indent.startsWith(expectedIndent)) continue;
        // Ensure it's not deeper than one level
        if (indent.length > expectedIndent.length) continue;

        const startLine = i + 1;
        const endLine = this.findIndentBlockEnd(lines, i);
        const blockSource = lines.slice(i, endLine).join('\n');
        const params = this.parseParams(paramsStr);

        // Remove the function from the 'function' list since it's actually a method
        const existingIdx = symbols.findIndex(
          s => s.kind === 'function' && s.name === name && s.startLine === startLine,
        );
        if (existingIdx !== -1) {
          symbols.splice(existingIdx, 1);
        }

        symbols.push({
          id: `${filePath}::${cls.name}.${name}`,
          name,
          kind: 'method',
          filePath,
          startLine,
          endLine,
          source: blockSource,
          parentSymbol: cls.id,
          params,
        });
      }
    }

    return symbols;
  }

  private extractImports(filePath: string, source: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // from module import X, Y
    const fromImportRegex = /^from\s+(\S+)\s+import\s+(.+)/gm;
    let match;
    while ((match = fromImportRegex.exec(source)) !== null) {
      const toModule = match[1];
      const symbolNames = match[2]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      imports.push({ fromFile: filePath, toModule, symbols: symbolNames });
    }

    // import module
    const importRegex = /^import\s+(\S+)/gm;
    while ((match = importRegex.exec(source)) !== null) {
      const toModule = match[1];
      imports.push({ fromFile: filePath, toModule, symbols: [toModule] });
    }

    return imports;
  }

  private extractCalls(filePath: string, lines: string[], symbols: SymbolNode[]): CallInfo[] {
    const calls: CallInfo[] = [];

    // General call pattern: identifier( or self.method( or obj.method(
    const callRegex = /(?:(?:\w+)\.)?(\w+)\s*\(/g;

    // Python keywords to exclude
    const keywords = new Set([
      'if', 'for', 'while', 'with', 'except', 'return', 'class', 'def',
      'import', 'from', 'raise', 'assert', 'lambda', 'print', 'super',
      'isinstance', 'issubclass', 'hasattr', 'getattr', 'setattr', 'delattr',
      'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed',
      'list', 'dict', 'set', 'tuple', 'str', 'int', 'float', 'bool', 'type',
    ]);

    const callableSymbols = symbols.filter(s => s.kind === 'function' || s.kind === 'method');

    for (const sym of callableSymbols) {
      for (let i = sym.startLine - 1; i < sym.endLine && i < lines.length; i++) {
        const line = lines[i];
        let match;
        callRegex.lastIndex = 0;
        while ((match = callRegex.exec(line)) !== null) {
          const calleeName = match[1];
          // Skip the function's own declaration line
          if (i === sym.startLine - 1 && calleeName === sym.name) continue;
          // Skip keywords
          if (keywords.has(calleeName)) continue;
          // Skip class/def declarations
          if (line.match(/^\s*(?:class|def)\s/)) continue;

          calls.push({
            callerSymbol: sym.id,
            calleeName,
            filePath,
            line: i + 1,
          });
        }
      }
    }

    return calls;
  }

  private getIndent(line: string): string {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
  }

  private findIndentBlockEnd(lines: string[], startIdx: number): number {
    // The block starts at startIdx (the def/class line).
    // The block ends when we see a line at the same or lesser indentation (non-empty, non-comment).
    const startIndent = this.getIndent(lines[startIdx]);

    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      // Skip blank lines and comment-only lines
      if (line.trim() === '' || line.trim().startsWith('#')) continue;

      const indent = this.getIndent(line);
      if (indent.length <= startIndent.length) {
        return i; // exclusive end
      }
    }

    return lines.length;
  }

  private parseParams(paramsStr: string): string[] {
    if (!paramsStr.trim()) return [];
    return paramsStr
      .split(',')
      .map(p => p.trim())
      .map(p => {
        // Handle "name: str = 'default'" → "name"
        return p.split(/\s*[=:]/)[0].trim();
      })
      .filter(p => p && p !== 'self' && p !== 'cls');
  }
}
