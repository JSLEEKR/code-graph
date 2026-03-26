import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { CodeGraph } from '../graph/code-graph.js';
import { ContextExtractor } from '../query/context-extractor.js';
import { TypeScriptPlugin } from '../plugins/typescript.js';
import { PythonPlugin } from '../plugins/python.js';
import { CacheManager } from '../cache/cache-manager.js';
import * as path from 'node:path';

export async function startMCPServer(): Promise<void> {
  const server = new Server(
    { name: 'code-graph', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  let graph: CodeGraph | null = null;
  let extractor: ContextExtractor | null = null;

  async function ensureGraph(): Promise<ContextExtractor> {
    if (extractor) return extractor;
    const rootDir = process.cwd();
    const cacheDir = path.join(rootDir, '.code-graph');
    const cache = new CacheManager(cacheDir);
    const cached = await cache.load();
    if (cached) {
      graph = cached.graph;
    } else {
      graph = new CodeGraph();
      await graph.build(rootDir, [new TypeScriptPlugin(), new PythonPlugin()]);
      await cache.save(graph, new Map());
    }
    extractor = new ContextExtractor(graph);
    return extractor;
  }

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get_context',
        description: 'Extract token-budget-optimized context for a symbol',
        inputSchema: {
          type: 'object' as const,
          properties: {
            target: { type: 'string', description: 'Symbol name or full ID' },
            budget: { type: 'number', description: 'Token budget (default 2000)' },
            mode: { type: 'string', enum: ['debug', 'refactor', 'review'], description: 'Context mode' },
          },
          required: ['target'],
        },
      },
      {
        name: 'get_impact',
        description: 'Analyze impact of changing a symbol',
        inputSchema: {
          type: 'object' as const,
          properties: { target: { type: 'string', description: 'Symbol name' } },
          required: ['target'],
        },
      },
      {
        name: 'search_symbols',
        description: 'Search for symbols by name',
        inputSchema: {
          type: 'object' as const,
          properties: { query: { type: 'string', description: 'Search query' } },
          required: ['query'],
        },
      },
      {
        name: 'get_dependencies',
        description: 'Get dependency chain for a symbol',
        inputSchema: {
          type: 'object' as const,
          properties: {
            target: { type: 'string', description: 'Symbol name' },
            direction: { type: 'string', enum: ['upstream', 'downstream'] },
          },
          required: ['target', 'direction'],
        },
      },
      {
        name: 'get_stats',
        description: 'Get codebase statistics',
        inputSchema: {
          type: 'object' as const,
          properties: { path: { type: 'string', description: 'Filter by path' } },
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const ext = await ensureGraph();
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    // Validate string params: reject path traversal attempts and null bytes
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        if (value.includes('\0')) {
          throw new Error(`Invalid parameter "${key}": null bytes not allowed`);
        }
        if (key === 'path' && (value.includes('..') || value.startsWith('/'))) {
          throw new Error(`Invalid path parameter: path traversal not allowed. Use relative paths within the project.`);
        }
      }
    }

    switch (request.params.name) {
      case 'get_context': {
        const result = ext.extract(args.target as string, {
          budget: (args.budget as number) ?? 2000,
          mode: (args.mode as 'debug' | 'refactor' | 'review') ?? 'debug',
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      case 'get_impact': {
        const result = ext.impact(args.target as string);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      case 'search_symbols': {
        const results = ext.search(args.query as string);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }
      case 'get_dependencies': {
        const result = ext.dependencies(
          args.target as string,
          args.direction as 'upstream' | 'downstream',
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      case 'get_stats': {
        const result = ext.stats(args.path as string);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
