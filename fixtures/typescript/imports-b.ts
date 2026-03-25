import { createUser, getUserName } from './imports-a';

export function processUser(name: string): string {
  const user = createUser(name);
  return getUserName(user);
}
