import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CodeGraph } from '../graph/code-graph.js';

export class CacheManager {
  private cacheFile: string;

  constructor(cacheDir: string) {
    this.cacheFile = path.join(cacheDir, 'cache.json');
  }

  async save(graph: CodeGraph, fileMtimes: Map<string, number>): Promise<void> {
    const dir = path.dirname(this.cacheFile);
    await fs.mkdir(dir, { recursive: true });
    const data = JSON.stringify({
      graphData: graph.serialize(),
      fileMtimes: Object.fromEntries(fileMtimes),
      savedAt: new Date().toISOString(),
    });
    await fs.writeFile(this.cacheFile, data, 'utf-8');
  }

  async load(): Promise<{ graph: CodeGraph; fileMtimes: Map<string, number> } | null> {
    try {
      const raw = await fs.readFile(this.cacheFile, 'utf-8');
      const data = JSON.parse(raw);
      // Validate cache structure before deserializing
      if (typeof data.graphData !== 'string' || typeof data.fileMtimes !== 'object' || data.fileMtimes === null) {
        return null;
      }
      const graph = CodeGraph.deserialize(data.graphData);
      const fileMtimes = new Map<string, number>(Object.entries(data.fileMtimes));
      return { graph, fileMtimes };
    } catch {
      return null;
    }
  }

  async getChangedFiles(currentMtimes: Map<string, number>, savedMtimes: Map<string, number>): Promise<string[]> {
    const changed: string[] = [];
    for (const [file, mtime] of currentMtimes) {
      const saved = savedMtimes.get(file);
      if (!saved || saved !== mtime) changed.push(file);
    }
    // Also check for deleted files
    for (const file of savedMtimes.keys()) {
      if (!currentMtimes.has(file)) changed.push(file);
    }
    return changed;
  }

  async clear(): Promise<void> {
    try {
      await fs.rm(path.dirname(this.cacheFile), { recursive: true, force: true });
    } catch {}
  }
}
