import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TypeScriptPlugin } from '../../src/plugins/typescript.js';

const plugin = new TypeScriptPlugin();

function loadFixture(name: string): { path: string; source: string } {
  const path = `fixtures/typescript/${name}`;
  const source = readFileSync(resolve(path), 'utf-8');
  return { path, source };
}

describe('TypeScriptPlugin', () => {
  it('extracts function declarations', () => {
    const { path, source } = loadFixture('simple.ts');
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

  it('extracts class and interface', () => {
    const { path, source } = loadFixture('classes.ts');
    const result = plugin.parse(path, source);

    const user = result.symbols.find(s => s.name === 'User');
    expect(user).toBeDefined();
    expect(user!.kind).toBe('class');

    const identifiable = result.symbols.find(s => s.name === 'Identifiable');
    expect(identifiable).toBeDefined();
    expect(identifiable!.kind).toBe('interface');
  });

  it('extracts class methods', () => {
    const { path, source } = loadFixture('classes.ts');
    const result = plugin.parse(path, source);

    const methods = result.symbols.filter(s => s.kind === 'method');
    const methodNames = methods.map(m => m.name);
    expect(methodNames).toContain('getDisplayName');
    expect(methodNames).toContain('greetUser');

    const userClass = result.symbols.find(s => s.name === 'User')!;
    for (const method of methods) {
      expect(method.parentSymbol).toBe(userClass.id);
    }
  });

  it('extracts imports', () => {
    const { path, source } = loadFixture('imports-a.ts');
    const result = plugin.parse(path, source);

    expect(result.imports.length).toBeGreaterThanOrEqual(1);
    const classImport = result.imports.find(i => i.toModule === './classes');
    expect(classImport).toBeDefined();
    expect(classImport!.symbols).toContain('User');
  });

  it('detects function calls', () => {
    const { path, source } = loadFixture('simple.ts');
    const result = plugin.parse(path, source);

    // farewell calls greet
    const farewellId = `${path}::farewell`;
    const greetCall = result.calls.find(
      c => c.callerSymbol === farewellId && c.calleeName === 'greet',
    );
    expect(greetCall).toBeDefined();
    expect(greetCall!.filePath).toBe(path);
  });

  it('generates correct symbol IDs', () => {
    const { path, source } = loadFixture('simple.ts');
    const result = plugin.parse(path, source);

    for (const sym of result.symbols) {
      expect(sym.id).toBe(`${path}::${sym.name}`);
    }
  });

  it('captures source code text', () => {
    const { path, source } = loadFixture('simple.ts');
    const result = plugin.parse(path, source);

    for (const sym of result.symbols) {
      expect(sym.source).toBeTruthy();
      expect(sym.source.length).toBeGreaterThan(0);
      // Source should contain the function/class name
      expect(sym.source).toContain(sym.name);
    }
  });

  it('extracts arrow functions with params', () => {
    const { path, source } = loadFixture('arrows.ts');
    const result = plugin.parse(path, source);

    const double = result.symbols.find(s => s.name === 'double');
    expect(double).toBeDefined();
    expect(double!.kind).toBe('function');
    expect(double!.params).toContain('x');

    const addPoints = result.symbols.find(s => s.name === 'addPoints');
    expect(addPoints).toBeDefined();
    expect(addPoints!.kind).toBe('function');
    expect(addPoints!.params).toEqual(expect.arrayContaining(['a', 'b']));

    // transform calls double
    const transformId = `${path}::transform`;
    const callsDouble = result.calls.find(
      c => c.callerSymbol === transformId && c.calleeName === 'double',
    );
    expect(callsDouble).toBeDefined();
  });

  it('extracts type aliases', () => {
    const { path, source } = loadFixture('arrows.ts');
    const result = plugin.parse(path, source);

    const point = result.symbols.find(s => s.name === 'Point');
    expect(point).toBeDefined();
    expect(point!.kind).toBe('type');
    expect(point!.source).toContain('x: number');
    expect(point!.source).toContain('y: number');
  });
});
