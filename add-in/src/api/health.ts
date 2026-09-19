import type { HealthResponse } from "../types";

export async function fetchHealth(url: string): Promise<HealthResponse> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Health check failed (${resp.status})`);
  return (await resp.json()) as HealthResponse;
}
