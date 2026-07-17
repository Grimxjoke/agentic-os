export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "request_failed") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}api${path}`, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(`Invalid HTTP response (${response.status})`, response.status);
  }
  if (!response.ok) {
    const error = body as { error?: string; code?: string };
    throw new ApiError(error.error || `Unable to request (${response.status})`, response.status, error.code);
  }
  return body as T;
}
