<div align="center">

# code-graph

**Smart context extraction for AI coding tools**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-66%20passing-brightgreen.svg)](#testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Extract exactly the code context an AI needs -- nothing more, nothing less.
Build a code graph, query with a token budget, get precise results.

</div>

## Why

AI coding tools waste tokens by reading entire files when they only need a few functions. A 500-line file might contain one relevant function and its two callees -- that's 30 lines, not 500.

**code-graph** builds a dependency graph of your codebase and uses BFS with a token budget to extract only the symbols that matter for a given task.

## How It Works

```
                         +-----------+
  Your Codebase -------> |  Plugins  | -------> Parse symbols, imports, calls
  (.ts, .py files)       +-----------+
                              |
                              v
                        +------------+
                        | Code Graph | -------> Nodes (functions, classes, methods)
                        +------------+          Edges (calls, imports)
                              |
                              v
                      +----------------+
  Query: "farewell"   |    Context     |
  Budget: 500 tokens  |   Extractor    | -------> Minimal context bundle
  Mode: debug         +----------------+          (target + related symbols)
```

## Features

| Feature | Description |
|---------|-------------|
| **Token-budgeted context** | BFS traversal stops when budget is reached |
| **Context modes** | `debug`, `refactor`, `review` -- each prioritizes differently |
| **Impact analysis** | Find all callers affected by changing a symbol |
| **Cross-file resolution** | Follows imports across file boundaries |
| **Symbol search** | Fuzzy name matching with Levenshtein distance scoring |
| **Diff-based context** | Extract context for changed files in a diff |
| **Dependency chains** | Trace upstream/downstream dependencies |
| **Codebase stats** | File counts, symbol counts, complexity hotspots with full metrics |
| **Incremental caching** | Rebuild only changed files |
| **Plugin system** | Add language support via plugins |
| **MCP server** | Integrate directly with Claude Code and AI agents |
| **Metrics in output** | Complexity, line count, callers/callees shown in context and stats |
| **CLI** | 8 commands for terminal workflows |

## When to Use This

| Scenario | What You Do | What code-graph Does |
|----------|-------------|---------------------|
| **Debugging** | `context handleRequest --mode debug` | Traces callees to find where bugs propagate |
| **Refactoring** | `context validateInput --mode refactor` | Finds all callers that need updating |
| **PR Review** | `context processOrder --mode review` | Balanced view of callers and callees |
| **QA / Impact** | `impact validateInput` | Shows risk level and all affected files |

## Practical Tips

| Tip | Details |
|-----|---------|
| Start with small budgets | Use `--budget 500` first, increase if you need more context |
| Use `stats` to find hotspots | High-complexity symbols are good refactoring targets |
| Chain commands | Run `impact` first to find risky symbols, then `context` for details |
| Cache your graph | `build` once, query many times -- the cache handles incremental updates |
| Use MCP for AI workflows | Connect to Claude Code for automatic context extraction |

## How It Saves Tokens

Traditional approach: send entire files to AI, wasting tokens on irrelevant code.

| Approach | Tokens Sent | Relevant Code |
|----------|-------------|---------------|
| **Whole file** | ~2,000 | 1 function out of 20 |
| **code-graph (budget: 500)** | ~487 | Target + 2 related symbols |
| **Savings** | **75% fewer tokens** | **100% relevant** |

With `code-graph`, a 500-token budget extracts only the target function and its direct dependencies -- exactly what the AI needs to understand the context.

## Quick Start

```bash
# Install
npm install code-graph

# Build a graph of your project
npx code-graph build --root ./my-project

# Extract context for a function (500 token budget, debug mode)
npx code-graph context handleRequest --budget 500 --mode debug

# See what breaks if you change a function
npx code-graph impact handleRequest
```

### Programmatic API

```typescript
import { CodeGraph, ContextExtractor, TypeScriptPlugin } from 'code-graph';

// Build the graph
const graph = new CodeGraph();
await graph.build('./src', [new TypeScriptPlugin()]);

// Extract context
const extractor = new ContextExtractor(graph);
const ctx = extractor.extract('handleRequest', {
  budget: 2000,
  mode: 'debug',
});

console.log(ctx.summary);    // "handleRequest (15 lines) + 2 callees"
console.log(ctx.tokenCount); // 487
console.log(ctx.related);    // [validateInput, formatResponse]

// Impact analysis
const impact = extractor.impact('validateInput');
console.log(impact.riskLevel);      // "medium"
console.log(impact.directCallers);  // ["handleRequest", "processForm"]
console.log(impact.affectedFiles);  // ["src/api.ts", "src/form.ts"]
```

## Language Support

| Language | Plugin | Symbols | Imports | Calls |
|----------|--------|---------|---------|-------|
| TypeScript/TSX | `TypeScriptPlugin` | functions, classes, methods, interfaces, types | named imports | function/method calls |
| Python | `PythonPlugin` | functions, classes, methods | `import` / `from...import` | function/method calls |

### Adding a Plugin

Implement the `LanguagePlugin` interface:

```typescript
interface LanguagePlugin {
  name: string;
  extensions: string[];  // e.g. ['.rs', '.go']
  parse(filePath: string, source: string): ParseResult;
}
```

## CLI

```bash
code-graph <command> [options]
```

| Command | Description | Example |
|---------|-------------|---------|
| `build` | Build and cache the code graph | `code-graph build --root ./src` |
| `context` | Extract token-budgeted context | `code-graph context myFunc --budget 1000 --mode refactor` |
| `impact` | Analyze change impact | `code-graph impact MyClass` |
| `search` | Search symbols by name | `code-graph search handle` |
| `deps` | Show dependency chain | `code-graph deps myFunc --direction upstream` |
| `stats` | Show codebase statistics | `code-graph stats --path ./src` |
| `diff-context` | Context for changed files | `code-graph diff-context src/api.ts src/util.ts` |
| `serve` | Start MCP server (stdio) | `code-graph serve` |

## MCP Server

The MCP server exposes 5 tools for AI agent integration over stdio:

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_context` | Extract token-budgeted context | `target`, `budget?`, `mode?` |
| `get_impact` | Analyze change impact | `target` |
| `search_symbols` | Search symbols by name | `query` |
| `get_dependencies` | Get dependency chain | `target`, `direction` |
| `get_stats` | Get codebase statistics | `path?` |

### Claude Code Integration

Add to your `.claude/settings.json`:

```json
{
  "mcpServers": {
    "code-graph": {
      "command": "npx",
      "args": ["code-graph", "serve"]
    }
  }
}
```

## Context Modes

Each mode changes BFS traversal priority:

| Mode | Callees Priority | Callers Priority | Use Case |
|------|-----------------|-----------------|----------|
| `debug` | 3 (high) | 1 (low) | Trace what a function calls to find bugs |
| `refactor` | 1 (low) | 3 (high) | Find all callers that need updating |
| `review` | 2 (equal) | 2 (equal) | Balanced view for code review |

## Token Budget

The extractor uses priority-based BFS to fill a token budget:

1. Start with the target symbol -- its tokens are always included
2. Add neighbors to a priority queue (ordered by context mode)
3. Dequeue the highest-priority neighbor
4. If it fits in remaining budget, include it and enqueue its neighbors
5. If it doesn't fit, skip it
6. Repeat until queue is empty or budget is exhausted

Token estimation: `ceil(source.length / 4)` (approximates GPT tokenization).

## Impact Analysis

```typescript
const impact = extractor.impact('greet');
// {
//   target: 'src/utils.ts::greet',
//   directCallers: ['src/api.ts::farewell'],
//   transitiveCallers: ['src/main.ts::processUser'],
//   affectedFiles: ['src/api.ts', 'src/main.ts'],
//   riskLevel: 'low'   // low: 0-2, medium: 3-10, high: 11+
// }
```

## Search & Dependencies

```typescript
// Search symbols
const results = extractor.search('user');
// [{ name: 'User', kind: 'class', score: 0.5 }, ...]

// Dependency chain (upstream = what it calls, downstream = what calls it)
const deps = extractor.dependencies('processUser', 'upstream');
// { nodes: [{ symbolId: 'createUser', depth: 1 }, { symbolId: 'User', depth: 2 }] }
```

## Caching

The `CacheManager` serializes the graph to `.code-graph/cache.json`:

```typescript
import { CacheManager } from 'code-graph';

const cache = new CacheManager('./.code-graph');
await cache.save(graph, fileMtimes);

// Later: load from cache
const cached = await cache.load();
if (cached) {
  const { graph, fileMtimes } = cached;
  // Check for changes
  const changed = await cache.getChangedFiles(currentMtimes, fileMtimes);
}
```

## API Reference

### CodeGraph

| Method | Returns | Description |
|--------|---------|-------------|
| `build(rootDir, plugins)` | `Promise<void>` | Parse files and build the graph |
| `getNode(symbolId)` | `GraphNode \| undefined` | Get a node by full ID |
| `findNodes(query)` | `GraphNode[]` | Find nodes by name substring |
| `getAllNodes()` | `GraphNode[]` | Get all nodes |
| `getCallers(symbolId)` | `GraphEdge[]` | Get incoming call edges |
| `getCallees(symbolId)` | `GraphEdge[]` | Get outgoing call edges |
| `getDependencies(id, dir)` | `GraphEdge[]` | Get all edges in a direction |
| `resolveSymbol(name)` | `string` | Resolve short name to full symbol ID |
| `serialize()` | `string` | Serialize graph to JSON |
| `deserialize(data)` | `CodeGraph` | Static: restore from JSON |

### ContextExtractor

| Method | Returns | Description |
|--------|---------|-------------|
| `extract(target, options)` | `ContextBundle` | Budget-constrained context extraction |
| `extractFromDiff(files, options)` | `ContextBundle` | Diff-based context for changed files |
| `impact(target)` | `ImpactResult` | Change impact analysis |
| `search(query)` | `SearchResult[]` | Symbol search with Levenshtein fuzzy matching |
| `dependencies(target, dir, depth?)` | `DependencyChain` | Dependency chain traversal |
| `stats(path?)` | `CodeStats` | Codebase statistics |
| `formatContextAsText(bundle)` | `string` | Format context bundle with metrics |

### CacheManager

| Method | Returns | Description |
|--------|---------|-------------|
| `save(graph, mtimes)` | `Promise<void>` | Save graph to disk |
| `load()` | `Promise<{graph, mtimes} \| null>` | Load cached graph |
| `getChangedFiles(cur, saved)` | `Promise<string[]>` | Diff file modification times |
| `clear()` | `Promise<void>` | Delete cache directory |

## Testing

```bash
npm test
```

66 tests across 7 test suites:
- TypeScript plugin (9 tests) -- arrow functions, type aliases, imports, calls
- Python plugin (6 tests) -- decorators, __init__ method, class methods
- Code graph engine (12 tests) -- mixed TypeScript + Python support
- Metrics (4 tests) -- complexity, token estimation, symbol metrics
- Cache manager (5 tests) -- save, load, changed files, clear
- Context extractor (26 tests) -- diff-context, fuzzy search, metrics output, edge cases
- Integration: full pipeline (4 tests)

## License

[MIT](LICENSE) -- JSLEEKR 2026
