import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import { identityFromHeaders } from "@/lib/identity.mjs";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const user = identityFromHeaders(requestHeaders, {
    ownerEmail: env.CAREER_OPS_OWNER_EMAIL,
    ownerRecordKey: env.CAREER_OPS_OWNER_RECORD_KEY,
    privateBoundary: env.CAREER_OPS_PRIVATE_ACCESS_BOUNDARY,
    dispatchService: env.CAREER_OPS_DISPATCH_SERVICE,
  });
  if (!user) console.warn('career-ops identity diagnostics', {
    emailPresent: !!requestHeaders.get('oai-authenticated-user-email'),
    idPresent: !!requestHeaders.get('oai-authenticated-user-id'),
    ownerEmailConfigured: !!env.CAREER_OPS_OWNER_EMAIL,
    ownerKeyConfigured: !!env.CAREER_OPS_OWNER_RECORD_KEY,
    ownerEmailMatches: !!env.CAREER_OPS_OWNER_EMAIL && requestHeaders.get('oai-authenticated-user-email')?.trim().toLowerCase() === env.CAREER_OPS_OWNER_EMAIL.trim().toLowerCase(),
  });
  return user;
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
