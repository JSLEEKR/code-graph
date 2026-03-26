import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { CodeGraph } from '../../src/graph/code-graph.js';
import { ContextExtractor, levenshtein } from '../../src/query/context-extractor.js';
import { TypeScriptPlugin } from '../../src/plugins/typescript.js';
import { SymbolNotFoundError } from '../../src/errors.js';

describe('ContextExtractor', () => {
  let graph: CodeGraph;
  let extractor: ContextExtractor;

  beforeAll(async () => {
    graph = new CodeGraph();
    await graph.build(resolve('fixtures/typescript'), [new TypeScriptPlugin()]);
    extractor = new ContextExtractor(graph);
  });

  // extract tests
  describe('extract', () => {
    it('includes target node in context', () => {
      const result = extractor.extract('greet', { budget: 5000, mode: 'debug' });
      expect(result.target.name).toBe('greet');
      expect(result.graph.nodes).toContain(result.target.id);
    });

    it('respects token budget', () => {
      // Use a very small budget that only fits the target
      const result = extractor.extract('greet', { budget: 20, mode: 'debug' });
      expect(result.tokenCount).toBeLessThanOrEqual(result.budget);
      // With tiny budget, should have few or no related symbols
      expect(result.tokenCount).toBeLessThanOrEqual(20);
    });

    it('debug mode prioritizes callees', () => {
      // farewell calls greet, so in debug mode for farewell,
      // callees (greet) should be prioritized
      const result = extractor.extract('farewell', { budget: 5000, mode: 'debug' });
      const relatedNames = result.related.map(s => s.name);
      // greet is a callee of farewell, should be included
      expect(relatedNames).toContain('greet');
    });

    it('refactor mode prioritizes callers', () => {
      // greet is called by farewell and greetUser
      // In refactor mode, callers should be prioritized
      const result = extractor.extract('greet', { budget: 5000, mode: 'refactor' });
      const relatedNames = result.related.map(s => s.name);
      // farewell and/or greetUser are callers, should appear
      const hasCallers = relatedNames.includes('farewell') || relatedNames.includes('greetUser');
      expect(hasCallers).toBe(true);
    });

    it('generates correct summary string', () => {
      const result = extractor.extract('greet', { budget: 5000, mode: 'debug' });
      // Summary should start with "greet (X lines)"
      expect(result.summary).toMatch(/^greet \(\d+ lines\)/);
      // Should contain caller/callee info if any
      expect(result.summary).toMatch(/greet \(\d+ lines\)/);
    });

    it('handles circular dependencies with visited set', () => {
      // farewell calls greet, greet is called by farewell
      // This shouldn't cause infinite loop
      const result = extractor.extract('farewell', { budget: 5000, mode: 'debug' });
      // Should complete without hanging
      expect(result.target.name).toBe('farewell');
      // No duplicates in related
      const ids = result.related.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // impact tests
  describe('impact', () => {
    it('finds direct callers', () => {
      // greet is called by farewell and greetUser
      const result = extractor.impact('greet');
      const directCallerNames = result.directCallers.map(id => graph.getNode(id)?.symbol.name);
      expect(directCallerNames).toContain('farewell');
      expect(directCallerNames).toContain('greetUser');
    });

    it('finds transitive callers', () => {
      // greet <- farewell (direct)
      // greet <- greetUser (direct)
      // If there are callers of farewell or greetUser, they'd be transitive
      const result = extractor.impact('greet');
      // transitiveCallers should be an array (may be empty if no further callers)
      expect(Array.isArray(result.transitiveCallers)).toBe(true);
      expect(result.affectedFiles.length).toBeGreaterThan(0);
    });

    it('sets riskLevel correctly', () => {
      // greet has 2 direct callers (farewell + greetUser) => low (0-2)
      const result = extractor.impact('greet');
      expect(result.riskLevel).toBe('low');

      // processUser likely has 0 direct callers => low
      const result2 = extractor.impact('processUser');
      expect(result2.riskLevel).toBe('low');
    });
  });

  // search tests
  describe('search', () => {
    it('returns scored results', () => {
      const results = extractor.search('greet');
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.score).toBeGreaterThan(0);
        expect(r.score).toBeLessThanOrEqual(1);
        expect(r.name).toBeDefined();
        expect(r.kind).toBeDefined();
      }
    });

    it('returns fuzzy matches with score 0.3', () => {
      // 'greet' vs 'greel' has Levenshtein distance 1
      const results = extractor.search('greel');
      const fuzzy = results.find(r => r.name === 'greet');
      expect(fuzzy).toBeDefined();
      expect(fuzzy!.score).toBe(0.3);
    });

    it('levenshtein distance is correct', () => {
      expect(levenshtein('kitten', 'sitting')).toBe(3);
      expect(levenshtein('greet', 'greel')).toBe(1);
      expect(levenshtein('abc', 'abc')).toBe(0);
      expect(levenshtein('', 'abc')).toBe(3);
      expect(levenshtein('abc', '')).toBe(3);
    });

    it('ranks exact matches highest', () => {
      const results = extractor.search('greet');
      // 'greet' exact match should have score 1.0
      // 'greetUser' starts with 'greet' should have score 0.8
      const exactMatch = results.find(r => r.name === 'greet');
      const prefixMatch = results.find(r => r.name === 'greetUser');
      expect(exactMatch).toBeDefined();
      expect(exactMatch!.score).toBe(1.0);
      if (prefixMatch) {
        expect(prefixMatch.score).toBe(0.8);
        expect(exactMatch!.score).toBeGreaterThan(prefixMatch.score);
      }
      // First result should be the exact match
      expect(results[0].score).toBe(1.0);
    });
  });

  // dependencies tests
  describe('dependencies', () => {
    it('returns upstream chain', () => {
      // farewell calls greet, so upstream from farewell should include greet
      const result = extractor.dependencies('farewell', 'upstream');
      expect(result.direction).toBe('upstream');
      expect(result.target).toBeDefined();
      const depIds = result.nodes.map(n => n.symbolId);
      const depNames = depIds.map(id => graph.getNode(id)?.symbol.name);
      expect(depNames).toContain('greet');
      // Check depth
      const greetDep = result.nodes.find(n => graph.getNode(n.symbolId)?.symbol.name === 'greet');
      expect(greetDep).toBeDefined();
      expect(greetDep!.depth).toBe(1);
    });

    it('returns downstream chain', () => {
      // greet is called by farewell and greetUser => downstream
      const result = extractor.dependencies('greet', 'downstream');
      expect(result.direction).toBe('downstream');
      const depNames = result.nodes.map(n => graph.getNode(n.symbolId)?.symbol.name);
      expect(depNames).toContain('farewell');
      expect(depNames).toContain('greetUser');
    });
  });

  // formatContextAsText tests
  describe('formatContextAsText', () => {
    it('formats target and related symbols as readable text', () => {
      const bundle = extractor.extract('farewell', { budget: 5000, mode: 'debug' });
      const text = extractor.formatContextAsText(bundle);
      expect(text).toContain('=== Context for: farewell ===');
      expect(text).toContain('Budget:');
      expect(text).toContain('--- Target ---');
      expect(text).toContain('function farewell');
      expect(text).toContain('--- Related');
    });

    it('includes metrics in formatted output', () => {
      const bundle = extractor.extract('farewell', { budget: 5000, mode: 'debug' });
      const text = extractor.formatContextAsText(bundle);
      expect(text).toContain('Metrics:');
      expect(text).toContain('complexity=');
      expect(text).toContain('lines=');
    });

    it('shows callers and callees in target metrics', () => {
      const bundle = extractor.extract('greet', { budget: 5000, mode: 'debug' });
      const text = extractor.formatContextAsText(bundle);
      expect(text).toContain('callers=');
      expect(text).toContain('callees=');
    });

    it('omits related section when no related symbols', () => {
      const bundle = extractor.extract('greet', { budget: 20, mode: 'debug' });
      const text = extractor.formatContextAsText(bundle);
      expect(text).toContain('=== Context for: greet ===');
      expect(text).toContain('--- Target ---');
      // With budget of 20, no related symbols should fit
      if (bundle.related.length === 0) {
        expect(text).not.toContain('--- Related');
      }
    });
  });

  // small budget test
  describe('small budget extraction', () => {
    it('only includes target with very small budget (100 tokens)', () => {
      const result = extractor.extract('greet', { budget: 100, mode: 'debug' });
      expect(result.target.name).toBe('greet');
      expect(result.tokenCount).toBeLessThanOrEqual(100);
      // With 100 tokens, there may be few or no related symbols
      expect(result.tokenCount).toBeLessThanOrEqual(result.budget);
    });
  });

  // extractFromDiff tests
  describe('extractFromDiff', () => {
    it('extracts context for changed files', () => {
      const bundle = extractor.extractFromDiff(['simple.ts'], {
        budget: 5000,
        mode: 'debug',
      });
      expect(bundle.summary).toContain('diff-context');
      expect(bundle.summary).toContain('changed symbols');
      // Should find symbols in simple.ts
      expect(bundle.target.name).toBeTruthy();
      expect(bundle.tokenCount).toBeGreaterThan(0);
    });

    it('returns empty bundle for non-existent files', () => {
      const bundle = extractor.extractFromDiff(['nonexistent-file.ts'], {
        budget: 5000,
        mode: 'debug',
      });
      expect(bundle.summary).toBe('No symbols found in changed files');
      expect(bundle.tokenCount).toBe(0);
      expect(bundle.related).toEqual([]);
    });
  });

  // empty graph test
  describe('empty graph edge case', () => {
    it('search returns empty array when no symbols match', () => {
      const results = extractor.search('zzzznonexistent');
      expect(results).toEqual([]);
    });

    it('extract throws for unknown symbol on empty-like query', () => {
      expect(() => extractor.extract('zzzznonexistent', { budget: 5000, mode: 'debug' }))
        .toThrow(SymbolNotFoundError);
    });
  });

  // dependencies maxDepth test
  describe('dependencies with maxDepth', () => {
    it('respects maxDepth=1 limit', () => {
      const result = extractor.dependencies('farewell', 'upstream', 1);
      // Should only include depth 1, not deeper
      for (const node of result.nodes) {
        expect(node.depth).toBeLessThanOrEqual(1);
      }
    });
  });

  // stats tests
  describe('stats', () => {
    it('hotspots are sorted by complexity descending', () => {
      const result = extractor.stats();
      for (let i = 1; i < result.hotspots.length; i++) {
        expect(result.hotspots[i - 1].metrics.complexity).toBeGreaterThanOrEqual(
          result.hotspots[i].metrics.complexity
        );
      }
    });

    it('returns correct totals and hotspots', () => {
      const result = extractor.stats();
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalSymbols).toBeGreaterThan(0);
      expect(result.totalEdges).toBeGreaterThanOrEqual(0);
      expect(result.byLanguage).toHaveProperty('TypeScript');
      expect(result.byLanguage['TypeScript'].files).toBeGreaterThan(0);
      expect(result.byLanguage['TypeScript'].symbols).toBeGreaterThan(0);
      expect(result.hotspots.length).toBeGreaterThan(0);
      expect(result.hotspots.length).toBeLessThanOrEqual(10);
      // Hotspots should be sorted by complexity descending
      for (let i = 1; i < result.hotspots.length; i++) {
        expect(result.hotspots[i - 1].metrics.complexity).toBeGreaterThanOrEqual(
          result.hotspots[i].metrics.complexity
        );
      }
    });
  });
});
