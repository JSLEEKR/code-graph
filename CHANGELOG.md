# Changelog

All notable changes to this project will be documented in this file.

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
