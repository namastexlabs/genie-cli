/**
 * Shell escaping utilities for safely embedding commands in shell strings.
 */

/**
 * Escape a string for safe embedding in single-quoted shell strings.
 * e.g., "it's" becomes "it'\''s"
 *
 * This works by:
 * 1. Ending the current single-quoted string: '
 * 2. Adding an escaped single quote: \'
 * 3. Starting a new single-quoted string: '
 *
 * So "it's cool" becomes 'it'\''s cool'
 */
export function escapeForSingleQuotes(str: string): string {
  return str.replace(/'/g, "'\\''");
}

/**
 * Escape a string for safe embedding in double-quoted shell strings.
 * Escapes: $ ` " \ and newlines
 */
export function escapeForDoubleQuotes(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/\n/g, '\\n');
}

/**
 * Wrap a command in single quotes with proper escaping.
 * This is the safest way to pass arbitrary commands to shell.
 */
export function singleQuote(cmd: string): string {
  return `'${escapeForSingleQuotes(cmd)}'`;
}

/**
 * Wrap a command in double quotes with proper escaping.
 */
export function doubleQuote(cmd: string): string {
  return `"${escapeForDoubleQuotes(cmd)}"`;
}
