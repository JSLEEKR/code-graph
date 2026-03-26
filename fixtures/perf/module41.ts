import { helper42 } from './module42';

export function helper41(x: number): number {
  if (x <= 0) return 0;
  return x + helper42(x - 1);
}

export function process41(data: string): string {
  const n = helper41(data.length);
  return `[${n}] ${data}`;
}

export class Service41 {
  run(input: string): string {
    return process41(input);
  }
}
