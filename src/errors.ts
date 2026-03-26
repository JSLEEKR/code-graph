export class GraphNotBuiltError extends Error {
  constructor() {
    super('Graph not built. Run build() first.\nHint: Use `npx code-graph build --root .` or call `graph.build(rootDir, plugins)` in the API.');
    this.name = 'GraphNotBuiltError';
  }
}

export class SymbolNotFoundError extends Error {
  constructor(name: string) {
    super(`Symbol not found: "${name}"\nHint: Use \`npx code-graph search ${name}\` to find similar symbols, or rebuild with \`npx code-graph build\`.`);
    this.name = 'SymbolNotFoundError';
  }
}

export class PluginNotFoundError extends Error {
  constructor(ext: string) {
    super(`No plugin for extension: ${ext}\nHint: Only .ts/.tsx (TypeScript) and .py (Python) are supported. Implement LanguagePlugin for custom languages.`);
    this.name = 'PluginNotFoundError';
  }
}

export class ParseError extends Error {
  constructor(file: string, detail: string) {
    super(`Parse error in ${file}: ${detail}`);
    this.name = 'ParseError';
  }
}

export class CacheCorruptError extends Error {
  constructor(path: string) {
    super(`Cache corrupted: ${path}. Will rebuild.`);
    this.name = 'CacheCorruptError';
  }
}

export class BudgetExhaustedError extends Error {
  constructor(symbolId: string, tokens: number, budget: number) {
    super(`Target "${symbolId}" alone uses ${tokens} tokens (budget: ${budget}).`);
    this.name = 'BudgetExhaustedError';
  }
}
