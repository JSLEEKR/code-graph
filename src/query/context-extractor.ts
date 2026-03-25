import { CodeGraph } from '../graph/code-graph.js';
import { estimateTokens, computeComplexity, computeSymbolMetrics } from '../graph/metrics.js';
import type {
  ContextOptions,
  ContextBundle,
  ImpactResult,
  SearchResult,
  DependencyChain,
  CodeStats,
  GraphNode,
  GraphEdge,
  SymbolMetrics,
} from '../types.js';
import { extname } from 'path';

export class ContextExtractor {
  constructor(private graph: CodeGraph) {}

  extract(target: string, options: ContextOptions): ContextBundle {
    const symbolId = this.graph.resolveSymbol(target);
    const targetNode = this.graph.getNode(symbolId)!;
    const budget = options.budget;

    const targetTokens = estimateTokens(targetNode.symbol.source);
    let remaining = budget - targetTokens;

    const included: GraphNode[] = [];
    const visited = new Set<string>();
    visited.add(symbolId);

    // BFS priority queue based on mode
    const queue: Array<{ id: string; priority: number }> = [];

    const addNeighbors = (nodeId: string) => {
      const callees = this.graph.getCallees(nodeId);
      const callers = this.graph.getCallers(nodeId);

      if (options.mode === 'debug') {
        // callees first (priority 3), then callers (priority 1)
        for (const e of callees) {
          if (!visited.has(e.to)) queue.push({ id: e.to, priority: 3 });
        }
        for (const e of callers) {
          if (!visited.has(e.from)) queue.push({ id: e.from, priority: 1 });
        }
      } else if (options.mode === 'refactor') {
        // callers first (priority 3), then callees (priority 1)
        for (const e of callers) {
          if (!visited.has(e.from)) queue.push({ id: e.from, priority: 3 });
        }
        for (const e of callees) {
          if (!visited.has(e.to)) queue.push({ id: e.to, priority: 1 });
        }
      } else {
        // review: callers+callees equal priority
        for (const e of callers) {
          if (!visited.has(e.from)) queue.push({ id: e.from, priority: 2 });
        }
        for (const e of callees) {
          if (!visited.has(e.to)) queue.push({ id: e.to, priority: 2 });
        }
      }

      // Sort by priority descending
      queue.sort((a, b) => b.priority - a.priority);
    };

    addNeighbors(symbolId);

    // BFS loop
    while (queue.length > 0) {
      const item = queue.shift()!;
      if (visited.has(item.id)) continue;

      const node = this.graph.getNode(item.id);
      if (!node) {
        visited.add(item.id);
        continue;
      }

      const tokens = estimateTokens(node.symbol.source);
      if (tokens <= remaining) {
        visited.add(item.id);
        included.push(node);
        remaining -= tokens;
        addNeighbors(item.id);
      } else {
        visited.add(item.id); // skip but mark visited
      }
    }

    // Count callers and callees in included set
    const includedIds = new Set(included.map(n => n.id));
    const callerCount = this.graph.getCallers(symbolId)
      .filter(e => includedIds.has(e.from)).length;
    const calleeCount = this.graph.getCallees(symbolId)
      .filter(e => includedIds.has(e.to)).length;

    const lineCount = targetNode.symbol.endLine - targetNode.symbol.startLine + 1;
    const parts = [`${targetNode.symbol.name} (${lineCount} lines)`];
    if (callerCount > 0) parts.push(`${callerCount} caller${callerCount > 1 ? 's' : ''}`);
    if (calleeCount > 0) parts.push(`${calleeCount} callee${calleeCount > 1 ? 's' : ''}`);
    const summary = parts.join(' + ');

    // Collect relevant edges
    const allNodeIds = new Set([symbolId, ...included.map(n => n.id)]);
    const relevantEdges: GraphEdge[] = [];

    // Get edges between included nodes using callers/callees
    for (const nid of allNodeIds) {
      const outEdges = this.graph.getCallees(nid);
      for (const edge of outEdges) {
        if (allNodeIds.has(edge.to) && !relevantEdges.some(e => e.id === edge.id)) {
          relevantEdges.push(edge);
        }
      }
    }

    return {
      target: targetNode.symbol,
      related: included.map(n => n.symbol),
      graph: {
        nodes: [...allNodeIds],
        edges: relevantEdges,
      },
      tokenCount: budget - remaining,
      budget,
      summary,
    };
  }

