const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export { API_URL };

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_URL}/api${path}`;
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  const payload = await response.json();

  if (payload.error) {
    throw new Error(payload.error.message || String(payload.error));
  }

  return payload as T;
}
