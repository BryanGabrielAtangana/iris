// SPDX-License-Identifier: Apache-2.0
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { searchCommand } from "./commands/search.js";
import { syncCommand } from "./commands/sync.js";
import { doctorCommand } from "./commands/doctor.js";

const VERSION = "0.1.0";

/** Build the `iris` commander program. Exported so tests can drive it. */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name("iris")
    .description(
      "Iris — discover and invoke the right skill at the right time, from a portable skill library.",
    )
    .version(VERSION)
    .option("-l, --library <path>", "Library root (defaults to $IRIS_LIBRARY or cwd)");

  program
    .command("init")
    .description("Create or point at a skill library")
    .argument("[dir]", "Library directory")
    .action((dir: string | undefined) => initCommand(dir, program.opts()));

  program
    .command("add")
    .description("Add a skill folder to the library")
    .argument("<path>", "Path to a folder containing SKILL.md")
    .action((path: string) => addCommand(path, program.opts()));

  program
    .command("remove")
    .alias("rm")
    .description("Remove a skill from the library")
    .argument("<id>", "Skill id")
    .action((id: string) => removeCommand(id, program.opts()));

  program
    .command("search")
    .description("Search the library (Tier-2 retrieval)")
    .argument("<query...>", "Your task or intent")
    .option("-k, --k <n>", "Number of results", "5")
    .action((query: string[], cmdOpts: { k?: string }) =>
      searchCommand(query.join(" "), { ...program.opts(), ...cmdOpts }),
    );

  program
    .command("sync")
    .description("Write skills + the Tier-1 index into agent surfaces")
    .option("-a, --adapter <names>", "Comma-separated adapters (default: claude-code)")
    .option("-t, --target <dir>", "Target project directory (default: cwd)")
    .action((cmdOpts: { adapter?: string; target?: string }) =>
      syncCommand({ ...program.opts(), ...cmdOpts }),
    );

  program
    .command("doctor")
    .description("Check environment + index health")
    .action(() => doctorCommand(program.opts()));

  return program;
}
