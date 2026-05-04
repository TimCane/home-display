/** Simple cookie parser — extracts a single cookie by name. */
export function getCookie(
  req: { header(name: string): string | undefined },
  name: string,
): string | undefined {
  const header = req.header("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}
