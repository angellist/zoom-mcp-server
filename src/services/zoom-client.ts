import axios, { type AxiosInstance } from "axios";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../constants.js";

let client: AxiosInstance | null = null;
let tokenExpiresAt = 0;
let cachedToken = "";

function getServerToServerCredentials(): {
  accountId: string;
  clientId: string;
  clientSecret: string;
} | null {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (accountId && clientId && clientSecret) {
    return { accountId, clientId, clientSecret };
  }
  return null;
}

async function getAccessToken(): Promise<string> {
  const staticToken = process.env.ZOOM_API_TOKEN;
  if (staticToken) return staticToken;

  const creds = getServerToServerCredentials();
  if (!creds) {
    throw new Error(
      "Missing Zoom credentials. Set ZOOM_API_TOKEN or ZOOM_ACCOUNT_ID + ZOOM_CLIENT_ID + ZOOM_CLIENT_SECRET.",
    );
  }

  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const response = await axios.post<{ access_token: string; expires_in: number }>(
    "https://zoom.us/oauth/token",
    null,
    {
      params: {
        grant_type: "account_credentials",
        account_id: creds.accountId,
      },
      auth: {
        username: creds.clientId,
        password: creds.clientSecret,
      },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: REQUEST_TIMEOUT_MS,
    },
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
  return cachedToken;
}

export async function getZoomClient(): Promise<AxiosInstance> {
  const token = await getAccessToken();

  if (client) {
    client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    return client;
  }

  client = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return client;
}

export async function makeApiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  data?: unknown,
  params?: Record<string, unknown>,
): Promise<T> {
  const apiClient = await getZoomClient();
  const response = await apiClient.request<T>({
    url: endpoint,
    method,
    data,
    params,
  });
  return response.data;
}
