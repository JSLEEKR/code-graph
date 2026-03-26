import { helper38 } from './module38';

export function helper37(x: number): number {
  if (x <= 0) return 0;
  return x + helper38(x - 1);
}

export function process37(data: string): string {
  const n = helper37(data.length);
  return `[${n}] ${data}`;
}

export class Service37 {
  run(input: string): string {
    return process37(input);
  }
}
