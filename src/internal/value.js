/**
 * Tiny value predicates shared by the adapter and the CLI.
 *
 * Kept in its own module so `protocol.js` and `cli.js` do not have to export
 * (or re-export) helpers that are not part of the public surface.
 */

/**
 * True for a thenable: a Promise, or any object advertising `then()`. A
 * validator returning one has not answered synchronously, and treating it as
 * an object (whose `valid`/`issues` are undefined) would report a false
 * verdict.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPromiseLike(value) {
  if (typeof value !== 'object' || value === null) return false;
  try {
    return typeof /** @type {{ then?: unknown }} */ (value).then === 'function';
  } catch {
    // A throwing `then` getter is not a readable validator result either.
    return true;
  }
}
