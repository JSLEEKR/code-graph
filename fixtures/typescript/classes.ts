import { greet } from './simple';

export interface Identifiable {
  id: string;
}

export class User implements Identifiable {
  constructor(public id: string, public name: string) {}

  getDisplayName(): string {
    return this.name.toUpperCase();
  }

  greetUser(): string {
    return greet(this.name);
  }
}
