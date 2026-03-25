import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { CodeGraph } from '../../src/graph/code-graph.js';
import { TypeScriptPlugin } from '../../src/plugins/typescript.js';
import { GraphNotBuiltError, SymbolNotFoundError } from '../../src/errors.js';

describe('CodeGraph', () => {
  let graph: CodeGraph;
  const fixtureDir = resolve('fixtures/typescript');

  beforeAll(async () => {
    const tsPlugin = new TypeScriptPlugin();
    graph = new CodeGraph();
    await graph.build(fixtureDir, [tsPlugin]);
  });

  it('builds nodes for all symbols in fixtures', () => {
    const allNodes = graph.getAllNodes();
    const names = allNodes.map(n => n.symbol.name);
    // simple.ts: greet, farewell
    expect(names).toContain('greet');
    expect(names).toContain('farewell');
    // classes.ts: Identifiable, User, getDisplayName, greetUser
    expect(names).toContain('User');
    expect(names).toContain('Identifiable');
    expect(names).toContain('getDisplayName');
    expect(names).toContain('greetUser');
    // imports-a.ts: createUser, getUserName
    expect(names).toContain('createUser');
    expect(names).toContain('getUserName');
    // imports-b.ts: processUser
    expect(names).toContain('processUser');
  });

  it('getNode retrieves by full ID', () => {
    const simplePath = resolve(fixtureDir, 'simple.ts');
    const node = graph.getNode(`${simplePath}::greet`);
    expect(node).toBeDefined();
    expect(node!.symbol.name).toBe('greet');
    expect(node!.symbol.kind).toBe('function');
  });

  it('findNodes finds by name substring', () => {
    const results = graph.findNodes('greet');
    const names = results.map(n => n.symbol.name);
    expect(names).toContain('greet');
    expect(names).toContain('greetUser');
  });

  it('getCallers returns caller edges', () => {
    const simplePath = resolve(fixtureDir, 'simple.ts');
    const greetId = `${simplePath}::greet`;
    const callers = graph.getCallers(greetId);
    // greet is called by farewell (in simple.ts) and greetUser (in classes.ts)
    expect(callers.length).toBeGreaterThanOrEqual(2);
    const callerIds = callers.map(e => e.from);
    expect(callerIds).toContain(`${simplePath}::farewell`);
    const classesPath = resolve(fixtureDir, 'classes.ts');
    expect(callerIds).toContain(`${classesPath}::greetUser`);
  });

  it('getCallees returns callee edges', () => {
    const simplePath = resolve(fixtureDir, 'simple.ts');
    const farewellId = `${simplePath}::farewell`;
    const callees = graph.getCallees(farewellId);
    // farewell calls greet
    expect(callees.length).toBeGreaterThanOrEqual(1);
    const calleeIds = callees.map(e => e.to);
    expect(calleeIds).toContain(`${simplePath}::greet`);
  });

  it('getDependencies upstream works', () => {
    const simplePath = resolve(fixtureDir, 'simple.ts');
    const farewellId = `${simplePath}::farewell`;
    const upstream = graph.getDependencies(farewellId, 'upstream');
    // farewell has outgoing edges (calls greet)
    expect(upstream.length).toBeGreaterThanOrEqual(1);
  });

  it('resolveSymbol resolves short name', () => {
    const simplePath = resolve(fixtureDir, 'simple.ts');
    // 'farewell' is unique, should resolve to full ID
    const resolved = graph.resolveSymbol('farewell');
    expect(resolved).toBe(`${simplePath}::farewell`);
  });

  it('resolveSymbol throws for unknown', () => {
    expect(() => graph.resolveSymbol('nonexistent')).toThrow(SymbolNotFoundError);
  });

  it('serialize/deserialize roundtrip', () => {
    const serialized = graph.serialize();
    const restored = CodeGraph.deserialize(serialized);
    const allOriginal = graph.getAllNodes();
    const allRestored = restored.getAllNodes();
    expect(allRestored.length).toBe(allOriginal.length);
    // Check a specific node survived the roundtrip
    const simplePath = resolve(fixtureDir, 'simple.ts');
    const node = restored.getNode(`${simplePath}::greet`);
    expect(node).toBeDefined();
    expect(node!.symbol.name).toBe('greet');
  });

  it('getMetrics returns correct metrics for a fixture function', () => {
    const simplePath = resolve(fixtureDir, 'simple.ts');
    const greetId = `${simplePath}::greet`;
    const metrics = graph.getMetrics(greetId);
    expect(metrics.lineCount).toBeGreaterThan(0);
    expect(metrics.complexity).toBeGreaterThanOrEqual(1);
    expect(metrics.callerCount).toBeGreaterThanOrEqual(2); // farewell + greetUser
    expect(metrics.calleeCount).toBe(0); // greet calls nothing
  });

  it('assertBuilt throws before build', () => {
    const freshGraph = new CodeGraph();
    expect(() => freshGraph.getAllNodes()).toThrow(GraphNotBuiltError);
    expect(() => freshGraph.getNode('anything')).toThrow(GraphNotBuiltError);
  });
});
