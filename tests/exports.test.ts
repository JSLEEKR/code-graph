import { describe, it, expect } from 'vitest';
import {
  // Types
  type LanguagePlugin,
  type ParseResult,
  type SymbolNode,
  type ImportInfo,
  type CallInfo,
  type GraphNode,
  type GraphEdge,
  type SymbolMetrics,
  type ContextOptions,
  type ContextBundle,
  type ImpactResult,
  type SearchResult,
  type DependencyChain,
  type CodeStats,
  // Errors
  GraphNotBuiltError,
  SymbolNotFoundError,
  PluginNotFoundError,
  ParseError,
  CacheCorruptError,
  BudgetExhaustedError,
  // Classes and functions
  PluginRegistry,
  TypeScriptPlugin,
  PythonPlugin,
  scanFiles,
  CodeGraph,
  computeComplexity,
  estimateTokens,
  computeSymbolMetrics,
  ContextExtractor,
  CacheManager,
  startMCPServer,
} from '../src/index.js';

describe('Package exports', () => {
  it('exports all public classes', () => {
    expect(CodeGraph).toBeDefined();
    expect(ContextExtractor).toBeDefined();
    expect(CacheManager).toBeDefined();
    expect(PluginRegistry).toBeDefined();
    expect(TypeScriptPlugin).toBeDefined();
    expect(PythonPlugin).toBeDefined();
  });

  it('exports all error classes', () => {
    expect(GraphNotBuiltError).toBeDefined();
    expect(SymbolNotFoundError).toBeDefined();
    expect(PluginNotFoundError).toBeDefined();
    expect(ParseError).toBeDefined();
    expect(CacheCorruptError).toBeDefined();
    expect(BudgetExhaustedError).toBeDefined();
  });

  it('exports utility functions', () => {
    expect(typeof scanFiles).toBe('function');
    expect(typeof computeComplexity).toBe('function');
    expect(typeof estimateTokens).toBe('function');
    expect(typeof computeSymbolMetrics).toBe('function');
    expect(typeof startMCPServer).toBe('function');
  });

  it('error classes are proper Error subclasses', () => {
    const err = new GraphNotBuiltError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('GraphNotBuiltError');

    const err2 = new SymbolNotFoundError('test');
    expect(err2).toBeInstanceOf(Error);
    expect(err2.message).toContain('test');
  });
});
