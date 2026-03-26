# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-03-26 (Cycle 1: Rounds 1-10)

### Added
- **Requirements section** in README (Node >= 18, TypeScript 5.4+, Git)
- **engines field** in package.json (`node >= 18.0.0`)
- **Troubleshooting/FAQ** section with 6 common issues and solutions
- **CLI usage examples** covering all 8 commands with flags
- **Graph JSON format docs** for external tool interop
- **CI script** (`npm run ci` = tsc --noEmit + vitest run)
- **lint:types script** for standalone type checking
- **60 performance fixture files** with cross-file call chains
- **29 new tests** (95 total across 13 test suites):
  - Plugin registry (4), file scanner (3), exports (4)
  - Input validation / security (8), error recovery (4)
  - Performance (5), dependencies maxDepth (1)

### Changed
- Error messages now include actionable hints (GraphNotBuiltError, SymbolNotFoundError, PluginNotFoundError)
- Quick Start includes `npm run build` step

### Removed
- Unused `web-tree-sitter` dependency
- Dead code: duplicate `findMethodEnd` in TypeScriptPlugin (identical to `findBlockEnd`)
- Unused `computeComplexity` import in context-extractor

## [0.3.0] - 2026-03-25

### Added
- **Diff-based context extraction** -- `extractFromDiff(files, options)` extracts context for changed files, splits budget across symbols
- **CLI diff-context command** -- `code-graph diff-context <files...>` for PR/commit context
- **Levenshtein fuzzy search** -- search now returns fuzzy matches (edit distance <= 2) with score 0.3
- **Metrics in output** -- `context` command shows complexity/lines/callers/callees; `stats` shows full metrics for hotspots
- **Metrics in formatContextAsText** -- formatted output includes complexity and line count comments
- **Arrow function tests** -- TypeScript plugin tested with arrow functions and type alias extraction
- **Decorator/init tests** -- Python plugin tested with decorators and `__init__` method
- **Mixed-language test** -- CodeGraph tested with TypeScript + Python fixtures together
- **Edge case tests** -- empty graph, unknown symbol, non-existent diff files
- **66 tests** across 7 test suites (12 new tests)

## [0.2.0] - 2026-03-25

### Added
- **Package metadata** -- description, repository, keywords, and files fields in package.json
- **GitHub topics** -- typescript, code-analysis, ast, developer-tools, mcp, ai, context, code-graph, cli, refactoring
- **getMetrics method** -- `CodeGraph.getMetrics(symbolId)` returns complexity, caller/callee counts, line count, param count
- **formatContextAsText** -- `ContextExtractor.formatContextAsText(bundle)` formats context bundles as AI-ready text blocks
- **README improvements** -- "When to Use This" table, "Practical Tips", "How It Saves Tokens" comparison
- **5 new tests** -- getMetrics, hotspot sorting, small-budget extraction, formatContextAsText (2 tests)
- **54 tests** across 7 test suites

## [0.1.0] - 2026-03-25

### Added
- **TypeScript plugin** -- parse functions, classes, methods, interfaces, types, imports, and calls
- **Python plugin** -- parse functions, classes, methods, imports, and calls
- **Code graph engine** -- build dependency graphs with nodes (symbols) and edges (calls, imports)
- **File scanner** -- git-aware file discovery with recursive fallback
- **Context extractor** -- token-budget-constrained BFS with debug/refactor/review modes
- **Impact analysis** -- find direct and transitive callers, affected files, risk level
- **Symbol search** -- fuzzy name matching with relevance scoring
- **Dependency chains** -- upstream/downstream traversal with configurable depth
- **Codebase statistics** -- file/symbol/edge counts, language breakdown, complexity hotspots
- **Metrics** -- cyclomatic complexity estimation, token counting, symbol metrics
- **Cache manager** -- serialize/deserialize graph, incremental rebuild via mtime diffing
- **CLI** -- 7 commands: build, context, impact, search, deps, stats, serve
- **MCP server** -- 5 tools over stdio for AI agent integration (Claude Code compatible)
- **Plugin registry** -- extensible language support via `LanguagePlugin` interface
- **Integration tests** -- full pipeline test with TypeScript fixtures
- **49 tests** across 7 test suites
