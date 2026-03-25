import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git', '__pycache__', '.code-graph']);

export async function scanFiles(rootDir: string, extensions: string[]): Promise<string[]> {
  const absRoot = resolve(rootDir);
  const extSet = new Set(extensions);
  let files: string[];

  try {
    // Try git ls-files first (respects .gitignore)
    const output = execSync('git ls-files', { cwd: absRoot, encoding: 'utf-8' });
    files = output
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean)
      .map(f => join(absRoot, f));
  } catch {
    // Fallback: recursive fs scan
    files = recursiveScan(absRoot);
  }

  // Filter by extensions
  return files.filter(f => extSet.has(extname(f)));
}

function recursiveScan(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...recursiveScan(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}
