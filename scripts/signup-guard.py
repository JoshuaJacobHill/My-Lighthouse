#!/usr/bin/env python3
"""Put the account rules in front of whoever just wrote an account-creating file.

A rule in a document is a rule that gets skimmed. This one is worth more than
that: a sign-up form that skips the email check lets anybody who types a
donor's address claim their giving history.

So this runs after every Write or Edit and looks for the two things that
actually signal the risk — creating a user, or hashing a password — rather than
guessing from filenames. If the file does that and does NOT use the shared
check in `src/lib/account-check.ts`, it hands the rule back as context.

Deliberately not a blocker. There are legitimate reasons to touch those lines
(a seed script, an admin invite, a test), and a hook that refuses to let you
save is a hook somebody turns off. It informs; the person decides.

Run by the PostToolUse hook in .claude/settings.json.

Notes for whoever maintains this:
  - `jq` is not installed on this machine. Do not rewrite it as a jq one-liner.
  - It must never fail the tool call. Every path exits 0.
  - Silence is the normal outcome. Only an unguarded account write says anything.
"""

import json
import re
import sys
from pathlib import Path

# Creating a person, or setting a password on one. Either without the shared
# check is the thing worth a word.
RISKY = (
    re.compile(r"prisma\.user\.create\s*\("),
    re.compile(r"prisma\.user\.upsert\s*\("),
    re.compile(r"\bhashPassword\s*\("),
)

# Already doing the right thing.
#
# Matched on an actual import or call, never a bare mention of the module name.
# A first version matched the string "account-check" anywhere, and a comment
# reading "does NOT use account-check" silenced it — a false negative found by
# the probe written to test the hook, which is the best possible way to find
# one.
GUARDED = (
    re.compile(r"""from\s+['"][^'"]*account-check['"]"""),
    re.compile(r"""require\(\s*['"][^'"]*account-check['"]"""),
    re.compile(r"\bassertEmailFree\s*\("),
    re.compile(r"\blookupEmail\s*\("),
)

# The file that defines the rule, and the tests for it, obviously mention these.
EXEMPT_SUFFIXES = (
    "src/lib/account-check.ts",
    "src/lib/account-check.test.ts",
)

RULE = """This file creates a user account or sets a password, and does not use the
shared email check. Before this is finished, it needs to follow the account
rules — see docs/SECURITY.md.

The rule: proving control of an inbox is what unlocks data. Typing an address
does not. Somebody who gave $200 last year has a record here and no password;
if a form lets anyone who types that address set one, their giving history
belongs to whoever guessed the email.

Use `src/lib/account-check.ts` rather than writing this again:

    import { lookupEmail, assertEmailFree } from '@/lib/account-check'

    // Step one — what to do with an address somebody typed:
    const found = await lookupEmail(email)
    //   'account'  -> tell them on screen to sign in
    //   'history'  -> email a setup link, say nothing else on screen
    //   'new'      -> let them sign up here

    // Step two — immediately before the write, every time. Not instead of
    // step one; as well as it. A server action is directly callable, so
    // reaching here proves nothing about whether step one ran.
    const taken = await assertEmailFree(email)
    if (taken) return { success: false, error: taken }

Also required on any new sign-up flow: rate limit it (`@/lib/rate-limit`, see
the limits in signup.actions.ts), never confirm on screen that an unknown-to-
them address is known to us, and do not mark the email verified at creation —
verification is what later lets giving attach to the account.

If this file is a legitimate exception — a seed script, an admin-initiated
invite, a test — carry on; this is a note, not a refusal."""


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool_input = payload.get("tool_input") or {}
    response = payload.get("tool_response") or {}
    path_str = (
        response.get("filePath")
        or tool_input.get("file_path")
        or ""
    )
    if not path_str:
        return 0

    path = Path(path_str)
    if path.suffix not in {".ts", ".tsx"}:
        return 0
    posix = path.as_posix()
    if any(posix.endswith(s) for s in EXEMPT_SUFFIXES):
        return 0

    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return 0

    if not any(p.search(text) for p in RISKY):
        return 0
    if any(p.search(text) for p in GUARDED):
        return 0

    print(
        json.dumps(
            {
                "systemMessage": f"Account rules apply to {path.name} — see docs/SECURITY.md",
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": RULE,
                },
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
