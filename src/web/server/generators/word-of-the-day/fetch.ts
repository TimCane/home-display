/**
 * Word of the Day fetcher.
 * Picks a deterministic word per day and looks it up via the Free Dictionary API.
 */

import { WORDS } from "./words.js";

export interface WordData {
  word: string;
  phonetic: string | null;
  partOfSpeech: string;
  definition: string;
  example: string | null;
}

/**
 * Deterministic day index: changes once per calendar day,
 * cycles through the word list without repetition within a year.
 */
function dayIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return (dayOfYear + now.getFullYear() * 367) % WORDS.length;
}

interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string }>;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
    }>;
  }>;
}

async function lookupWord(word: string): Promise<WordData | null> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const entries: DictionaryEntry[] = await res.json();
  if (!entries.length) return null;

  const entry = entries[0];
  const meaning = entry.meanings[0];
  if (!meaning) return null;

  const phonetic =
    entry.phonetic ??
    entry.phonetics?.find((p) => p.text)?.text ??
    null;

  return {
    word: entry.word,
    phonetic,
    partOfSpeech: meaning.partOfSpeech,
    definition: meaning.definitions[0].definition,
    example: meaning.definitions[0].example ?? null,
  };
}

/**
 * Fetch the word of the day. If the primary word fails the API lookup,
 * try up to 3 consecutive words in the list.
 */
export async function fetchWord(): Promise<WordData> {
  const base = dayIndex();
  for (let attempt = 0; attempt < 3; attempt++) {
    const idx = (base + attempt) % WORDS.length;
    const word = WORDS[idx];
    const data = await lookupWord(word);
    if (data) return data;
  }

  // Absolute fallback — return the word without API data
  const word = WORDS[base];
  return {
    word,
    phonetic: null,
    partOfSpeech: "noun",
    definition: "A fascinating word worth exploring.",
    example: null,
  };
}
