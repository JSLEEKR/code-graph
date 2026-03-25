// Language Plugin
export interface LanguagePlugin {
  name: string;
  extensions: string[];
  parse(filePath: string, source: string): ParseResult;
}

export interface ParseResult {
  symbols: SymbolNode[];
  imports: ImportInfo[];
  calls: CallInfo[];
}

export interface SymbolNode {
  id: string;
  name: string;
  kind: 'function' | 'method' | 'class' | 'interface' | 'type';
  filePath: string;
  startLine: number;
  endLine: number;
  source: string;
  parentSymbol?: string;
  params?: string[];
  returnType?: string;
}

export interface ImportInfo {
  fromFile: string;
  toModule: string;
  symbols: string[];
}

export interface CallInfo {
  callerSymbol: string;
  calleeName: string;
  filePath: string;
  line: number;
}

// Graph
export interface GraphNode {
  id: string;
  symbol: SymbolNode;
  edges: { in: string[]; out: string[] };
}

export interface GraphEdge {
  id: string;
  type: 'calls' | 'imports' | 'implements' | 'type_ref';
  from: string;
  to: string;
  filePath: string;
  line: number;
}

export interface SymbolMetrics {
  lineCount: number;
  paramCount: number;
  callerCount: number;
  calleeCount: number;
  complexity: number;
}

// Query
export interface ContextOptions {
  budget: number;
  mode: 'debug' | 'refactor' | 'review';
  includeTests?: boolean;
}

export interface ContextBundle {
  target: SymbolNode;
  related: SymbolNode[];
  graph: { nodes: string[]; edges: GraphEdge[] };
  tokenCount: number;
  budget: number;
  summary: string;
}

export interface ImpactResult {
  target: string;
  directCallers: string[];
  transitiveCallers: string[];
  affectedFiles: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SearchResult {
  symbolId: string;
  name: string;
  kind: string;
  filePath: string;
  lineCount: number;
  score: number;
}

export interface DependencyChain {
  target: string;
  direction: 'upstream' | 'downstream';
  nodes: Array<{ symbolId: string; depth: number }>;
}

export interface CodeStats {
  totalFiles: number;
  totalSymbols: number;
  totalEdges: number;
  byLanguage: Record<string, { files: number; symbols: number }>;
  hotspots: Array<{ symbolId: string; metrics: SymbolMetrics }>;
}
