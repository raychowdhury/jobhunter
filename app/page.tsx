import Workspace from './workspace';
import { getChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Page() {
  // Hosted Sites enforces private access before dispatch. The shell carries no
  // saved records; private APIs independently resolve and authorize identity.
  const user = await getChatGPTUser();
  return <Workspace visitorName={user?.fullName || 'Ray'} />;
}
