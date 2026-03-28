import type { LanguagePlugin, ParseResult, SymbolNode, ImportInfo, CallInfo } from '../types.js';

export class TypeScriptPlugin implements LanguagePlugin {
  name = 'typescript';
  extensions = ['.ts', '.tsx'];

  parse(filePath: string, source: string): ParseResult {
    const lines = source.split('\n');
    const symbols = this.extractSymbols(filePath, source, lines);
    const imports = this.extractImports(filePath, source);
    const calls = this.extractCalls(filePath, source, lines, symbols);
    return { symbols, imports, calls };
  }

  private extractSymbols(filePath: string, source: string, lines: string[]): SymbolNode[] {
    const symbols: SymbolNode[] = [];

    // Track class boundaries for method extraction
    const classRanges: Array<{ name: string; id: string; startLine: number; endLine: number }> = [];

    // Extract classes
    const classRegex = /^(?:export\s+)?class\s+(\w+)/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(classRegex);
      if (match) {
        const name = match[1];
        const startLine = i + 1;
        const endLine = this.findBlockEnd(lines, i);
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

    // Extract interfaces
    const interfaceRegex = /^(?:export\s+)?interface\s+(\w+)/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(interfaceRegex);
      if (match) {
        const name = match[1];
        const startLine = i + 1;
        const endLine = this.findBlockEnd(lines, i);
        const blockSource = lines.slice(i, endLine).join('\n');
        symbols.push({
          id: `${filePath}::${name}`,
          name,
          kind: 'interface',
          filePath,
          startLine,
          endLine,
          source: blockSource,
        });
      }
    }

    // Extract type aliases
    const typeRegex = /^(?:export\s+)?type\s+(\w+)\s*=/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(typeRegex);
      if (match) {
        const name = match[1];
        const startLine = i + 1;
        // Type aliases can be single-line or multi-line
        let endLine = startLine;
        if (lines[i].includes('{')) {
          endLine = this.findBlockEnd(lines, i);
        } else {
          // Find the semicolon
          for (let j = i; j < lines.length; j++) {
            if (lines[j].includes(';')) {
              endLine = j + 1;
              break;
            }
          }
        }
        const blockSource = lines.slice(i, endLine).join('\n');
        symbols.push({
          id: `${filePath}::${name}`,
          name,
          kind: 'type',
          filePath,
          startLine,
          endLine,
          source: blockSource,
        });
      }
    }

    // Extract top-level functions
    const funcRegex = /^(?:export\s+)?function\s+(\w+)\s*\(([^)]*)\)/;
    for (let i = 0; i < lines.length; i++) {
      // Skip if inside a class
      if (this.isInsideClass(i + 1, classRanges)) continue;

      const match = lines[i].match(funcRegex);
      if (match) {
        const name = match[1];
        const paramsStr = match[2];
        const startLine = i + 1;
        const endLine = this.findBlockEnd(lines, i);
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

    // Extract exported arrow functions: export const X = (...) => {
    const arrowRegex = /^(?:export\s+)?const\s+(\w+)\s*=\s*\(([^)]*)\)\s*(?::\s*\w+)?\s*=>/;
    for (let i = 0; i < lines.length; i++) {
      if (this.isInsideClass(i + 1, classRanges)) continue;

      const match = lines[i].match(arrowRegex);
      if (match) {
        const name = match[1];
        const paramsStr = match[2];
        const startLine = i + 1;
        const endLine = this.findBlockEnd(lines, i);
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

    // Extract class methods
    for (const cls of classRanges) {
      const methodRegex = /^\s+(?:(?:public|private|protected|static|async|readonly)\s+)*(\w+)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/;
      for (let i = cls.startLine - 1; i < cls.endLine; i++) {
        const match = lines[i].match(methodRegex);
        if (match) {
          const name = match[1];
          // Skip constructor
          if (name === 'constructor') continue;
          const paramsStr = match[2];
          const startLine = i + 1;
          const endLine = this.findBlockEnd(lines, i);
          const blockSource = lines.slice(i, endLine).join('\n');
          const params = this.parseParams(paramsStr);
          symbols.push({
            id: `${filePath}::${name}`,
            name,
            kind: 'method',
            filePath,
            startLine,
            endLine,
            source: blockSource.trim(),
            parentSymbol: cls.id,
            params,
          });
        }
      }
    }

    return symbols;
  }

  private extractImports(filePath: string, source: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const importRegex = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(source)) !== null) {
      const symbolNames = match[1].split(',').map(s => {
        const trimmed = s.trim();
        // Handle aliased imports: "foo as bar" → take original name "foo"
        const asIndex = trimmed.indexOf(' as ');
        return asIndex !== -1 ? trimmed.slice(0, asIndex).trim() : trimmed;
      }).filter(Boolean);
      imports.push({
        fromFile: filePath,
        toModule: match[2],
        symbols: symbolNames,
      });
    }
    return imports;
  }

  private extractCalls(
    filePath: string,
    source: string,
    lines: string[],
    symbols: SymbolNode[],
  ): CallInfo[] {
    const calls: CallInfo[] = [];
    // Build a list of callable symbols (functions and methods)
    const callableSymbols = symbols.filter(s => s.kind === 'function' || s.kind === 'method');

    // General call pattern: identifier( or this.identifier( or obj.identifier(
    const callRegex = /(?:(?:\w+|this)\.)?(\w+)\s*\(/g;

    // Keywords to exclude from call detection
    const keywords = new Set([
      'if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'typeof',
      'import', 'export', 'function', 'class', 'interface', 'type', 'const',
      'let', 'var', 'constructor',
    ]);

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
          // Skip class/interface declarations
          if (line.match(/^\s*(?:export\s+)?(?:class|interface|type)\s/)) continue;

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

  private findBlockEnd(lines: string[], startIdx: number): number {
    let braceCount = 0;
    let foundBrace = false;
    for (let i = startIdx; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') {
          braceCount++;
          foundBrace = true;
        } else if (ch === '}') {
          braceCount--;
        }
      }
      if (foundBrace && braceCount === 0) {
        return i + 1;
      }
    }
    return lines.length;
  }

  private isInsideClass(
    lineNum: number,
    classRanges: Array<{ startLine: number; endLine: number }>,
  ): boolean {
    return classRanges.some(c => lineNum > c.startLine && lineNum <= c.endLine);
  }

  private parseParams(paramsStr: string): string[] {
    if (!paramsStr.trim()) return [];
    return paramsStr
      .split(',')
      .map(p => p.trim())
      .map(p => {
        // Handle "public id: string" → "id"
        const parts = p.replace(/^(?:public|private|protected|readonly)\s+/, '');
        return parts.split(/\s*[?:=]/)[0].trim();
      })
      .filter(Boolean);
  }
}
