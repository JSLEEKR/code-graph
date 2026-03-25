#!/usr/bin/env node
import { Command } from 'commander';
import { CodeGraph } from '../graph/code-graph.js';
import { ContextExtractor } from '../query/context-extractor.js';
import { TypeScriptPlugin } from '../plugins/typescript.js';
import { PythonPlugin } from '../plugins/python.js';
import { CacheManager } from '../cache/cache-manager.js';
import * as path from 'node:path';

const program = new Command();
program.name('code-graph').description('Code graph engine for AI context extraction').version('0.1.0');

// Helper: build or load cached graph
async function getGraph(rootDir: string): Promise<CodeGraph> {
  const cacheDir = path.join(rootDir, '.code-graph');
  const cache = new CacheManager(cacheDir);
  const cached = await cache.load();
  if (cached) {
    console.log('Loaded graph from cache.');
    return cached.graph;
  }
  console.log('Building graph...');
  const graph = new CodeGraph();
  await graph.build(rootDir, [new TypeScriptPlugin(), new PythonPlugin()]);
  await cache.save(graph, new Map());
  console.log('Graph built and cached.');
  return graph;
}

// build
program.command('build')
  .option('--root <path>', 'Root directory', '.')
  .action(async (opts) => {
    const rootDir = path.resolve(opts.root);
    const graph = new CodeGraph();
    await graph.build(rootDir, [new TypeScriptPlugin(), new PythonPlugin()]);
    const cacheDir = path.join(rootDir, '.code-graph');
    const cache = new CacheManager(cacheDir);
    await cache.save(graph, new Map());
    const nodes = graph.getAllNodes();
    console.log(`Built graph: ${nodes.length} symbols`);
  });

// context
program.command('context')
  .argument('<target>')
  .option('--budget <n>', 'Token budget', '2000')
  .option('--mode <mode>', 'Context mode', 'debug')
  .action(async (target, opts) => {
    const graph = await getGraph(process.cwd());
    const extractor = new ContextExtractor(graph);
    const ctx = extractor.extract(target, { budget: parseInt(opts.budget), mode: opts.mode });
    console.log(`\n${ctx.summary}`);
    console.log(`\nTokens: ${ctx.tokenCount} / ${ctx.budget}`);
    console.log(`\nTarget: ${ctx.target.name} (${ctx.target.filePath}:${ctx.target.startLine})`);
    console.log(`Related: ${ctx.related.length} symbols`);
    for (const r of ctx.related) {
      console.log(`  - ${r.name} (${r.kind}, ${r.filePath}:${r.startLine})`);
    }
  });

// impact
program.command('impact')
  .argument('<target>')
  .action(async (target) => {
    const graph = await getGraph(process.cwd());
    const extractor = new ContextExtractor(graph);
    const result = extractor.impact(target);
    console.log(`Impact analysis: ${target}`);
    console.log(`Risk level: ${result.riskLevel}`);
    console.log(`Direct callers: ${result.directCallers.length}`);
    for (const c of result.directCallers) console.log(`  - ${c}`);
    console.log(`Transitive callers: ${result.transitiveCallers.length}`);
    console.log(`Affected files: ${result.affectedFiles.length}`);
  });

// search
program.command('search')
  .argument('<query>')
  .action(async (query) => {
    const graph = await getGraph(process.cwd());
    const extractor = new ContextExtractor(graph);
    const results = extractor.search(query);
    if (results.length === 0) { console.log('No symbols found.'); return; }
    for (const r of results) {
      console.log(`${r.name} (${r.kind}) - ${r.filePath} [score: ${r.score.toFixed(1)}]`);
    }
  });

// deps
program.command('deps')
  .argument('<target>')
  .option('--direction <dir>', 'upstream or downstream', 'downstream')
  .action(async (target, opts) => {
    const graph = await getGraph(process.cwd());
    const extractor = new ContextExtractor(graph);
    const chain = extractor.dependencies(target, opts.direction);
    console.log(`Dependencies (${chain.direction}): ${target}`);
    for (const n of chain.nodes) {
      console.log(`${'  '.repeat(n.depth)}${n.symbolId}`);
    }
  });

// stats
program.command('stats')
  .option('--path <dir>', 'Directory', '.')
  .action(async (opts) => {
    const graph = await getGraph(path.resolve(opts.path));
    const extractor = new ContextExtractor(graph);
    const s = extractor.stats();
    console.log(`Files: ${s.totalFiles}`);
    console.log(`Symbols: ${s.totalSymbols}`);
    console.log(`Edges: ${s.totalEdges}`);
    console.log('By language:');
    for (const [lang, data] of Object.entries(s.byLanguage)) {
      console.log(`  ${lang}: ${data.files} files, ${data.symbols} symbols`);
    }
    if (s.hotspots.length > 0) {
      console.log('Hotspots (highest complexity):');
      for (const h of s.hotspots.slice(0, 5)) {
        console.log(`  ${h.symbolId} (complexity: ${h.metrics.complexity})`);
      }
    }
  });

// serve — MCP server over stdio
program.command('serve')
  .description('Start MCP server for AI agent integration')
  .action(async () => {
    const { startMCPServer } = await import('../mcp/server.js');
    await startMCPServer();
  });

program.parse();
