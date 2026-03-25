import { readFileSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import type { GraphNode, GraphEdge, LanguagePlugin, ParseResult, ImportInfo, SymbolMetrics } from '../types.js';
import { GraphNotBuiltError, SymbolNotFoundError } from '../errors.js';
import { PluginRegistry } from '../plugins/plugin-registry.js';
import { scanFiles } from './file-scanner.js';
import { computeSymbolMetrics } from './metrics.js';

export class CodeGraph {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();
  private built = false;

  async build(rootDir: string, plugins: LanguagePlugin[]): Promise<void> {
    const registry = new PluginRegistry();
    for (const plugin of plugins) {
      registry.register(plugin);
    }

    // Collect all extensions from all plugins
    const extensions = plugins.flatMap(p => p.extensions);

    // Scan files
    const files = await scanFiles(rootDir, extensions);

    // Parse all files
    const parseResults: Array<{ filePath: string; result: ParseResult }> = [];

    for (const filePath of files) {
      const plugin = registry.getForFile(filePath);
      if (!plugin) continue;

      try {
        const source = readFileSync(filePath, 'utf-8');
        const result = plugin.parse(filePath, source);
        parseResults.push({ filePath, result });
      } catch (err) {
        // Log warning, skip file
        console.warn(`Warning: failed to parse ${filePath}: ${err}`);
      }
    }

    // Create GraphNodes from all symbols
    for (const { result } of parseResults) {
      for (const symbol of result.symbols) {
        const node: GraphNode = {
          id: symbol.id,
          symbol,
          edges: { in: [], out: [] },
        };
        this.nodes.set(symbol.id, node);
      }
    }

    // Build a lookup: name -> symbol IDs (for resolving calls)
    const nameToIds = new Map<string, string[]>();
    for (const [id, node] of this.nodes) {
      const name = node.symbol.name;
      if (!nameToIds.has(name)) nameToIds.set(name, []);
      nameToIds.get(name)!.push(id);
    }

    // Collect all imports for resolving cross-file calls
    const allImports: ImportInfo[] = parseResults.flatMap(pr => pr.result.imports);

    let edgeCounter = 0;

    // Create edges from imports
    for (const imp of allImports) {
      const fromFile = imp.fromFile;
      // Resolve the target module path
      const resolvedModule = this.resolveModulePath(fromFile, imp.toModule);

      for (const symName of imp.symbols) {
        // Find the source symbol in the target module
        const targetId = `${resolvedModule}::${symName}`;
        if (!this.nodes.has(targetId)) continue;

        // Find a symbol in fromFile that would be the importer
        // For import edges, use the file-level connection
        const fromSymbols = [...this.nodes.values()].filter(
          n => n.symbol.filePath === fromFile
        );

        for (const fromNode of fromSymbols) {
          // Only create import edge for symbols that actually reference the imported name
          // For simplicity, create one import edge per file
          break;
        }

        // Create a single import edge from the importing file's first symbol
        if (fromSymbols.length > 0) {
          const edgeId = `edge-${++edgeCounter}`;
          const edge: GraphEdge = {
            id: edgeId,
            type: 'imports',
            from: fromSymbols[0].id,
            to: targetId,
            filePath: fromFile,
            line: 1,
          };
          this.edges.set(edgeId, edge);
          fromSymbols[0].edges.out.push(edgeId);
          this.nodes.get(targetId)!.edges.in.push(edgeId);
        }
      }
    }

    // Create edges from calls
    for (const { filePath, result } of parseResults) {
      for (const call of result.calls) {
        const targetId = this.resolveCallee(
          call.calleeName,
          filePath,
          nameToIds,
          allImports,
        );
        if (!targetId) continue;
        // Avoid self-edges
        if (call.callerSymbol === targetId) continue;

        const edgeId = `edge-${++edgeCounter}`;
        const edge: GraphEdge = {
          id: edgeId,
          type: 'calls',
          from: call.callerSymbol,
          to: targetId,
          filePath: call.filePath,
          line: call.line,
        };
        this.edges.set(edgeId, edge);

        const callerNode = this.nodes.get(call.callerSymbol);
        if (callerNode) callerNode.edges.out.push(edgeId);
        const calleeNode = this.nodes.get(targetId);
        if (calleeNode) calleeNode.edges.in.push(edgeId);
      }
    }

    this.built = true;
  }

  private resolveCallee(
    calleeName: string,
    filePath: string,
    nameToIds: Map<string, string[]>,
    allImports: ImportInfo[],
  ): string | undefined {
    const candidates = nameToIds.get(calleeName);
    if (!candidates || candidates.length === 0) return undefined;

    // 1. Look in same file first
    const sameFile = candidates.find(id => {
      const node = this.nodes.get(id);
      return node && node.symbol.filePath === filePath;
    });
    if (sameFile) return sameFile;

    // 2. Check imports of this file
    const fileImports = allImports.filter(imp => imp.fromFile === filePath);
    for (const imp of fileImports) {
      if (imp.symbols.includes(calleeName)) {
        const resolvedModule = this.resolveModulePath(filePath, imp.toModule);
        const targetId = `${resolvedModule}::${calleeName}`;
        if (this.nodes.has(targetId)) return targetId;
      }
    }

    // 3. Not found - skip
    return undefined;
  }

  private resolveModulePath(fromFile: string, toModule: string): string {
    if (toModule.startsWith('.')) {
      const dir = dirname(fromFile);
      let resolved = resolve(dir, toModule);
      // Add .ts extension if not present
      if (!extname(resolved)) {
        resolved += '.ts';
      }
      return resolved;
    }
    return toModule;
  }

  assertBuilt(): void {
    if (!this.built) throw new GraphNotBuiltError();
  }

  getNode(symbolId: string): GraphNode | undefined {
    this.assertBuilt();
    return this.nodes.get(symbolId);
  }

  findNodes(query: string): GraphNode[] {
    this.assertBuilt();
    const lower = query.toLowerCase();
    return [...this.nodes.values()].filter(n =>
      n.symbol.name.toLowerCase().includes(lower)
    );
  }

  getAllNodes(): GraphNode[] {
    this.assertBuilt();
    return [...this.nodes.values()];
  }

  getCallers(symbolId: string): GraphEdge[] {
    this.assertBuilt();
    return [...this.edges.values()].filter(e => e.to === symbolId && e.type === 'calls');
  }

  getCallees(symbolId: string): GraphEdge[] {
    this.assertBuilt();
    return [...this.edges.values()].filter(e => e.from === symbolId && e.type === 'calls');
  }

  getDependencies(symbolId: string, direction: 'upstream' | 'downstream'): GraphEdge[] {
    this.assertBuilt();
    if (direction === 'upstream') {
      return [...this.edges.values()].filter(e => e.from === symbolId);
    }
    return [...this.edges.values()].filter(e => e.to === symbolId);
  }

  resolveSymbol(shortName: string): string {
    this.assertBuilt();
    // If it's already a full ID
    if (this.nodes.has(shortName)) return shortName;
    // Search by name or class.method
    const matches = [...this.nodes.values()].filter(n => {
      if (n.symbol.name === shortName) return true;
      // Match Class.method pattern
      if (shortName.includes('.')) {
        const parent = n.symbol.parentSymbol;
        if (parent) {
          const parentNode = this.nodes.get(parent);
          if (parentNode && `${parentNode.symbol.name}.${n.symbol.name}` === shortName) return true;
        }
      }
      return false;
    });
    if (matches.length === 0) throw new SymbolNotFoundError(shortName);
    if (matches.length === 1) return matches[0].id;
    // Multiple matches - throw with candidates
    throw new SymbolNotFoundError(`${shortName} (ambiguous: ${matches.map(m => m.id).join(', ')})`);
  }

  getMetrics(symbolId: string): SymbolMetrics {
    this.assertBuilt();
    const node = this.nodes.get(symbolId);
    if (!node) throw new SymbolNotFoundError(symbolId);
    const callerCount = this.getCallers(symbolId).length;
    const calleeCount = this.getCallees(symbolId).length;
    return computeSymbolMetrics(node.symbol, callerCount, calleeCount);
  }

  serialize(): string {
    return JSON.stringify({
      nodes: Object.fromEntries(this.nodes),
      edges: Object.fromEntries(this.edges),
    });
  }

  static deserialize(data: string): CodeGraph {
    const parsed = JSON.parse(data);
    const graph = new CodeGraph();
    graph.nodes = new Map(Object.entries(parsed.nodes));
    graph.edges = new Map(Object.entries(parsed.edges));
    graph.built = true;
    return graph;
  }
}
