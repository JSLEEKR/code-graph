import { describe, it, expect } from 'vitest';
import { PluginRegistry } from '../../src/plugins/plugin-registry.js';
import { TypeScriptPlugin } from '../../src/plugins/typescript.js';
import { PythonPlugin } from '../../src/plugins/python.js';

describe('PluginRegistry', () => {
  it('registers and retrieves plugins by file extension', () => {
    const registry = new PluginRegistry();
    const tsPlugin = new TypeScriptPlugin();
    registry.register(tsPlugin);

    expect(registry.getForFile('src/app.ts')).toBe(tsPlugin);
    expect(registry.getForFile('components/Button.tsx')).toBe(tsPlugin);
  });

  it('returns undefined for unregistered extensions', () => {
    const registry = new PluginRegistry();
    registry.register(new TypeScriptPlugin());

    expect(registry.getForFile('main.rs')).toBeUndefined();
    expect(registry.getForFile('app.go')).toBeUndefined();
  });

  it('lists all unique registered plugins', () => {
    const registry = new PluginRegistry();
    const tsPlugin = new TypeScriptPlugin();
    const pyPlugin = new PythonPlugin();

    registry.register(tsPlugin);
    registry.register(pyPlugin);

    const plugins = registry.list();
    expect(plugins).toHaveLength(2);
    expect(plugins).toContain(tsPlugin);
    expect(plugins).toContain(pyPlugin);
  });

  it('handles files with no extension', () => {
    const registry = new PluginRegistry();
    registry.register(new TypeScriptPlugin());

    // A file like 'Makefile' -> ext = '.Makefile', not registered
    expect(registry.getForFile('Makefile')).toBeUndefined();
  });
});
