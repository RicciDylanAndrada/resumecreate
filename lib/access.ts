// Access code gate. When ACCESS_CODE is set, nothing on the site (pages or
// API) is served until the visitor enters it on the lock screen. The cookie
// holds a hash of the code, never the code itself.
export const ACCESS_COOKIE = "rm_access";

export async function accessToken(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`resume-maker:${code}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function unlocked(cookieValue: string | undefined): Promise<boolean> {
  const code = process.env.ACCESS_CODE;
  if (!code) return true;
  return !!cookieValue && cookieValue === (await accessToken(code));
}
