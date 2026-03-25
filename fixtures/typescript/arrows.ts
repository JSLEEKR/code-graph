export type Point = {
  x: number;
  y: number;
};

export const double = (x: number): number => {
  return x * 2;
};

export const addPoints = (a: Point, b: Point): Point => {
  return { x: a.x + b.x, y: a.y + b.y };
};

export const transform = (p: Point): Point => {
  const d = double(p.x);
  return { x: d, y: p.y };
};
