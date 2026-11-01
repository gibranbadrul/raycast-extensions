import { getPreferenceValues } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { Instance } from "./instance";

const execFileAsync = promisify(execFile);

/** Where installers usually put limactl, for when the login shell can't be read. */
const FALLBACK_PATH = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];

/** Shown instead of an error when limactl isn't installed, or isn't where the preferences say. */
export class NotInstalledError extends Error {}

let env: Promise<NodeJS.ProcessEnv> | undefined;

/**
 * Raycast starts commands with a bare PATH, so limactl from Homebrew, mise or nix isn't found.
 * The login shell's PATH is read once, between markers, since an interactive shell may print a greeting.
 */
function limaEnv(): Promise<NodeJS.ProcessEnv> {
  env ??= (async () => {
    let shellPath = "";
    try {
      const shell = process.env.SHELL || "/bin/zsh";
      const { stdout } = await execFileAsync(shell, ["-lic", `printf '<<%s>>' "$PATH"`], { timeout: 5_000 });
      shellPath = stdout.match(/<<(.*)>>/)?.[1] ?? "";
    } catch {
      // Falls back to the usual places.
    }
    const path = [...shellPath.split(":"), ...FALLBACK_PATH].filter(Boolean);
    return { ...process.env, PATH: [...new Set(path)].join(":") };
  })();
  return env;
}

function limactlPath(): string {
  return getPreferenceValues<Preferences>().limactlPath?.trim() || "limactl";
}

/** limactl logs like `time="…" level=fatal msg="…"`. The last message is the one that says what went wrong. */
function lastMessage(stderr: string): string | undefined {
  const messages = [...stderr.matchAll(/msg="((?:[^"\\]|\\.)*)"/g)].map((match) => match[1].replace(/\\"/g, '"'));
  return messages.at(-1) ?? (stderr.trim().split("\n").at(-1) || undefined);
}

async function limactl(args: string[]): Promise<string> {
  const command = limactlPath();
  try {
    const { stdout } = await execFileAsync(command, args, { env: await limaEnv(), maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string };
    if (failure.code === "ENOENT") {
      throw new NotInstalledError(
        command === "limactl"
          ? "Couldn't find limactl. Install Lima, or set where limactl is in the preferences."
          : `Couldn't find limactl at ${command}. Check the path in the preferences.`,
      );
    }
    throw new Error(lastMessage(failure.stderr ?? "") ?? failure.message);
  }
}

export async function listInstances(): Promise<Instance[]> {
  const stdout = await limactl(["list", "--format", "json"]);
  return stdout
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Instance);
}

export async function listTemplates(): Promise<string[]> {
  const stdout = await limactl(["create", "--list-templates"]);
  return stdout.split("\n").filter(Boolean);
}

// --tty=false everywhere: there's no terminal to answer limactl's prompts in.

export async function startInstance(name: string): Promise<void> {
  await limactl(["start", "--tty=false", name]);
}

export async function stopInstance(name: string): Promise<void> {
  await limactl(["stop", name]);
}

export async function restartInstance(name: string): Promise<void> {
  await limactl(["restart", "--tty=false", name]);
}

export async function deleteInstance(name: string): Promise<void> {
  await limactl(["delete", "--force", name]);
}

export interface NewInstance {
  name: string;
  /** What to create from, as limactl takes it: `template:default`, or the path of a manifest. */
  source: string;
  cpus?: number;
  /** GiB. */
  memory?: number;
  /** GiB. */
  disk?: number;
  vmType?: string;
}

export async function createInstance(instance: NewInstance): Promise<void> {
  const args = ["create", "--tty=false", `--name=${instance.name}`];
  if (instance.cpus) args.push(`--cpus=${instance.cpus}`);
  if (instance.memory) args.push(`--memory=${instance.memory}`);
  if (instance.disk) args.push(`--disk=${instance.disk}`);
  if (instance.vmType) args.push(`--vm-type=${instance.vmType}`);
  await limactl([...args, instance.source]);
}

/** When Lima made the instance: its lima.yaml is written then and never again. */
export async function createdAt(instance: Instance): Promise<number | undefined> {
  try {
    return (await stat(join(instance.dir, "lima.yaml"))).birthtimeMs;
  } catch {
    return undefined;
  }
}

/** Lima's own rule for instance names. */
export const NAME_PATTERN = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/;

/** Opens a new window in the terminal from the preferences and runs `limactl shell` there. */
export async function openShell(name: string): Promise<void> {
  // The name already matches NAME_PATTERN, so only the path may need quoting.
  const path = limactlPath();
  const limactl = path === "limactl" ? path : `'${path.replace(/'/g, `'\\''`)}'`;
  const command = `${limactl} shell ${name}`.replace(/[\\"]/g, "\\$&");
  if (getPreferenceValues<Preferences>().terminal === "iTerm") {
    await runAppleScript(`
      tell application "iTerm"
        activate
        set newWindow to (create window with default profile)
        tell current session of newWindow to write text "${command}"
      end tell`);
    return;
  }
  await runAppleScript(`
    tell application "Terminal"
      activate
      do script "${command}"
    end tell`);
}
