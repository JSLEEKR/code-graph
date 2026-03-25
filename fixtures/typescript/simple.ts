export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function farewell(name: string): string {
  const greeting = greet(name);
  return greeting.replace('Hello', 'Goodbye');
}
