export function validateRedirectUri(uri: string): {
  valid: boolean;
  error?: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return { valid: false, error: `Invalid URI: ${uri}` };
  }

  if (parsed.hash) {
    return { valid: false, error: "Redirect URI must not contain a fragment" };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: "Redirect URI must not contain userinfo" };
  }

  const isLocalhost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "[::1]";

  if (!isLocalhost && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: "Redirect URI must use HTTPS for non-localhost URIs",
    };
  }

  return { valid: true };
}

export function redirectUrisMatch(
  registeredUri: string,
  requestedUri: string,
): boolean {
  try {
    const registered = new URL(registeredUri);
    const requested = new URL(requestedUri);
    return (
      registered.origin === requested.origin &&
      registered.pathname === requested.pathname
    );
  } catch {
    return false;
  }
}

export function base64UrlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
