import { CHARACTER_LIMIT } from "../constants.js";

export interface PaginatedOutput<T> {
  total: number;
  count: number;
  offset: number;
  items: T[];
  has_more: boolean;
  next_offset?: number;
  truncated?: boolean;
  truncation_message?: string;
}

export function buildPaginatedOutput<T>(
  items: T[],
  total: number,
  offset: number,
  limit: number,
): PaginatedOutput<T> {
  const has_more = total > offset + items.length;
  const output: PaginatedOutput<T> = {
    total,
    count: items.length,
    offset,
    items,
    has_more,
    next_offset: has_more ? offset + items.length : undefined,
  };

  const serialized = JSON.stringify(output);
  if (serialized.length > CHARACTER_LIMIT) {
    const halfItems = items.slice(0, Math.ceil(items.length / 2));
    return {
      total,
      count: halfItems.length,
      offset,
      items: halfItems,
      has_more: true,
      next_offset: offset + halfItems.length,
      truncated: true,
      truncation_message:
        "Response exceeded character limit. Use offset/limit parameters to page through results.",
    };
  }

  return output;
}
