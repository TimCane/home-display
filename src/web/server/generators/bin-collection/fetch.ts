/**
 * Bin collection data fetcher — supports ICS feed, JSON API, or Woking council scraper.
 */

import ical, { type VEvent } from "node-ical";
import * as cheerio from "cheerio";

export interface BinCollection {
  date: string;       // YYYY-MM-DD
  binType: string;    // "general", "recycling", "garden", "food"
  label: string;      // "Black Bin", "Green Bin", etc.
}

export interface BinCollectionData {
  collections: BinCollection[];
  councilName: string;
}

export interface BinCollectionConfig {
  source_type: "ics" | "json" | "woking";
  ics_url?: string;
  api_url?: string;
  address_id?: string;
  council_name: string;
  postcode?: string;
  house_number?: string;
}

/** Map keywords in event summaries to canonical bin types. */
function classifyBinType(summary: string): string {
  const lower = summary.toLowerCase();
  if (lower.includes("recycling")) return "recycling";
  if (lower.includes("garden")) return "garden";
  if (lower.includes("food")) return "food";
  if (lower.includes("batteries") || lower.includes("electricals") || lower.includes("textiles"))
    return "recycling";
  if (lower.includes("rubbish") || lower.includes("general") || lower.includes("waste") || lower.includes("refuse"))
    return "general";
  return "general";
}

/** Format a Date as YYYY-MM-DD. */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's date string (YYYY-MM-DD). */
function todayString(): string {
  return toDateString(new Date());
}

async function fetchFromIcs(url: string): Promise<BinCollection[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`ICS feed returned ${res.status}: ${await res.text()}`);
  }

  const icsText = await res.text();
  const parsed = ical.sync.parseICS(icsText);
  const collections: BinCollection[] = [];

  for (const key of Object.keys(parsed)) {
    const component = parsed[key];
    if (!component || component.type !== "VEVENT") continue;

    const evt = component as VEvent;
    const start = evt.start instanceof Date ? evt.start : new Date(evt.start);

    // Extract summary
    const rawSummary = evt.summary;
    const summary =
      typeof rawSummary === "string"
        ? rawSummary
        : rawSummary
          ? (rawSummary as { val: string }).val
          : "";

    collections.push({
      date: toDateString(start),
      binType: classifyBinType(summary),
      label: summary,
    });
  }

  return collections;
}

async function fetchFromJson(
  url: string,
  addressId?: string,
): Promise<BinCollection[]> {
  const reqUrl = new URL(url);
  if (addressId) reqUrl.searchParams.set("address_id", addressId);

  const res = await fetch(reqUrl.toString(), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`JSON API returned ${res.status}: ${await res.text()}`);
  }

  const items = (await res.json()) as Array<{
    date: string;
    type: string;
    label?: string;
  }>;

  return items.map((item) => ({
    date: item.date,
    binType: item.type,
    label: item.label ?? item.type,
  }));
}

/**
 * Woking Borough Council scraper.
 * Ported from UKBinCollectionData (Python/BeautifulSoup) to TypeScript/cheerio.
 * https://github.com/robbrad/UKBinCollectionData
 *
 * Flow:
 *  1. GET root URL → parse link to "View My Collections" portal (contains unique service ID)
 *  2. Reorder query params, POST address form with house number + postcode
 *  3. Follow the first property link to load the calendar page
 *  4. Parse the collection list from the calendar
 */
