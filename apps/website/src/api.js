const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
export async function submitInterest(payload) {
  const response = await fetch(`${API_BASE}/api/v1/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || "Unable to submit request");
  return body;
}
