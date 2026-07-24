/**
 * Auto-send Claude Reports
 * -------------------------
 * Owner / executing account : info.cclpartners@gmail.com
 * Monitored Drafts folder    : info.cclpartners@gmail.com
 * Auto-send recipient        : yaz3.14@gmail.com
 *
 * A Gmail draft is sent automatically ONLY when ALL of the following are true:
 *   1. The "To" field is exactly   yaz3.14@gmail.com
 *   2. There are no other recipients in "To"
 *   3. "Cc"  is empty
 *   4. "Bcc" is empty
 *
 * Any draft that does not meet all four conditions is left completely
 * untouched (never modified, deleted, archived, labeled, or forwarded).
 *
 * Matching is a strict, whole-field equality check. It deliberately does NOT
 * use includes() or any partial / substring matching.
 */

/**
 * Scans every Gmail draft in the executing account and sends the ones whose
 * complete recipient configuration is exactly:
 *
 *     To:  yaz3.14@gmail.com
 *     Cc:  (empty)
 *     Bcc: (empty)
 *
 * This is the function that the 1-minute time-driven trigger runs.
 */
function sendDraftsToYas() {
  const TARGET_EMAIL = "yaz3.14@gmail.com";

  const drafts = GmailApp.getDrafts();

  for (const draft of drafts) {
    const message = draft.getMessage();

    const to = message.getTo().trim().toLowerCase();
    const cc = message.getCc().trim();
    const bcc = message.getBcc().trim();

    if (
      to === TARGET_EMAIL &&
      cc === "" &&
      bcc === ""
    ) {
      // Send via the Gmail Advanced Service (Gmail API) instead of
      // GmailApp's draft.send(). Drafts created through the Gmail API
      // (e.g. reports Claude creates via the Gmail connector) can be READ
      // by GmailApp but throw "Gmail operation not allowed." from
      // GmailDraft.send() — see https://issuetracker.google.com/issues/383141574
      // Sending the draft by its ID through the Gmail API works for both
      // GmailApp-created and API-created drafts. The recipient match above is
      // unchanged, so the exact-recipient safety guarantee still holds.
      try {
        Gmail.Users.Drafts.send({ id: draft.getId() }, "me");
        console.log(`Sent: ${message.getSubject()}`);
      } catch (err) {
        console.log(
          `FAILED to send draft (subject: "${message.getSubject()}", id: ${draft.getId()}): ${err.message}`
        );
      }
    }
  }
}

/**
 * Creates the installable, time-driven trigger that runs sendDraftsToYas
 * every minute.
 *
 * This is safe to run more than once: if a trigger for sendDraftsToYas
 * already exists, it is kept and NO duplicate trigger is created.
 *
 * Run this function once from the Apps Script editor (Run > createEveryMinuteTrigger)
 * to (a) grant the Gmail + ScriptApp authorization and (b) install the trigger.
 */
function createEveryMinuteTrigger() {
  const FUNCTION_NAME = "sendDraftsToYas";

  const existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === FUNCTION_NAME;
  });

  if (existing.length > 0) {
    console.log(
      "Trigger already exists for " +
        FUNCTION_NAME +
        " (count: " +
        existing.length +
        "). No new trigger created."
    );
    return;
  }

  ScriptApp.newTrigger(FUNCTION_NAME)
    .timeBased()
    .everyMinutes(1)
    .create();

  console.log("Created 1-minute trigger for " + FUNCTION_NAME + ".");
}

/**
 * Lists every trigger installed in this project. Use this to verify that
 * exactly one 1-minute trigger for sendDraftsToYas exists.
 */
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  console.log("Total triggers: " + triggers.length);
  triggers.forEach(function (t, i) {
    console.log(
      "#" +
        (i + 1) +
        " handler=" +
        t.getHandlerFunction() +
        " eventType=" +
        t.getEventType() +
        " source=" +
        t.getTriggerSource() +
        " id=" +
        t.getUniqueId()
    );
  });
}

/**
 * Removes duplicate triggers for sendDraftsToYas, keeping exactly one.
 * Only needed if duplicate triggers were accidentally created.
 */
function dedupeTriggers() {
  const FUNCTION_NAME = "sendDraftsToYas";

  const triggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === FUNCTION_NAME;
  });

  for (let i = 1; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
    console.log("Deleted duplicate trigger id=" + triggers[i].getUniqueId());
  }

  console.log(
    "Kept " +
      Math.min(triggers.length, 1) +
      " trigger(s) for " +
      FUNCTION_NAME +
      "."
  );
}

/**
 * DIAGNOSTIC ONLY — this function never sends, deletes, or modifies anything.
 *
 * It logs:
 *   - the remaining daily Gmail send quota,
 *   - every draft that currently matches the auto-send criteria (id / subject /
 *     from / date only — no body is read out), and
 *   - the installed triggers for sendDraftsToYas.
 *
 * Use it to troubleshoot the "Gmail operation not allowed" error without
 * sending any email.
 */
function diagnose() {
  const TARGET_EMAIL = "yaz3.14@gmail.com";

  try {
    console.log("Remaining daily email quota: " + MailApp.getRemainingDailyQuota());
  } catch (e) {
    console.log("Could not read daily quota: " + e.message);
  }

  const drafts = GmailApp.getDrafts();
  console.log("Total drafts in this account: " + drafts.length);

  let matches = 0;
  for (const draft of drafts) {
    const message = draft.getMessage();
    const to = message.getTo().trim().toLowerCase();
    const cc = message.getCc().trim();
    const bcc = message.getBcc().trim();
    if (to === TARGET_EMAIL && cc === "" && bcc === "") {
      matches++;
      console.log(
        "MATCH -> draftId=" + draft.getId() +
          ' | subject="' + message.getSubject() + '"' +
          " | from=" + message.getFrom() +
          " | date=" + message.getDate()
      );
    }
  }
  console.log(
    "Drafts matching the auto-send criteria: " +
      matches +
      " (these are the ones sendDraftsToYas would send)"
  );

  const triggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === "sendDraftsToYas";
  });
  console.log("Installed triggers for sendDraftsToYas: " + triggers.length);
  triggers.forEach(function (t, i) {
    console.log(
      "  trigger#" + (i + 1) + " id=" + t.getUniqueId() + " eventType=" + t.getEventType()
    );
  });
}
