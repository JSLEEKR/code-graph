import { describe, it, expect } from 'vitest';
import { computeComplexity, computeSymbolMetrics, estimateTokens } from '../../src/graph/metrics.js';

describe('Metrics', () => {
  it('computeComplexity returns 1 for simple function', () => {
    expect(computeComplexity('function greet(name) { return name; }')).toBe(1);
  });

  it('computeComplexity counts if/for/while', () => {
    const code = 'function f(x) { if (x > 0) { for (let i = 0; i < x; i++) { while(true) {} } } }';
    expect(computeComplexity(code)).toBe(4); // 1 base + if + for + while
  });

  it('computeSymbolMetrics returns correct values', () => {
    const metrics = computeSymbolMetrics(
      { source: 'function f(a, b) {\n  if (a) return b;\n  return a;\n}', startLine: 1, endLine: 4, params: ['a', 'b'] },
      3, 2,
    );
    expect(metrics.lineCount).toBe(4);
    expect(metrics.paramCount).toBe(2);
    expect(metrics.callerCount).toBe(3);
    expect(metrics.calleeCount).toBe(2);
    expect(metrics.complexity).toBe(2); // 1 base + 1 if
  });

  it('estimateTokens estimates correctly', () => {
    expect(estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 → 3
    expect(estimateTokens('')).toBe(0);
  });
});
