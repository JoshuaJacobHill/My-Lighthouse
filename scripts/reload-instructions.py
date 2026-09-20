#!/usr/bin/env python3
"""Put the project's standing instructions back after a compaction.

Compaction summarises the conversation, and the summary does not reliably carry
AGENTS.md or the purpose of the app with it. A session that has lost those
keeps working but starts making reasonable-looking decisions that are wrong for
this project — a second uploader, a public route, a role comparison instead of
a capability.

So this reads them off disk and hands them back as context. Run by the
PostCompact hook in .claude/settings.json.

Two implementation notes, both learned on this machine:

  `jq` is not installed here, so the JSON is built in Python. Do not rewrite
  this as a jq one-liner.

  Paths are resolved from this file's own location, never from the working
  directory. The cwd of a session here is sometimes the repository and
  sometimes its parent, and a hook that silently reads nothing is worse than
  no hook at all.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Read in full: the laws, then what the app is for. Everything else is
# reference material and is only named, to keep this affordable.
ALWAYS = [Path("AGENTS.md"), Path("docs/PURPOSE.md")]

POINTERS = [
    ("docs/USERS.md", "roles, capabilities, the per-person switches, audience flags"),
    ("docs/INTEGRATIONS.md", "Stripe, Gap/EMC, Meta, Mailchimp, TikTok, Blob — and their gotchas"),
    ("docs/DATA.md", "schema, money in two representations, Brisbane dates, migrations, RLS"),
    ("docs/PROJECT_STATUS.md", "current progress, open tasks, handover"),
    ("docs/features/", "one file per area — WIDGETS, GIVING, EVENTS, STORIES, "
                       "DASHBOARD, REPORTS, MEDIA, FITNESS, KIOSK, ADMIN"),
]


def main() -> int:
    parts = [
        "The conversation was just compacted. These are this project's standing "
        "instructions, re-read from disk because a summary does not reliably carry "
        "them. They are authoritative — prefer them over anything recalled from the "
        "summarised conversation."
    ]

    missing = []
    for rel in ALWAYS:
        path = ROOT / rel
        try:
            parts.append(f"\n\n===== {rel} =====\n\n{path.read_text(encoding='utf-8')}")
        except OSError:
            missing.append(str(rel))

    if not parts[1:]:
        # Nothing was readable. Say so rather than injecting a bare preamble
        # that implies the instructions are present when they are not.
        print(
            json.dumps(
                {
                    "systemMessage": (
                        "PostCompact hook could not read the project instructions at "
                        f"{ROOT} — Claude is working without them."
                    )
                }
            )
        )
        return 0

    parts.append("\n\n===== Further reading, on disk, not included here =====\n")
    for rel, what in POINTERS:
        exists = "" if (ROOT / rel).exists() else "  (MISSING)"
        parts.append(f"\n- {rel} — {what}{exists}")

    if missing:
        parts.append(f"\n\nNot found on disk: {', '.join(missing)}")

    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PostCompact",
                    "additionalContext": "".join(parts),
                },
                "suppressOutput": True,
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
