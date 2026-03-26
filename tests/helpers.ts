/**
 * Shared test helpers for code-graph tests.
 * Each helper creates fresh instances to ensure test isolation.
 */
import { resolve } from 'path';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { CodeGraph } from '../src/graph/code-graph.js';
import { ContextExtractor } from '../src/query/context-extractor.js';
import { TypeScriptPlugin } from '../src/plugins/typescript.js';
import { PythonPlugin } from '../src/plugins/python.js';

/** Build a CodeGraph from a fixtures subdirectory. Returns {graph, extractor}. */
export async function buildFixtureGraph(
  fixtureSubdir: string,
  plugins?: Array<import('../src/types.js').LanguagePlugin>,
): Promise<{ graph: CodeGraph; extractor: ContextExtractor }> {
  const graph = new CodeGraph();
  const usedPlugins = plugins ?? [new TypeScriptPlugin()];
  await graph.build(resolve(`fixtures/${fixtureSubdir}`), usedPlugins);
  const extractor = new ContextExtractor(graph);
  return { graph, extractor };
}

/** Build a CodeGraph from all fixtures (TS + Python). */
export async function buildAllFixturesGraph(): Promise<{ graph: CodeGraph; extractor: ContextExtractor }> {
  const graph = new CodeGraph();
  await graph.build(resolve('fixtures'), [new TypeScriptPlugin(), new PythonPlugin()]);
  const extractor = new ContextExtractor(graph);
  return { graph, extractor };
}

/** Create a temporary directory for tests. Returns the path and a cleanup function. */
export async function createTempDir(prefix = 'code-graph-test-'): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return {
    dir,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/** Write a TypeScript file into a directory and return the full path. */
export async function writeFixtureFile(
  dir: string,
  filename: string,
  content: string,
): Promise<string> {
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/** Build a graph from inline source files (creates temp dir, writes files, builds). */
export async function buildInlineGraph(
  files: Record<string, string>,
  plugins?: Array<import('../src/types.js').LanguagePlugin>,
): Promise<{ graph: CodeGraph; extractor: ContextExtractor; dir: string; cleanup: () => Promise<void> }> {
  const { dir, cleanup } = await createTempDir();
  for (const [name, content] of Object.entries(files)) {
    await writeFixtureFile(dir, name, content);
  }
  const graph = new CodeGraph();
  const usedPlugins = plugins ?? [new TypeScriptPlugin()];
  await graph.build(dir, usedPlugins);
  const extractor = new ContextExtractor(graph);
  return { graph, extractor, dir, cleanup };
}
