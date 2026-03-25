import { User } from './classes';

export function createUser(name: string): User {
  return new User('123', name);
}

export function getUserName(user: User): string {
  return user.getDisplayName();
}
