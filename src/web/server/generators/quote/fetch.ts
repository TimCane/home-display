/**
 * ZenQuotes API client.
 * Fetches the quote of the day, falling back to a random quote.
 */

export interface QuoteData {
  text: string;
  author: string;
}

interface ZenQuotesEntry {
  q: string;
  a: string;
}

export async function fetchQuote(): Promise<QuoteData> {
  const opts: RequestInit = { signal: AbortSignal.timeout(10_000) };

  let entries: ZenQuotesEntry[];
  try {
    const res = await fetch("https://zenquotes.io/api/today", opts);
    if (!res.ok) throw new Error(`zenquotes /today returned ${res.status}`);
    entries = (await res.json()) as ZenQuotesEntry[];
  } catch {
    // Fallback to random quote
    const res = await fetch("https://zenquotes.io/api/random", opts);
    if (!res.ok) {
      throw new Error(`zenquotes /random returned ${res.status}: ${await res.text()}`);
    }
    entries = (await res.json()) as ZenQuotesEntry[];
  }

  const entry = entries[0];
  return {
    text: entry.q,
    author: entry.a,
  };
}
