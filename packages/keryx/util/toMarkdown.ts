/**
 * Converts a JavaScript value to a human-readable markdown string.
 * Used by the MCP initializer to format tool responses for LLM consumers.
 *
 * @param obj - The value to convert
 * @param options - Formatting options
 * @param options.maxDepth - Maximum nesting depth before falling back to JSON code block (default 5)
 * @param options.headingLevel - Starting heading level, 2 = ## (default 2)
 * @returns A markdown-formatted string
 */
export function toMarkdown(
  obj: unknown,
  options?: { maxDepth?: number; headingLevel?: number },
): string {
  const maxDepth = options?.maxDepth ?? 5;
  const headingLevel = options?.headingLevel ?? 2;
  return renderValue(obj, maxDepth, headingLevel, 0).trim();
}

function renderValue(
  value: unknown,
  maxDepth: number,
  headingLevel: number,
  currentDepth: number,
): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);

  if (currentDepth >= maxDepth) {
    return "```json\n" + JSON.stringify(value, null, 2) + "\n```\n";
  }

  if (Array.isArray(value)) {
    return renderArray(value, maxDepth, headingLevel, currentDepth);
  }

  return renderObject(
    value as Record<string, unknown>,
    maxDepth,
    headingLevel,
    currentDepth,
  );
}

function renderObject(
  obj: Record<string, unknown>,
  maxDepth: number,
  headingLevel: number,
  currentDepth: number,
): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return "";

  const isFlat = keys.every((k) => isPrimitive(obj[k]));

  if (isFlat) {
    return (
      keys.map((k) => `- **${k}**: ${formatPrimitive(obj[k])}`).join("\n") +
      "\n"
    );
  }

  // Mixed object: use headings for each key, recurse into values
  const parts: string[] = [];
  for (const key of keys) {
    const val = obj[key];
    if (isPrimitive(val)) {
      parts.push(`- **${key}**: ${formatPrimitive(val)}`);
    } else {
      const heading = makeHeading(key, headingLevel);
      const body = renderValue(
        val,
        maxDepth,
        headingLevel + 1,
        currentDepth + 1,
      );
      parts.push(`${heading}\n\n${body}`);
    }
  }
  return parts.join("\n") + "\n";
}

function renderArray(
  arr: unknown[],
  maxDepth: number,
  headingLevel: number,
  currentDepth: number,
): string {
  if (arr.length === 0) return "";

  // Array of primitives → bulleted list
  if (arr.every(isPrimitive)) {
    return arr.map((v) => `- ${formatPrimitive(v)}`).join("\n") + "\n";
  }

  // Array of uniform objects → table
  if (
    arr.every(isPlainObject) &&
    hasUniformKeys(arr as Record<string, unknown>[])
  ) {
    return renderTable(arr as Record<string, unknown>[]);
  }

  // Mixed array → bulleted list with recursive rendering
  return (
    arr
      .map((item) => {
        if (isPrimitive(item)) return `- ${formatPrimitive(item)}`;
        const rendered = renderValue(
          item,
          maxDepth,
          headingLevel,
          currentDepth + 1,
        ).trim();
        // Indent multiline content under the bullet
        const lines = rendered.split("\n");
        return `- ${lines[0]}${
          lines.length > 1
            ? "\n" +
              lines
                .slice(1)
                .map((l) => `  ${l}`)
                .join("\n")
            : ""
        }`;
      })
      .join("\n") + "\n"
  );
}

function renderTable(rows: Record<string, unknown>[]): string {
  const keys = Object.keys(rows[0]);
  const header = `| ${keys.join(" | ")} |`;
  const separator = `| ${keys.map(() => "---").join(" | ")} |`;
  const body = rows
    .map(
      (row) =>
        `| ${keys.map((k) => escapeTableCell(formatPrimitive(row[k]))).join(" | ")} |`,
    )
    .join("\n");
  return `${header}\n${separator}\n${body}\n`;
}

function makeHeading(text: string, level: number): string {
  if (level <= 6) return `${"#".repeat(level)} ${text}`;
  return `**${text}**`;
}

function isPrimitive(value: unknown): boolean {
  return value === null || value === undefined || typeof value !== "object";
}

function isPlainObject(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasUniformKeys(arr: Record<string, unknown>[]): boolean {
  if (arr.length === 0) return false;
  const firstKeys = Object.keys(arr[0]).sort().join(",");
  return arr.every((obj) => Object.keys(obj).sort().join(",") === firstKeys);
}

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
