# Changelog

All notable changes to this project will be documented in this file.

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
