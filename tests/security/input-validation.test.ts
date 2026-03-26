import { describe, it, expect } from 'vitest';
import { TypeScriptPlugin } from '../../src/plugins/typescript.js';
import { PythonPlugin } from '../../src/plugins/python.js';
import { CodeGraph } from '../../src/graph/code-graph.js';
import { ContextExtractor } from '../../src/query/context-extractor.js';
import { resolve } from 'path';

describe('Input Validation', () => {
  const tsPlugin = new TypeScriptPlugin();
  const pyPlugin = new PythonPlugin();

  describe('malicious file paths', () => {
    it('handles path traversal in file path without crashing', () => {
      const maliciousPath = '../../../etc/passwd';
      // Parser should not crash on weird paths -- it just parses content
      const result = tsPlugin.parse(maliciousPath, 'export function safe() { return 1; }');
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
      // Symbol ID will contain the path, but that's safe since it's just a string key
      expect(result.symbols[0].filePath).toBe(maliciousPath);
    });

    it('handles null bytes and special characters in path', () => {
      const weirdPath = 'file\x00name.ts';
      const result = tsPlugin.parse(weirdPath, 'export function test() { return 1; }');
      expect(result.symbols).toBeDefined();
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('crafted source files', () => {
    it('handles deeply nested braces without stack overflow', () => {
      // 200 levels of nested braces
      const depth = 200;
      const open = 'function f() {' + ' if(true) {'.repeat(depth);
      const close = '}'.repeat(depth + 1);
      const source = open + ' return 1; ' + close;
      const result = tsPlugin.parse('deep.ts', source);
      // Should not crash, symbols may or may not be found
      expect(result).toBeDefined();
      expect(result.symbols).toBeDefined();
    });

    it('handles long source file without crashing', () => {
      // Generate a file with many functions
      const funcs = Array.from({ length: 100 }, (_, i) =>
        `export function fn${i}() { return ${i}; }`
      ).join('\n');
      const result = tsPlugin.parse('large.ts', funcs);
      expect(result).toBeDefined();
      expect(result.symbols.length).toBe(100);
    });

    it('handles empty source file gracefully', () => {
      const result = tsPlugin.parse('empty.ts', '');
      expect(result.symbols).toEqual([]);
      expect(result.imports).toEqual([]);
      expect(result.calls).toEqual([]);
    });

    it('handles source with only comments', () => {
      const source = '// just a comment\n/* block comment */\n// another comment';
      const result = tsPlugin.parse('comments.ts', source);
      expect(result.symbols).toEqual([]);
    });

    it('Python plugin handles malformed indentation gracefully', () => {
      const source = 'def broken():\n\treturn 1\n    def nested():\n        return 2\nclass Foo:\n    pass';
      const result = pyPlugin.parse('malformed.py', source);
      expect(result).toBeDefined();
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    });

    it('handles unclosed braces without infinite loop', () => {
      const source = 'export function unclosed() { if (true) { while (true) {';
      const result = tsPlugin.parse('unclosed.ts', source);
      // Should complete without hanging; findBlockEnd returns lines.length as fallback
      expect(result).toBeDefined();
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    });
  });
});
