import { database, reply, routeError } from '@/lib/server';
import { env } from 'cloudflare:workers';
export const dynamic = 'force-dynamic';
// No user records or secrets are returned. Hosted private access remains owned
// by Sites. This endpoint allows service-authorized availability verification.
export async function GET() {
  try {
    const db=database();
    await db.batch(['profiles','applications','stories','board_cache'].map(table=>db.prepare('SELECT 1 FROM '+table+' LIMIT 0')));
    return reply({status:'ok',database:'ready',revision:'identity-v4',ownerConfigurationReady:!!env.CAREER_OPS_OWNER_RECORD_KEY && env.CAREER_OPS_PRIVATE_ACCESS_BOUNDARY === 'owner-private' && !!env.CAREER_OPS_DISPATCH_SERVICE});
  } catch(error) { return routeError(error); }
}