async function fetchFromWoking(
  houseNumber: string,
  postcode: string,
): Promise<BinCollection[]> {
  const rootUrl = "https://asjwsw-wrpwokingmunicipal-live.whitespacews.com/";
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    Origin: rootUrl,
    Referer: rootUrl,
  };

  // Step 1: GET root page, extract the "View My Collections" link
  const startRes = await fetch(rootUrl, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!startRes.ok) throw new Error(`Woking root page returned ${startRes.status}`);
  const start$ = cheerio.load(await startRes.text());

  const baseLink = start$(
    "#menu-content > div > div:nth-child(1) > p.govuk-body a",
  ).attr("href");
  if (!baseLink) throw new Error("Could not find collections portal link on Woking root page");

  // Step 2: Reorder query params and POST address search
  const parsed = new URL(baseLink, rootUrl);
  const parts = parsed.pathname;
  const q0 = parsed.searchParams.get("sn") ?? "";
  const q1 = parsed.searchParams.get("id") ?? "";
  // Build the address lookup URL: mop.php?id=...&sn=...&seq=2
  const addrUrl = new URL(parts.replace(/\/[^/]*$/, "/mop.php"), rootUrl);
  addrUrl.searchParams.set("id", q1 || parsed.searchParams.entries().next().value?.[1] || "");
  addrUrl.searchParams.set("sn", q0 || "");
  addrUrl.searchParams.set("seq", "2");

  // Reconstruct from the original query string to match the Python logic exactly
  const origQuery = parsed.search.slice(1); // remove leading ?
  const queryParts = origQuery.split("&");
  const basePath = baseLink.split("?")[0];
  const addrLink = queryParts.length >= 2
    ? `${basePath.startsWith("http") ? "" : rootUrl}${basePath}/../mop.php?${queryParts[1]}&${queryParts[0]}&seq=2`
    : addrUrl.toString();

  const formData = new URLSearchParams({
    address_name_number: houseNumber,
    address_street: "",
    street_town: "",
    address_postcode: postcode,
  });

  // We need cookie-based sessions. Use manual cookie tracking.
  const cookies = extractCookies(startRes);

  const addrRes = await fetch(addrLink.startsWith("http") ? addrLink : rootUrl + addrLink, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    body: formData.toString(),
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!addrRes.ok) throw new Error(`Woking address lookup returned ${addrRes.status}`);

  const addr$ = cheerio.load(await addrRes.text());
  const allCookies = mergeCookies(cookies, extractCookies(addrRes));

  // Step 3: Follow the first property link
  const propertyHref = addr$("#property_list > ul > li > a").attr("href");
  if (!propertyHref) throw new Error("No property found for this address on Woking portal");

  const calLink = propertyHref.startsWith("http") ? propertyHref : rootUrl + propertyHref;
  const calRes = await fetch(calLink, {
    headers: { ...headers, Cookie: allCookies },
    signal: AbortSignal.timeout(10_000),
  });
  if (!calRes.ok) throw new Error(`Woking calendar page returned ${calRes.status}`);

  // Step 4: Parse collection list
  // The page contains repeated blocks like:
  //   "Collection Item"  /  "07/05/2026"  /  "Rubbish"
  // Extract all text lines, find each dd/mm/yyyy date, and take the next
  // non-date, non-header line as the bin type.
  const cal$ = cheerio.load(await calRes.text());
  const collections: BinCollection[] = [];

  // Get all text content, split into trimmed non-empty lines
  const lines = cal$.text()
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const dateStr = parseUkDate(lines[i]);
    if (!dateStr) continue;

    // The bin type is the next meaningful line after the date
    const binLine = lines[i + 1];
    if (!binLine || parseUkDate(binLine) || binLine === "Collection Item") continue;

    const label = binLine.includes("Batteries-small electricals-textiles")
      ? binLine.replace(/-/g, "/").trim()
      : binLine.trim();

    collections.push({
      date: dateStr,
      binType: classifyBinType(label),
      label,
    });
  }

  return collections;
}

/** Parse dd/mm/yyyy to YYYY-MM-DD. */
function parseUkDate(s: string): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  return `${m[3]}-${month}-${day}`;
}

/** Extract Set-Cookie values from a response. */
function extractCookies(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

/** Merge two cookie strings. */
function mergeCookies(existing: string, fresh: string): string {
  if (!existing) return fresh;
  if (!fresh) return existing;
  return existing + "; " + fresh;
}

export async function fetchBinCollection(
  config: BinCollectionConfig,
): Promise<BinCollectionData> {
  let collections: BinCollection[];

  if (config.source_type === "ics") {
    collections = await fetchFromIcs(config.ics_url!);
  } else if (config.source_type === "woking") {
    collections = await fetchFromWoking(config.house_number!, config.postcode!);
  } else {
    collections = await fetchFromJson(config.api_url!, config.address_id);
  }

  const today = todayString();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 14);
  const cutoffStr = toDateString(cutoff);

  collections = collections
    .filter((c) => c.date >= today && c.date <= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    collections,
    councilName: config.council_name,
  };
}
