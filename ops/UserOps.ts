import { type User } from "../schema/users";

export async function hashPassword(password: string) {
  const hash = await Bun.password.hash(password);
  return hash;
}

export async function checkPassword(user: User, password: string) {
  const isMatch = await Bun.password.verify(password, user.password_hash);
  return isMatch;
}

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.getTime(),
    updatedAt: user.updatedAt.getTime(),
  };
}
