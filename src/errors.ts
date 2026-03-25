export class GraphNotBuiltError extends Error {
  constructor() {
    super('Graph not built. Run build() first.');
    this.name = 'GraphNotBuiltError';
  }
}

export class SymbolNotFoundError extends Error {
  constructor(name: string) {
    super(`Symbol not found: "${name}"`);
    this.name = 'SymbolNotFoundError';
  }
}

export class PluginNotFoundError extends Error {
  constructor(ext: string) {
    super(`No plugin for extension: ${ext}`);
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
