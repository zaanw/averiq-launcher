import path from "node:path";
export function safeJoin(root: string, ...parts: string[]): string {
  for (const part of parts) {
    for (const component of part.split(/[\\/]/).filter(Boolean))
      fileName(component);
  }
  const base = path.resolve(root);
  const result = path.resolve(base, ...parts);
  if (result !== base && !result.startsWith(base + path.sep))
    throw new Error("Path escapes the allowed directory");
  return result;
}
export function fileName(name: string): string {
  if (
    !name ||
    name === "." ||
    name === ".." ||
    name.trim() !== name ||
    /[. ]$/.test(name) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ||
    /[\\/:<>"|?*\x00-\x1f]/.test(name)
  )
    throw new Error("Invalid file name");
  return name;
}
export function redact(text: string): string {
  return text
    .replace(/(Bearer\s+)[\w.\-]+/gi, "$1[redacted]")
    .replace(
      /((?:access_token|refresh_token|--accessToken)["\s:=]+)[^\s",}]+/gi,
      "$1[redacted]",
    );
}
