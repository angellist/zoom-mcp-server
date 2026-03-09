import axios from "axios";
import {
  MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
  BACKOFF_MULTIPLIER,
  MAX_RETRY_DELAY_MS,
} from "../constants.js";

function isRetryable(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 429 || (status !== undefined && status >= 500)) return true;
    if (!error.response) return true; // network error
  }
  return false;
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  let delay = INITIAL_RETRY_DELAY_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * BACKOFF_MULTIPLIER, MAX_RETRY_DELAY_MS);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}
