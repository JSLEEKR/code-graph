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
Your Codebase                 code-graph                         AI Tool
━━━━━━━━━━━━━                ━━━━━━━━━━                        ━━━━━━━

src/
├── user.ts     ──►  [1] File Scan (git ls-files)
├── auth.ts           │
├── db.ts             ▼
└── types.ts    ──►  [2] Language Plugins (regex parsing)
                      │   Extract: symbols, imports, calls
                      ▼
                 [3] Graph Build
                      │   Nodes: functions, classes, types
                      │   Edges: who calls what, who imports what
                      ▼
                 [4] Cache (.code-graph/cache.json)
                      │   Next build: only re-parse changed files
                      ▼
                 [5] Query Engine (budget BFS)    ◄── "debug getProfile"
                      │   Priority queue by mode
                      │   Stop when budget exhausted
                      ▼
                 [6] Context Bundle              ──►  38 lines, 225 tokens
                      (target + related symbols)       (not 950 lines, 4000 tokens)
```

### Deep Dive: The 6 Steps

#### Step 1: File Scanning

```bash
# Inside a git repo: respects .gitignore automatically
git ls-files --full-name

# Fallback: recursive scan, excluding:
# node_modules, dist, .git, __pycache__, .code-graph
```

#### Step 2: Language Plugin Parsing

Each file is parsed by a language-specific plugin that extracts three things:

**Symbols** -- functions, classes, methods, interfaces, types:
```typescript
// Input: src/user.ts
export class UserService {
  async getProfile(userId: string): Promise<Profile> {
    const user = await this.findUser(userId);
    return buildProfile(user);
  }
}

// Extracted symbols:
// { id: "src/user.ts::UserService", kind: "class", lines: 1-7 }
// { id: "src/user.ts::UserService.getProfile", kind: "method", lines: 2-5,
//   parentSymbol: "src/user.ts::UserService", params: ["userId"] }
```

**Imports** -- which file imports what from where:
```typescript
// import { User, Profile } from './types'
// → { fromFile: "src/user.ts", toModule: "./types", symbols: ["User", "Profile"] }
```

**Calls** -- which function calls which:
```typescript
// Inside getProfile:  this.findUser(userId)  and  buildProfile(user)
// → { caller: "UserService.getProfile", callee: "findUser" }
// → { caller: "UserService.getProfile", callee: "buildProfile" }
```

The parser uses brace counting (TypeScript) or indentation detection (Python) to find where each block starts and ends:

```
function greet(name) {    ← brace count: 1
  if (name) {             ← brace count: 2
    return `Hi ${name}`;
  }                       ← brace count: 1
}                         ← brace count: 0 → block ends here
```

#### Step 3: Graph Construction

All parsed results are merged into one graph. The critical step is **resolving call targets**:

```
"getProfile calls findUser" -- but which findUser?

Resolution order:
  1. Same file?     → src/user.ts has findUser? → Yes → resolved!
  2. Imported file?  → src/user.ts imports from './db' which has findUser? → resolved!
  3. Neither?        → External library, skip (not our code)
```

The result is a graph like:

```
  getProfile ──calls──► findUser        (cross-file, resolved via import)
  getProfile ──calls──► buildProfile    (same file)
  farewell   ──calls──► greet           (same file)
  greetUser  ──calls──► greet           (cross-file, resolved via import)
```

#### Step 4: Caching

The graph is serialized to `.code-graph/cache.json` with file modification times. On the next build, only files with changed mtimes are re-parsed. Unchanged files reuse their cached parse results.

#### Step 5: Budget-Based BFS (The Core Algorithm)

This is what makes code-graph unique. When you ask for context:

```
extract("getProfile", { budget: 2000, mode: "debug" })
```

The algorithm runs a priority-based BFS:

```
Step 1: Include target
  ┌────────────────────────────────────────┐
  │ getProfile: 80 chars → 20 tokens       │
  │ Budget remaining: 2000 - 20 = 1980     │
  └────────────────────────────────────────┘

Step 2: Add neighbors to priority queue (debug mode)
  Queue (sorted by priority):
    findUser      (callee → 1st priority in debug mode)
    buildProfile  (callee → 1st priority)
    Profile       (type   → 2nd priority)
    AuthController(caller → 3rd priority)

Step 3: Process queue
  findUser:       160 chars → 40 tokens  │ 1980-40=1940  ✓ Include!
  buildProfile:   200 chars → 50 tokens  │ 1940-50=1890  ✓ Include!
  Profile:         60 chars → 15 tokens  │ 1890-15=1875  ✓ Include!
  AuthController: 400 chars → 100 tokens │ 1875-100=1775 ✓ Include!
  ...continue until budget exhausted or queue empty...

Step 4: Result
  ContextBundle {
    target: getProfile (20 tokens)
    related: [findUser, buildProfile, Profile, AuthController]
    tokenCount: 225 / 2000
    summary: "getProfile (4 lines) + 2 callees + 1 type + 1 caller"
  }
