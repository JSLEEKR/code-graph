import type { SymbolMetrics } from '../types.js';

export function computeComplexity(source: string): number {
  let complexity = 1;
  const patterns = /\b(if|else\s+if|for|while|switch|case|catch)\b|\?\s|&&|\|\|/g;
  let match;
  while ((match = patterns.exec(source)) !== null) {
    complexity++;
  }
  return complexity;
}

export function estimateTokens(source: string): number {
  return Math.ceil(source.length / 4);
}

export function computeSymbolMetrics(
  symbol: { source: string; startLine: number; endLine: number; params?: string[] },
  callerCount: number,
  calleeCount: number,
): SymbolMetrics {
  return {
    lineCount: symbol.endLine - symbol.startLine + 1,
    paramCount: symbol.params?.length ?? 0,
    callerCount,
    calleeCount,
    complexity: computeComplexity(symbol.source),
  };
}
