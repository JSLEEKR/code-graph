import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PythonPlugin } from '../../src/plugins/python.js';

const plugin = new PythonPlugin();

function loadFixture(name: string): { path: string; source: string } {
  const path = `fixtures/python/${name}`;
  const source = readFileSync(resolve(path), 'utf-8');
  return { path, source };
}

describe('PythonPlugin', () => {
  it('extracts function definitions', () => {
    const { path, source } = loadFixture('simple.py');
    const result = plugin.parse(path, source);

    const names = result.symbols.map(s => s.name);
    expect(names).toContain('greet');
    expect(names).toContain('farewell');

    const greet = result.symbols.find(s => s.name === 'greet')!;
    expect(greet.kind).toBe('function');
    expect(greet.params).toContain('name');

    const farewell = result.symbols.find(s => s.name === 'farewell')!;
    expect(farewell.kind).toBe('function');
  });

  it('extracts class', () => {
    const { path, source } = loadFixture('classes.py');
    const result = plugin.parse(path, source);

    const user = result.symbols.find(s => s.name === 'User');
    expect(user).toBeDefined();
    expect(user!.kind).toBe('class');
  });

  it('extracts methods with parentSymbol', () => {
    const { path, source } = loadFixture('classes.py');
    const result = plugin.parse(path, source);

    const methods = result.symbols.filter(s => s.kind === 'method');
    const methodNames = methods.map(m => m.name);
    expect(methodNames).toContain('__init__');
    expect(methodNames).toContain('get_display_name');
    expect(methodNames).toContain('greet_user');

    const userClass = result.symbols.find(s => s.name === 'User')!;
    for (const method of methods) {
      expect(method.parentSymbol).toBe(userClass.id);
    }
  });

  it('extracts imports', () => {
    const { path, source } = loadFixture('classes.py');
    const result = plugin.parse(path, source);

    expect(result.imports.length).toBeGreaterThanOrEqual(1);
    const greetImport = result.imports.find(i => i.toModule === 'simple');
    expect(greetImport).toBeDefined();
    expect(greetImport!.symbols).toContain('greet');
  });

  it('detects function calls', () => {
    const { path, source } = loadFixture('simple.py');
    const result = plugin.parse(path, source);

    // farewell calls greet
    const farewellId = `${path}::farewell`;
    const greetCall = result.calls.find(
      c => c.callerSymbol === farewellId && c.calleeName === 'greet',
    );
    expect(greetCall).toBeDefined();
    expect(greetCall!.filePath).toBe(path);
  });
});
