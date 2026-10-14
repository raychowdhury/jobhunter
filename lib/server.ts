import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export async function owner() {
  const user = await getChatGPTUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  return user;
}
export function database(): D1Database {
  if (!env.DB) throw new Error('Database is unavailable. Please try again.');
  return env.DB;
}
export function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : 'The request could not be completed.';
  if (message === 'AUTH_REQUIRED') return reply({ error: 'Sign in to your workspace.', signIn: '/signin-with-chatgpt?return_to=/' }, 401);
  if (message.startsWith('VALIDATION:')) return reply({ error: message.slice(11) }, 400);
  console.error('Career workspace request failed:', error);
  return reply({ error: 'We could not complete that request. Your changes were not saved; please retry.' }, 500);
}
export { field, body } from "./validation.mjs";
