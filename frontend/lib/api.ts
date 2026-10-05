// Base URL of the Express backend (backend/). Set NEXT_PUBLIC_API_URL per environment.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

export const apiUrl = (path: string) => `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