  impact(target: string): ImpactResult {
    const symbolId = this.graph.resolveSymbol(target);

    // Direct callers
    const directCallerEdges = this.graph.getCallers(symbolId);
    const directCallers = [...new Set(directCallerEdges.map(e => e.from))];

    // Transitive callers via BFS
    const visited = new Set<string>();
    visited.add(symbolId);
    for (const dc of directCallers) visited.add(dc);

    const transitiveCallers: string[] = [];
    const bfsQueue = [...directCallers];

    while (bfsQueue.length > 0) {
      const current = bfsQueue.shift()!;
      const callerEdges = this.graph.getCallers(current);
      for (const edge of callerEdges) {
        if (!visited.has(edge.from)) {
          visited.add(edge.from);
          transitiveCallers.push(edge.from);
          bfsQueue.push(edge.from);
        }
      }
    }

    // Affected files
    const allCallers = [...directCallers, ...transitiveCallers];
    const affectedFiles = [...new Set(
      allCallers.map(id => this.graph.getNode(id)?.symbol.filePath).filter((f): f is string => !!f)
    )];

    // Risk level based on direct caller count
    const directCount = directCallers.length;
    let riskLevel: 'low' | 'medium' | 'high';
    if (directCount <= 2) riskLevel = 'low';
    else if (directCount <= 10) riskLevel = 'medium';
    else riskLevel = 'high';

    return {
      target: symbolId,
      directCallers,
      transitiveCallers,
      affectedFiles,
      riskLevel,
    };
  }

