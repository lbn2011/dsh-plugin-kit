/**
 * dsh-plugin-kit — the optional provider that publishes one coordinator as a
 * host service.
 *
 * ## What this is
 *
 * `createAdmissionProvider(coordinator)` returns an ordinary Cordis plugin
 * object — `{ name, apply }` — whose `apply` publishes the coordinator it was
 * given under the service name `pluginAdmission`. A generated admitted plugin
 * declares `inject: ['tools', 'pluginAdmission']` and reads the *same* claim
 * table the caller created with `createAdmissionCoordinator()`.
 *
 * The provider is the only thing this kit hands to a host. Making the
 * coordinator visible is the whole job; who reserves, what gets deferred and
 * when a claim is released stay where they already were.
 *
 * ## Ownership is external and stays external
 *
 * The caller creates the coordinator, the caller keeps it, and this module
 * never takes it over:
 *
 * - **It never creates a coordinator.** There is no default, no fallback and no
 *   "make me one" path: `createAdmissionProvider()` with no argument throws.
 *   A provider that invented a coordinator would hand every dependent a private
 *   table, which is the double-activation the coordinator exists to prevent.
 * - **It never copies, wraps, proxies or rewrites the object it was given.** The
 *   exact object identity the factory received is the exact value `provide()`
 *   publishes, so `ctx.pluginAdmission === coordinator` holds by identity, and
 *   the methods on it are the caller's own functions.
 * - **It copies no admission rule.** No claim tuple, no key, no lease state, no
 *   conflict decision lives here; the provider has no opinion about claims and
 *   never validates one.
 * - **It keeps no registry and no module state.** Two providers made from two
 *   coordinators stay two disjoint tables with no shared lookup between them,
 *   and nothing about the coordinator is stored outside the plugin object's own
 *   closure.
 * - **It never resets, releases or quarantines anything.** `apply` registers the
 *   service and does nothing else; a provider unload unregisters the *service*
 *   (the host's own effect), which is not a claim release. Claims are released
 *   only by the `close()`/`release()` calls the holder of a lease already makes.
 *   Reloading the provider can cause dependent plugins to unload and cleanly
 *   release their claims. The provider itself never clears the table; failed
 *   cleanup quarantine remains on the retained coordinator.
 *
 * ## Cross-process scope
 *
 * The service is a reference inside one running process. Nothing about it
 * survives a process restart, and two processes never see each other's
 * coordinator — in Cordis terms, a dependent resolves it only when the
 * providing fiber provides it inside the dependent's own visibility (isolation)
 * scope. So a caller that wants sharing has two obligations this module cannot
 * check: reuse the one coordinator instance, and load the dependents in a scope
 * where the provider's service is visible. Treating a restart, a fresh
 * coordinator or a reload as recovery from a held claim is the mistake the
 * coordinator's quarantine documents against.
 *
 * ## Why `apply` is an arrow and why it returns nothing
 *
 * `Fiber`'s runner asks `isConstructor(plugin.apply)` before calling a plugin: a
 * constructible `apply` is invoked with `new`, and Cordis then reads the
 * resulting instance's initialization hook rather than collecting a returned
 * cleanup function directly. A non-constructible one is called as a plain
 * function and its return value is collected as that plugin's effect (vendored
 * `cordis/src/fiber.ts`, the `_runner.execute` and `_execute` paths). An arrow
 * has no `prototype`, so `apply` is always the plainly-called form.
 *
 * It still returns nothing, and that is deliberate: `ctx.provide()` already
 * registers its own `ctx.fiber.effect(...)` and returns *that* effect's
 * disposer. Handing the same teardown back as the plugin's effect would register
 * one cleanup under two owners. `undefined` is a valid effect — Cordis accepts a
 * nullish return and collects nothing — so the fiber owns the disposer exactly
 * once, and this module never performs a manual cleanup that could run a second
 * time.
 *
 * ## Failure
 *
 * - A coordinator that is not an object, or that is missing a callable `reserve`
 *   or `admit`, is refused with `TypeError` **at factory time**, before any
 *   plugin object exists: a bad coordinator then fails at the call site that
 *   built it instead of inside the host's load lifecycle, where the caller
 *   cannot see it.
 * - A `provide()` that throws is not caught, inspected or retried. The duplicate
 *   registration error the host raises for a second provider in one scope leaves
 *   `apply` unchanged, so the host's own error reaches the host's own lifecycle.
 *   This module has no duplicate guard of its own and could not have a correct
 *   one: duplicate detection belongs to the service store that knows the scope.
 *
 * The only members this module reads are `reserve`, `admit` and `provide`; a
 * getter on the coordinator is therefore invoked by the shape check, and nothing
 * later. This is ordinary validation, not a sandbox: no `Proxy` trap is
 * intercepted and no later property access is observed.
 *
 * @packageDocumentation
 */

