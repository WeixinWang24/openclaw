---
name: obsidian
description: Work with Obsidian vaults (plain Markdown notes) and automate via the local `obsidian` command.
homepage: https://help.obsidian.md
metadata:
  {
    "openclaw":
      {
        "emoji": "💎",
        "requires": { "bins": ["obsidian"] },
        "install":
          [
            {
              "id": "local-obsidian-cli",
              "kind": "manual",
              "bins": ["obsidian"],
              "label": "Install or expose the local `obsidian` command",
            },
          ],
      },
  }
---

# Obsidian

Obsidian vault = a normal folder on disk.

Vault structure (typical)

- Notes: `*.md` (plain text Markdown; edit with any editor)
- Config: `.obsidian/` (workspace + plugin settings; usually don’t touch from scripts)
- Canvases: `*.canvas` (JSON)
- Attachments: whatever folder you chose in Obsidian settings (images/PDFs/etc.)

## Find the active vault(s)

Obsidian desktop tracks vaults here (source of truth):

- `~/Library/Application Support/obsidian/obsidian.json`

The local `obsidian` command works against the running Obsidian app and supports explicit vault targeting via:

- `vault="<vault-name>"`

Fast “what vault is active / where are the notes?”

- `obsidian vault`
- `obsidian vault info=path`
- `obsidian vaults`
- Otherwise, read `~/Library/Application Support/obsidian/obsidian.json` and use the vault entry with `"open": true`.

Notes

- Multiple vaults are common (iCloud vs `~/Documents`, work/personal, etc.). Don’t guess; inspect `obsidian vaults` or the Obsidian config.
- Avoid hardcoded vault paths in scripts; prefer `vault="..."` or reading the Obsidian config.

## Local `obsidian` command quick start

Vault selection

- Most commands accept `vault="<vault-name>"`
- If omitted, commands usually act on the currently active vault

Search

- `obsidian search query="query"`
- `obsidian search:context query="query"`

Read

- `obsidian read path="Folder/Note.md"`
- `obsidian file path="Folder/Note.md"`

Create

- `obsidian create path="Folder/New note.md" content="..." open`
- Requires the local Obsidian app to be installed and responsive.

Move/rename (safe refactor)

- `obsidian move path="old/path/note.md" to="new/path/note.md"`
- `obsidian rename path="Folder/Note.md" name="New name.md"`
- Prefer these over raw `mv` when you want Obsidian-aware note operations.

Append / prepend

- `obsidian append path="Folder/Note.md" content="..."`
- `obsidian prepend path="Folder/Note.md" content="..."`

Delete

- `obsidian delete path="Folder/Note.md"`

Open / UI integration

- `obsidian open path="Folder/Note.md"`
- `obsidian daily`
- `obsidian command id="..."`

Prefer direct edits when appropriate: open the `.md` file and change it; Obsidian will pick it up. When using the CLI, prefer the local `obsidian` command syntax over the older `obsidian-cli` examples.