  search(query: string): SearchResult[] {
    const allNodes = this.graph.getAllNodes();
    const results: SearchResult[] = [];

    for (const node of allNodes) {
      const name = node.symbol.name;
      let score = 0;

      if (name === query) {
        score = 1.0;
      } else if (name.startsWith(query)) {
        score = 0.8;
      } else if (name.includes(query)) {
        score = 0.5;
      } else {
        // Fuzzy match via Levenshtein distance
        const dist = levenshtein(name.toLowerCase(), query.toLowerCase());
        if (dist <= 2) {
          score = 0.3;
        } else {
          continue;
        }
      }

      results.push({
        symbolId: node.id,
        name: node.symbol.name,
        kind: node.symbol.kind,
        filePath: node.symbol.filePath,
        lineCount: node.symbol.endLine - node.symbol.startLine + 1,
        score,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  dependencies(target: string, direction: 'upstream' | 'downstream', maxDepth: number = 10): DependencyChain {
    const symbolId = this.graph.resolveSymbol(target);
    const visited = new Set<string>();
    visited.add(symbolId);

    const nodes: Array<{ symbolId: string; depth: number }> = [];
    const bfsQueue: Array<{ id: string; depth: number }> = [{ id: symbolId, depth: 0 }];

    while (bfsQueue.length > 0) {
      const { id, depth } = bfsQueue.shift()!;
      if (depth >= maxDepth) continue;

      let edges: GraphEdge[];
      if (direction === 'upstream') {
        edges = this.graph.getCallees(id);
      } else {
        edges = this.graph.getCallers(id);
      }

      for (const edge of edges) {
        const nextId = direction === 'upstream' ? edge.to : edge.from;
        if (!visited.has(nextId)) {
          visited.add(nextId);
          nodes.push({ symbolId: nextId, depth: depth + 1 });
          bfsQueue.push({ id: nextId, depth: depth + 1 });
        }
      }
    }

    return {
      target: symbolId,
      direction,
      nodes,
    };
  }

  stats(path?: string): CodeStats {
    const allNodes = this.graph.getAllNodes();
    const filteredNodes = path
      ? allNodes.filter(n => n.symbol.filePath.includes(path))
      : allNodes;

    // Count unique files
    const files = new Set(filteredNodes.map(n => n.symbol.filePath));

    // Count edges connected to filtered nodes
    const edgeSet = new Set<string>();
    for (const node of filteredNodes) {
      for (const eid of [...node.edges.in, ...node.edges.out]) {
        edgeSet.add(eid);
      }
    }

    // Group by language
    const byLanguage: Record<string, { files: number; symbols: number }> = {};
    const langFileMap: Record<string, Set<string>> = {};

    for (const node of filteredNodes) {
      const ext = extname(node.symbol.filePath);
      const lang = this.extToLang(ext);
      if (!byLanguage[lang]) {
        byLanguage[lang] = { files: 0, symbols: 0 };
        langFileMap[lang] = new Set();
      }
      byLanguage[lang].symbols++;
      langFileMap[lang].add(node.symbol.filePath);
    }

    for (const lang of Object.keys(byLanguage)) {
      byLanguage[lang].files = langFileMap[lang].size;
    }

    // Hotspots - top 10 by complexity
    const hotspots: Array<{ symbolId: string; metrics: SymbolMetrics }> = filteredNodes
      .map(node => {
        const callerCount = this.graph.getCallers(node.id).length;
        const calleeCount = this.graph.getCallees(node.id).length;
        const metrics = computeSymbolMetrics(node.symbol, callerCount, calleeCount);
        return { symbolId: node.id, metrics };
      })
      .sort((a, b) => b.metrics.complexity - a.metrics.complexity)
      .slice(0, 10);

    return {
      totalFiles: files.size,
      totalSymbols: filteredNodes.length,
      totalEdges: edgeSet.size,
      byLanguage,
      hotspots,
    };
  }

  extractFromDiff(diffFiles: string[], options: ContextOptions): ContextBundle {
    const allNodes = this.graph.getAllNodes();

    // Find all symbols in the changed files
    const changedSymbols = allNodes.filter(n =>
      diffFiles.some(f => n.symbol.filePath.endsWith(f) || f.endsWith(n.symbol.filePath) || n.symbol.filePath === f)
    );

    if (changedSymbols.length === 0) {
      // Return an empty-like bundle
      return {
        target: { id: '', name: '(no symbols in diff)', kind: 'function', filePath: '', startLine: 0, endLine: 0, source: '' },
        related: [],
        graph: { nodes: [], edges: [] },
        tokenCount: 0,
        budget: options.budget,
        summary: 'No symbols found in changed files',
      };
    }

    // Split the budget evenly among changed symbols
    const perSymbolBudget = Math.floor(options.budget / changedSymbols.length);

    const allRelated: typeof allNodes[0]['symbol'][] = [];
    const allGraphNodes = new Set<string>();
    const allGraphEdges: GraphEdge[] = [];
    let totalTokens = 0;

    // Use the first changed symbol as the "target"
    const primaryTarget = changedSymbols[0];
    allGraphNodes.add(primaryTarget.id);

    for (const node of changedSymbols) {
      const symbolBudget = Math.max(perSymbolBudget, 100);
      try {
        const bundle = this.extract(node.symbol.name, {
          ...options,
          budget: symbolBudget,
        });
        // Collect related symbols (avoid duplicates)
        for (const rel of bundle.related) {
          if (!allRelated.some(r => r.id === rel.id) && rel.id !== primaryTarget.symbol.id) {
            allRelated.push(rel);
          }
        }
        for (const nid of bundle.graph.nodes) allGraphNodes.add(nid);
        for (const edge of bundle.graph.edges) {
          if (!allGraphEdges.some(e => e.id === edge.id)) allGraphEdges.push(edge);
        }
        totalTokens += bundle.tokenCount;
      } catch {
        // Skip symbols that can't be resolved (ambiguous names)
        continue;
      }
    }

    // Add non-primary changed symbols to related
    for (const node of changedSymbols.slice(1)) {
      if (!allRelated.some(r => r.id === node.symbol.id)) {
        allRelated.push(node.symbol);
      }
      allGraphNodes.add(node.id);
    }

    const summary = `diff-context: ${changedSymbols.length} changed symbols across ${diffFiles.length} files`;

    return {
      target: primaryTarget.symbol,
      related: allRelated,
      graph: { nodes: [...allGraphNodes], edges: allGraphEdges },
      tokenCount: Math.min(totalTokens, options.budget),
      budget: options.budget,
      summary,
    };
  }

  formatContextAsText(bundle: ContextBundle): string {
    const lines: string[] = [];

    lines.push(`=== Context for: ${bundle.target.name} ===`);
    lines.push(`Budget: ${bundle.tokenCount}/${bundle.budget} tokens`);
    lines.push('');

    // Target
    lines.push('--- Target ---');
    const targetStartLine = bundle.target.startLine;
    const targetEndLine = bundle.target.endLine;
    lines.push(`// ${bundle.target.filePath}:${targetStartLine}-${targetEndLine}`);
    lines.push(bundle.target.source);
    lines.push('');

    // Related
    if (bundle.related.length > 0) {
      lines.push(`--- Related (${bundle.related.length} symbol${bundle.related.length > 1 ? 's' : ''}) ---`);
      for (const symbol of bundle.related) {
        lines.push(`// ${symbol.filePath}:${symbol.startLine}-${symbol.endLine}`);
        lines.push(symbol.source);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private extToLang(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
    };
    return map[ext] || ext;
  }
}

/** Standard Levenshtein distance (DP implementation) */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}
