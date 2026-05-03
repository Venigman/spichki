/**
 * Detect what kind of view a JSON value should render as.
 * "table"  — array of homogeneous objects (great for lists)
 * "tree"   — generic JSON
 * "scalar" — string/number/boolean/null
 */
export type ViewKind = "tree" | "table" | "scalar";

export function detectKind(value: unknown): ViewKind {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return "scalar";
  }
  if (Array.isArray(value) && isHomogeneousObjectArray(value)) {
    return "table";
  }
  return "tree";
}

export function isHomogeneousObjectArray(arr: unknown[]): boolean {
  if (arr.length < 2) return false;
  let prototypeKeys: string[] | null = null;
  let matches = 0;
  for (const item of arr) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      return false;
    }
    const keys = Object.keys(item as object);
    if (!prototypeKeys) {
      prototypeKeys = keys;
    } else {
      const overlap = keys.filter((k) => prototypeKeys!.includes(k)).length;
      if (overlap >= Math.min(2, prototypeKeys.length)) matches++;
    }
  }
  return matches >= Math.floor(arr.length / 2);
}

/** Collect column keys from an array of objects, preserving first-seen order. */
export function collectColumns(arr: unknown[], limit = 8): string[] {
  const seen = new Set<string>();
  const cols: string[] = [];
  for (const item of arr) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      for (const k of Object.keys(item as object)) {
        if (!seen.has(k)) {
          seen.add(k);
          cols.push(k);
          if (cols.length >= limit) return cols;
        }
      }
    }
  }
  return cols;
}

/** Find an array-of-objects nested in a response (e.g. { data: [...] }, { results: [...] }). */
export function findPrimaryArray(value: unknown): unknown[] | null {
  if (Array.isArray(value) && isHomogeneousObjectArray(value)) return value;
  if (value && typeof value === "object") {
    for (const k of [
      "data",
      "results",
      "items",
      "messages",
      "result",
      "list",
      "rows",
      "records",
    ]) {
      const v = (value as Record<string, unknown>)[k];
      if (Array.isArray(v) && isHomogeneousObjectArray(v)) return v;
    }
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(v) && isHomogeneousObjectArray(v)) return v;
    }
  }
  return null;
}

export function previewCell(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return "{…}";
  return String(v);
}
