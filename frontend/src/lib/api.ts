export class ApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function parseError(response: Response) {
  const retryHeader = response.headers.get("Retry-After");
  const retryAfter = retryHeader ? Number.parseInt(retryHeader, 10) : undefined;

  let message = `Request failed: ${response.status}`;
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    message = payload.error || payload.message || message;
  } catch {
    // Ignore parsing errors and keep the generic message.
  }

  if (response.status === 429 && retryAfter && Number.isFinite(retryAfter)) {
    message = `${message}. Retry in ${retryAfter}s.`;
  }

  throw new ApiError(message, response.status, Number.isFinite(retryAfter) ? retryAfter : undefined);
}

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    await parseError(response);
  }

  return response.json() as Promise<T>;
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    await parseError(response);
  }

  return response.json() as Promise<T>;
}

export async function patchJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    await parseError(response);
  }

  return response.json() as Promise<T>;
}