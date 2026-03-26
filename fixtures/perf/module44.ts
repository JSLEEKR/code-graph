import { helper45 } from './module45';

export function helper44(x: number): number {
  if (x <= 0) return 0;
  return x + helper45(x - 1);
}

export function process44(data: string): string {
  const n = helper44(data.length);
  return `[${n}] ${data}`;
}

export class Service44 {
  run(input: string): string {
    return process44(input);
  }
}
