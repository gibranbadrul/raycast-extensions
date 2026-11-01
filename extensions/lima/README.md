# Lima

Start, stop and open your [Lima](https://lima-vm.io) virtual machines, create them from templates, and run your own `lima.yaml` manifests, in a keyboard-first split view: the list on the left, the selected one on the right.

## Setup

Install Lima, like with `brew install lima`. The extension finds `limactl` on your login shell's PATH, so Homebrew, mise and nix installs all work. If it can't, set **limactl Path** in the extension's preferences.

## Commands

| Command         | Shows                                                       |
| --------------- | ----------------------------------------------------------- |
| Instances       | Your instances, grouped by status, with their resources     |
| Create Instance | A quick instance from one of Lima's templates               |
| Run Manifest    | Your own `lima.yaml` files, with the instance each one made |

## Manifests

A manifest is a `lima.yaml` of your own: what an instance builds on, its sizes, mounts, ports and provision scripts. Keep them in one folder, `~/lima` unless you set **Manifests Folder** in the preferences, and Run Manifest lists them.

- **One file, one instance.** The instance is named after the file: `dev.yaml` makes `dev`. So each row knows its instance and shows whether it's running, stopped or not created yet.
- **↵ follows the state**: Run (create, then start), Start, or Open Shell.
- **⌘↵ Run with Changes** opens the manifest's values in a form, to run a second copy (`dev-2`) or a bigger one. Changed fields override the file; the file stays as it is.
- **⌘N New Manifest** writes a file that builds on a template, with the usual settings written out but commented, and opens it in your editor.
- **⌥⌘O Run File…** runs a manifest from anywhere.

Lima copies a manifest when it creates the instance, so editing the file later doesn't change the instance. When a file was saved after its instance was made, the row says **Changed** and offers **Recreate from Manifest** (⌃⇧R): it deletes the instance, disk and all, and creates it again from the file. It asks first.

Lima runs provision scripts on every boot, so keep them safe to run twice.

## Shortcuts

| Shortcut | Instances                                            | Run Manifest                          |
| -------- | ---------------------------------------------------- | ------------------------------------- |
| ↵        | Open shell (running) or start (stopped)              | Run, start or open shell              |
| ⌘↵       | Copy shell command (running) or start and open shell | Run with changes                      |
| ⇧⌘C      | Copy SSH command                                     |                                       |
| ⌘I       | Show the template's notes                            |                                       |
| ⌥⌘S      | Stop                                                 |                                       |
| ⇧⌘R      | Restart                                              |                                       |
| ⌃X       | Delete instance                                      |                                       |
| ⌃⇧R      |                                                      | Recreate from manifest (when Changed) |
| ⌘E       | Edit the instance's `lima.yaml`                      | Edit the manifest                     |
| ⇧⌘F      | Show in Finder                                       | Show in Finder                        |
| ⌘N       | Create instance: from a template or a manifest       | New manifest                          |
| ⌥⌘O      |                                                      | Run a file from anywhere              |
| ⌘R       | Refresh                                              | Refresh                               |

Open Shell runs `limactl shell` in a new Terminal or iTerm window. Pick which in the preferences.
