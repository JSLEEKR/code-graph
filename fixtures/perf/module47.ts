import { helper48 } from './module48';

export function helper47(x: number): number {
  if (x <= 0) return 0;
  return x + helper48(x - 1);
}

export function process47(data: string): string {
  const n = helper47(data.length);
  return `[${n}] ${data}`;
}

export class Service47 {
  run(input: string): string {
    return process47(input);
  }
}
