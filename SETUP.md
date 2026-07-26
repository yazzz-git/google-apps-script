# Auto-send Claude Reports — Setup & Operations

Google Apps Script that automatically sends Gmail drafts created in
`info.cclpartners@gmail.com` **only** when the draft is addressed exclusively to
`yaz3.14@gmail.com`.

## What it does

Every minute, a time-driven trigger runs `sendDraftsToYas()`. For each Gmail
draft in the executing account, the draft is sent **only if all four** of these
are true:

1. `To` is exactly `yaz3.14@gmail.com`
2. No other recipients are in `To`
3. `Cc` is empty
4. `Bcc` is empty

Any draft that fails any condition is left completely untouched — not modified,
deleted, archived, labeled, or forwarded. Matching is strict whole-field
equality (no `includes()`, no partial matching).

## Accounts

| Role                                   | Account                     |
| -------------------------------------- | --------------------------- |
| Owns & executes the Apps Script        | `info.cclpartners@gmail.com`|
| Gmail Drafts folder that is monitored  | `info.cclpartners@gmail.com`|
| Recipient that triggers auto-send      | `yaz3.14@gmail.com`         |

> The Apps Script must **not** be created or authorized under
> `yaz3.14@gmail.com`.

## Project layout

```
google-apps-script/
├── .clasp.json          # created by `clasp create-script` (holds scriptId + rootDir=src)
├── .claspignore
├── .gitignore
├── SETUP.md             # this file
└── src/
    ├── appsscript.json  # manifest (timezone, runtime, OAuth scopes)
    └── Code.js          # sendDraftsToYas + trigger helpers
```

## OAuth scopes requested (and why)

Declared in `src/appsscript.json`:

- `https://mail.google.com/` — read Gmail drafts and send the qualifying draft
  (this is the scope Apps Script's `GmailApp` uses for read + send).
- `https://www.googleapis.com/auth/script.scriptapp` — create and manage the
  time-driven trigger.

No other scopes are requested.

## One-time setup with clasp

All commands run from the repository root.

```bash
# 1. Install clasp (once)
npm install -g @google/clasp

# 2. Log in as info.cclpartners@gmail.com
clasp login            # opens a browser; sign in as info.cclpartners@gmail.com
clasp show-authorized-user   # confirm the correct account

# 3. Create the standalone project (writes .clasp.json with the scriptId)
clasp create-script --type standalone --title "Auto-send Claude Reports" --rootDir src

# 4. Push the code
clasp push
```

### Enable the Apps Script API (once per Google account)

If `clasp create-script` fails with a "User has not enabled the Apps Script API"
error, open:

<https://script.google.com/home/usersettings>

…while signed in as `info.cclpartners@gmail.com`, turn **Google Apps Script API**
**ON**, then re-run the create/push commands.

## Install the 1-minute trigger + grant Gmail authorization

Triggers can only be created from inside Apps Script (there is no CLI/API call
that installs an installable trigger without executing project code). Do this
once in the editor:

```bash
clasp open-script      # opens the Apps Script editor in the browser
```

In the editor (signed in as `info.cclpartners@gmail.com`):

1. Select the function `createEveryMinuteTrigger` in the toolbar dropdown.
2. Click **Run**.
3. Approve the OAuth consent screen **as `info.cclpartners@gmail.com`**. This
   single consent grants both the Gmail and trigger permissions.

`createEveryMinuteTrigger()` is idempotent: if a `sendDraftsToYas` trigger
already exists it keeps it and does **not** create a duplicate.

To verify the trigger from the editor, run `listTriggers` and read the
execution log (**View > Logs**). You should see exactly one entry with
`handler=sendDraftsToYas`.

## Day-to-day use

To have a report delivered automatically, create a Gmail draft in
`info.cclpartners@gmail.com` addressed **only** to `yaz3.14@gmail.com` (leave
`Cc` and `Bcc` empty). The trigger sends it within ~1 minute. Any draft with a
different/extra recipient, or any `Cc`/`Bcc`, is ignored.

## Maintaining the code later

```bash
clasp pull      # fetch remote into src/
# edit src/Code.js
clasp push      # push changes back
```

## Functions in `src/Code.js`

| Function                   | Purpose                                                        |
| -------------------------- | ------------------------------------------------------------- |
| `sendDraftsToYas`          | The scanner the trigger runs every minute.                    |
| `createEveryMinuteTrigger` | Installs the 1-minute trigger (idempotent, no duplicates).    |
| `listTriggers`             | Logs all installed triggers (verification).                   |
| `dedupeTriggers`           | Deletes duplicate `sendDraftsToYas` triggers, keeping one.    |
| `diagnose`                 | Read-only troubleshooting: logs quota, matching drafts, triggers. Sends nothing. |

## Sending mechanism & rate limits (important)

`sendDraftsToYas` sends each qualifying draft with `draft.send()`, wrapped in a
`try/catch`.

Why the `try/catch` matters: sending **many** drafts in quick succession (for
example, clearing a backlog) can trip Gmail's send-rate throttle, which surfaces
as `Exception: Gmail operation not allowed.` Without error handling, that
exception crashes the whole run part-way through the batch. With the `try/catch`,
a throttled draft is **left untouched** and simply retried on the next 1-minute
run — the run never crashes, and no draft is ever modified. The exact-recipient
matching that decides *whether* to send is unchanged.

Consumer Gmail also has a **daily send cap** (~100 recipients/day for
`@gmail.com` accounts). Normal operation (a few reports per day) is far below it;
the cap only becomes relevant if a large backlog is flushed at once. Use
`diagnose()` to log the remaining daily quota.

> Note: an earlier version of this script sent via the Gmail Advanced Service to
> work around Apps Script [Issue #383141574](https://issuetracker.google.com/issues/383141574)
> (API-created drafts failing `GmailDraft.send()`). That was reverted after
> `draft.send()` proved to send API-created drafts correctly in this account —
> the observed failures were send-rate throttling, not that bug.
