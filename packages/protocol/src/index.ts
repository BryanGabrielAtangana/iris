// SPDX-License-Identifier: Apache-2.0

/**
 * @iris/protocol — the Iris Skill Access Protocol contract.
 *
 * Zero internal dependencies. Everything downstream (core, mcp, cli, adapters)
 * imports its types and schemas from here.
 */
export const PROTOCOL_VERSION = "0.1.0";

export * from "./skill.js";
export * from "./lockfile.js";
export * from "./discovery.js";
export * from "./parse.js";
export * from "./json-schema.js";
