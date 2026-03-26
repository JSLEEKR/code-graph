import { helper39 } from './module39';

export function helper38(x: number): number {
  if (x <= 0) return 0;
  return x + helper39(x - 1);
}

export function process38(data: string): string {
  const n = helper38(data.length);
  return `[${n}] ${data}`;
}

export class Service38 {
  run(input: string): string {
    return process38(input);
  }
}
