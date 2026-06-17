// SPDX-License-Identifier: Apache-2.0
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { parseSkillMetadata, type Skill } from "@iris/protocol";

/** Slugify a name into a filesystem/url-safe id segment. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extract reference link targets from a markdown body using remark. */
export function extractReferenceLinks(body: string): string[] {
  const tree = unified().use(remarkParse).parse(body);
  const links: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; url?: string; children?: unknown[] };
    if (n.type === "link" && typeof n.url === "string") links.push(n.url);
    if (Array.isArray(n.children)) for (const c of n.children) visit(c);
  };
  visit(tree);
  return links;
}

async function listDir(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    const out: string[] = [];
    for (const e of entries) {
      const full = join(dir, e);
      const s = await stat(full);
      if (s.isFile()) out.push(e);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Parse a single `SKILL.md` at `skillPath` into a fully-resolved {@link Skill}.
 * `idHint` (default: directory basename) seeds the stable id.
 */
export async function parseSkillFile(skillPath: string, idHint?: string): Promise<Skill> {
  const raw = await readFile(skillPath, "utf8");
  const parsed = matter(raw);
  const metadata = parseSkillMetadata(parsed.data);
  const body = parsed.content.trim();

  const dir = skillPath.slice(0, skillPath.length - "/SKILL.md".length);
  const id = slugify(idHint ?? metadata.name ?? basename(dir));

  const [references, scripts, assets] = await Promise.all([
    listDir(join(dir, "references")),
    listDir(join(dir, "scripts")),
    listDir(join(dir, "assets")),
  ]);

  return {
    id,
    metadata,
    dir,
    path: skillPath,
    body,
    references: references.map((f) => relative(dir, join(dir, "references", f))),
    scripts: scripts.map((f) => relative(dir, join(dir, "scripts", f))),
    assets: assets.map((f) => relative(dir, join(dir, "assets", f))),
  };
}