/**
 * Service name the provider publishes and dependents inject.
 *
 * Fixed, not configurable: a generated plugin's `inject` list and the provider
 * that satisfies it must agree on one literal, and a tunable name would let the
 * two drift apart silently.
 */
export const ADMISSION_SERVICE = 'pluginAdmission';

/**
 * Describe a rejected value for a message only, without coercing it or invoking
 * anything on it.
 *
 * @param {unknown} value
 * @returns {string}
 */
function describeValue(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  const type = typeof value;
  if (type === 'function') return 'a function';
  if (type !== 'object') return `a ${type}`;
  return 'an object';
}

/**
 * Refuse anything that is not the coordinator this service is meant to carry.
 *
 * The check is the two operations a holder of the service actually performs, and
 * neither is ever **called** here: the provider only establishes that both exist
 * and are callable.
 * This is structural validation only: it does not authenticate the object's
 * origin or establish that its methods implement the kit's admission semantics.
 * Nothing else is inspected: `size` is not read, because reading a coordinator's
 * live count at provider creation would say nothing about whether the object can
 * reserve, and the count is not part of what the dependency needs.
 *
 * @param {unknown} coordinator
 * @returns {void}
 * @throws {TypeError} When the value is not an object with callable `reserve`
 * and `admit` members.
 */
function assertCoordinator(coordinator) {
  if (coordinator === null || (typeof coordinator !== 'object' && typeof coordinator !== 'function')) {
    throw new TypeError(
      'createAdmissionProvider(coordinator): coordinator must be the object createAdmissionCoordinator() '
        + `returned, not ${describeValue(coordinator)}; this module never creates one for you`,
    );
  }
  // Read and describe each required operation on its own, so the message names
  // the member that is wrong instead of only the object.
  for (const method of ['reserve', 'admit']) {
    const member = coordinator[method];
    if (typeof member !== 'function') {
      throw new TypeError(
        `createAdmissionProvider(coordinator): coordinator.${method} must be a function, not ${describeValue(member)}`,
      );
    }
  }
}

/**
 * Build the plugin object that publishes `coordinator` as `pluginAdmission`.
 *
 * The factory keeps the exact object it was given and hands that same reference
 * to every `apply`, so every activation, every reload through the same plugin
 * object and every dependent in the provider's visibility scope resolve one
 * coordinator — not a copy, not a wrapper and not a fresh table.
 *
 * @param {{ reserve(claims: readonly unknown[]): unknown, admit(claims: readonly unknown[], activate: (context: unknown) => unknown): Promise<unknown> }} coordinator
 * The caller's coordinator. Must be the object `createAdmissionCoordinator()`
 * returned; it is retained by identity and never created, replaced or reset
 * here.
 * @returns {{ readonly name: 'pluginAdmission', apply(ctx: { provide(name: string, value: unknown): () => void }): void }}
 * A frozen Cordis plugin object. Its `apply` returns nothing: the disposer
 * belongs to the fiber's own `provide` effect.
 * @throws {TypeError} When `coordinator` is not an object with callable
 * `reserve` and `admit` members — checked before any plugin object exists.
 */
export function createAdmissionProvider(coordinator) {
  assertCoordinator(coordinator);

  return Object.freeze({
    // The plugin is named after the service it publishes, so a fiber name in
    // host diagnostics and the service a dependent injects are the same word.
    name: ADMISSION_SERVICE,
    /**
     * Publish the retained coordinator. Arrow, so Cordis calls it as a plain
     * function; returning nothing, so the only owner of the provide disposer is
     * the providing fiber.
     *
     * @param {{ provide(name: string, value: unknown): () => void }} ctx The
     * hosting Cordis context.
     * @returns {void}
     */
    apply: (ctx) => {
      // The one host call this module ever makes. A throw here (a duplicate
      // registration in the same scope, an inactive fiber) propagates untouched:
      // the host owns both the rule and the reporting of it.
      ctx.provide(ADMISSION_SERVICE, coordinator);
    },
  });
}
