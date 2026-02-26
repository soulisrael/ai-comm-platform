const API_URL = import.meta.env.VITE_API_URL || '';

class ApiClient {
  private baseUrl: string;
  private apiKey: string | null = null;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.error || res.statusText, body.code);
    }

    return res.json();
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    // Do NOT set Content-Type — browser sets multipart boundary automatically
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.error || res.statusText, body.code);
    }

    return res.json();
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const api = new ApiClient(API_URL);
