import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./env";
import { describeDatabaseTarget } from "../lib/db/target-description";

// This is a description of this process only, not a probe of a running server.
loadLocalEnv();
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = describeDatabaseTarget(process.env, process.cwd(), projectDirectory);
console.log(`Selection for this process: ${target.kind}`);
if (target.kind === "pglite-directory") {
  console.log(`Project-default directory: ${target.isProjectDefault ? "yes" : "no"}`);
  if (target.isProjectDefault) console.log(`Directory: ${target.target}`);
}
console.log("No connection made. This does not identify a running server or verify database identity, contents, backup, or safety.");
