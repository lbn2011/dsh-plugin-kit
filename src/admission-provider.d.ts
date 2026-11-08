/**
 * dsh-plugin-kit/admission-provider public types.
 *
 * Hand-written, like `cleanup.d.ts`: this package ships no build step, so these
 * declarations are the source of truth for consumers.
 */

/**
 * Service name the provider publishes and a generated admitted plugin injects.
 *
 * Fixed rather than configurable: the `inject` list in generated source and the
 * provider that satisfies it must name one literal, and a tunable name would let
 * the two drift apart without either side failing.
 */
export declare const ADMISSION_SERVICE: 'pluginAdmission';

/**
 * The only coordinator surface the provider reads.
 *
 * Deliberately narrower than `AdmissionCoordinator`: publishing a value needs to
 * know nothing about claims, and a coordinator carrying more members (the kit's
 * own carries `size` as well) still satisfies this interface structurally. The
 * members are declared here so a caller cannot pass an object that would publish
 * a table no dependent can reserve on.
 */
export interface AdmissionProviderCoordinator {
  /** Reserve a batch of claims and return its lease. Never called by the provider. */
  reserve(claims: readonly import('./admission.js').ResourceClaim[]): import('./admission.js').AdmissionLease;
  /** Reserve, activate and return a handle. Never called by the provider. */
  admit(
    claims: readonly import('./admission.js').ResourceClaim[],
    activate: (context: import('./admission.js').AdmissionContext) => unknown,
  ): Promise<import('./admission.js').AdmissionHandle>;
}

/**
 * The Cordis context surface `apply` uses.
 *
 * Exactly one member: the provider publishes a service and touches nothing else
 * on the context. A real Cordis `Context` satisfies it.
 */
export interface AdmissionProviderContext {
  /**
   * Register a service implementation owned by the current fiber.
   *
   * The returned disposer stays the context's own: this module keeps it nowhere
   * and never calls it.
   */
  provide(name: string, value: unknown): () => void;
}

/**
 * The plugin object `createAdmissionProvider()` returns.
 *
 * Frozen, so the coordinator it publishes cannot be re-pointed after creation,
 * and an ordinary Cordis object plugin, so the host's loader needs no special
 * handling for it.
 */
export interface AdmissionProviderPlugin {
  /** Plugin display name; always `ADMISSION_SERVICE`, `'pluginAdmission'`. */
  readonly name: 'pluginAdmission';
  /**
   * Publish the retained coordinator as the `pluginAdmission` service.
   *
   * An arrow, so Cordis calls it as a plain function rather than constructing
   * it. Returns nothing: `ctx.provide()` already registered the providing
   * fiber's own effect, and returning its disposer here would give one teardown
   * two owners. A throw from `provide()` — the host's duplicate-registration
   * error for a second provider in one scope, or an inactive fiber — propagates
   * unchanged.
   */
  apply(ctx: AdmissionProviderContext): void;
}

/**
 * Build the plugin object that publishes `coordinator` as `pluginAdmission`.
 *
 * The factory retains the exact object it was given and publishes that same
 * reference on every `apply`, so repeated activations, reloads through the same
 * plugin object, and every dependent in the provider's visibility scope resolve
 * one coordinator. Nothing is copied, wrapped or frozen on the caller's behalf.
 *
 * **It never creates a coordinator.** There is no default and no fallback: the
 * kit's coordinator stays a caller-owned object, created once by the caller and
 * passed around. A provider that invented one would give its dependents a
 * private claim table, which is precisely the double activation the coordinator
 * exists to prevent.
 *
 * **It never resets, releases or quarantines.** `apply` publishes the service and
 * nothing else. Unloading the provider unregisters the *service*; that is not a
 * direct claim release. Native dependency unloading may cause consumers to close
 * their handles and release clean claims. The provider never resets the retained
 * table; quarantined claims remain for that coordinator's lifetime, with no
 * public API to clear them.
 *
 * **Ownership is external, and process-local.** The published reference is one
 * running process's object: a restart is not recovery, two processes never share
 * it, and a dependent resolves it only where the providing fiber's service is
 * visible in that dependent's own isolation scope. Sharing therefore depends on
 * two caller obligations this module cannot enforce — reuse the one coordinator
 * instance, and load dependents in a scope where the provider's service is
 * visible.
 *
 * @param coordinator The caller's coordinator, retained by identity. Must be an
 * object with callable `reserve` and `admit` members.
 * @returns A frozen `{ name, apply }` Cordis plugin object.
 * @throws {TypeError} When `coordinator` is not such an object. The check runs at
 * factory time, before a plugin object exists, so a miswired provider fails at
 * the call site that built it instead of inside the host's load lifecycle.
 */
export declare function createAdmissionProvider(
  coordinator: AdmissionProviderCoordinator,
): AdmissionProviderPlugin;
