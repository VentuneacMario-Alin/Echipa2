// API-ul ruleaza pe portul 8080, pe acelasi host ca frontend-ul (cookie-ul de sesiune ramane valid).
export const API_BASE = `${window.location.protocol}//${window.location.hostname}:8080`;

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

function errorMessage(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "";
    return field ? `${field}: ${first.msg}` : first.msg;
  }
  return "Cererea nu a putut fi finalizată.";
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" });
  } catch {
    throw new Error("Serverul nu răspunde. Verifică dacă backend-ul este pornit.");
  }
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/login")) onUnauthorized();
    throw new Error(errorMessage(payload?.detail));
  }
  return payload;
}
