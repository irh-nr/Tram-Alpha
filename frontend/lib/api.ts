const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class NetworkError extends Error {
  constructor(message = "Network connection lost") {
    super(message);
    this.name = "NetworkError";
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      "Content-Type": "application/json",
      ...(session?.access_token && {
        Authorization: `Bearer ${session.access_token}`,
      }),
    };
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: await this.getHeaders(),
      });
    } catch (err) {
      // fetch() hanya melempar TypeError saat koneksi jaringan/DNS terputus
      if (err instanceof TypeError) {
        throw new NetworkError(err.message);
      }
      throw err;
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "API request failed");
    }

    const text = await res.text();
    return text ? JSON.parse(text) : (undefined as unknown as T);
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
    }
    return this.request<T>(url.toString());
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async delete<T = void>(path: string): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: "DELETE",
    });
  }
}

export const api = new ApiClient(`${API_BASE_URL}/api`);