```

**Why modes matter:**

```
debug mode:                          refactor mode:
  "Error in getProfile --             "Changing getProfile --
   what does it call?"                 who will break?"

  Priority: callees FIRST             Priority: callers FIRST
  → findUser, buildProfile            → AuthController, APIHandler
  → then types                        → then types
  → then callers (if budget left)     → then callees (if budget left)
```

#### Step 6: Output

The context bundle can be output as:
- **JSON** -- for programmatic use and MCP server responses
- **Formatted text** -- for CLI and direct AI prompting:

```
=== Context for: getProfile ===
Budget: 225/2000 tokens

--- Target ---
// src/user.ts:2-5 | complexity=3, lines=4, params=1
async getProfile(userId: string): Promise<Profile> {
    const user = await this.findUser(userId);
    return buildProfile(user);
}

--- Related (3 symbols) ---
// src/db.ts:10-20
function findUser(id: string): User { ... }

// src/types.ts:5-8
interface Profile { id: string; name: string; }

// src/utils.ts:15-25
function buildProfile(user: User): Profile { ... }
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

Traditional AI coding tools read files one by one, hoping to find relevant code:

```
Traditional AI tool:                        code-graph:

"Debug getProfile error"                    "Debug getProfile error"
  → Read user.ts     (200 lines)              → get_context("getProfile", debug)
  → Read db.ts       (300 lines)              → 38 lines, exactly what's needed
  → Read types.ts    (150 lines)              → Done.
  → Read auth.ts     (200 lines)
  → "Maybe this?" utils.ts (100 lines)

  Total: ~950 lines, ~4000 tokens             Total: 38 lines, ~225 tokens
  Relevant: ~10%                              Relevant: 100%
  Savings: -                                  Savings: 94%
```

| Scenario | Without code-graph | With code-graph | Savings |
|----------|-------------------|-----------------|---------|
| Debug a function | ~4,000 tokens (read 5 files) | ~225 tokens (subgraph) | **94%** |
| Refactor a method | ~3,000 tokens (read 4 files) | ~400 tokens (callers+types) | **87%** |
| PR review (50-line diff) | ~5,000 tokens (diff + context files) | ~600 tokens (diff subgraph) | **88%** |

The key insight: **static analysis (local, free) determines what to send, AI only processes what matters.**

## Requirements

- **Node.js** >= 18.0.0
- **TypeScript** >= 5.4 (for development/building from source)
- **Git** (optional, for automatic `.gitignore`-aware file scanning)

## Quick Start

```bash
# Install
npm install code-graph

# Build the TypeScript source (required before first use)
npm run build

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

## Troubleshooting / FAQ

**Q: `GraphNotBuiltError: Graph not built. Run build() first.`**
A: You need to build the code graph before querying. Run `npx code-graph build --root .` or call `graph.build()` in the API.

**Q: `SymbolNotFoundError: Symbol not found: "myFunc"`**
A: The symbol may not exist or may have a different name. Use `npx code-graph search myFunc` to find similar symbols. If you just added the file, rebuild with `npx code-graph build`.

**Q: Build is slow on a large codebase**
A: The first build parses all files. Subsequent builds use incremental caching (only re-parse changed files). The cache is stored in `.code-graph/cache.json`.

**Q: Can I use code-graph with JavaScript files?**
A: The TypeScript plugin handles `.ts` and `.tsx` files. Plain `.js/.jsx` files are not supported yet, but you can implement a custom `LanguagePlugin`.

**Q: How do I reset the cache?**
A: Delete the `.code-graph/` directory, or use `CacheManager.clear()` in the API.

**Q: MCP server does not start**
A: Ensure you have built the project first (`npm run build`). The MCP server requires the compiled `dist/` output. Check that `@modelcontextprotocol/sdk` is installed.

### CLI Usage Examples

```bash
# Build graph for the current directory
npx code-graph build

# Build graph for a specific directory
npx code-graph build --root ./src

# Extract context in debug mode (traces callees)
npx code-graph context handleRequest --budget 1000 --mode debug

# Extract context in refactor mode (traces callers)
npx code-graph context validateInput --budget 2000 --mode refactor

# Impact analysis -- find what breaks if you change a function
npx code-graph impact validateInput

# Search for symbols by name (supports fuzzy matching)
npx code-graph search user

# Show dependency chain (upstream = what it calls)
npx code-graph deps processUser --direction upstream

# Show dependency chain (downstream = what calls it)
npx code-graph deps greet --direction downstream

# Get codebase statistics and complexity hotspots
npx code-graph stats

# Extract context for files changed in a diff
npx code-graph diff-context src/api.ts src/util.ts --budget 3000

# Start MCP server for AI agent integration
npx code-graph serve
```

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
