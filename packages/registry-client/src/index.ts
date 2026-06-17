// SPDX-License-Identifier: Apache-2.0

/**
 * @iris/registry-client — [STUB]
 *
 * Resolution and fetch/publish for `@namespace/skill` references against a
 * skill registry. This package intentionally ships only interfaces: the
 * reference registry server and any hosted/cloud features live elsewhere and
 * are out of scope for this open-core repository.
 *
 * TODO(iris): implement against the reference registry once `apps/registry`
 * lands.
 */

/** A parsed `@namespace/skill[@version]` reference. */
export interface SkillRef {
  namespace: string;
  name: string;
  version?: string;
}

/** Parse a registry reference like `@acme/pdf-forms@1.2.0`. */
export function parseSkillRef(ref: string): SkillRef {
  const match = /^@([a-z0-9-]+)\/([a-z0-9-]+)(?:@(.+))?$/i.exec(ref.trim());
  if (!match) {
    throw new Error(`Invalid skill reference: "${ref}". Expected "@namespace/skill[@version]".`);
  }
  return { namespace: match[1]!, name: match[2]!, version: match[3] };
}

export interface FetchResult {
  ref: SkillRef;
  /** Local path the skill was materialized to. */
  path: string;
}

/**
 * A registry client resolves, fetches and publishes skills. The concrete
 * implementation is deferred; this interface fixes the contract.
 */
export interface RegistryClient {
  resolve(ref: string): Promise<SkillRef>;
  fetch(ref: string, destDir: string): Promise<FetchResult>;
  publish(skillDir: string): Promise<SkillRef>;
}

/** Placeholder client that makes the deferred nature explicit at runtime. */
export class NotImplementedRegistryClient implements RegistryClient {
  async resolve(ref: string): Promise<SkillRef> {
    return parseSkillRef(ref);
  }
  async fetch(_ref: string, _destDir: string): Promise<FetchResult> {
    throw new Error("Registry fetch is not implemented in the open-core client yet.");
  }
  async publish(_skillDir: string): Promise<SkillRef> {
    throw new Error("Registry publish is not implemented in the open-core client yet.");
  }
}
