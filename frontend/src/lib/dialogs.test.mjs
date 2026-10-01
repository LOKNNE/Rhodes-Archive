import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { confirmAction, showNotice } from "../../../build/test/dialogs.js";
import { clearLog, getEntries } from "../../../build/test/debugLog.js";

globalThis.window = {};
afterEach(() => { clearMocks(); clearLog(); });

test("confirmation uses the supported message command and waits for a choice", async () => {
  let finish;
  mockIPC((command, args) => {
    assert.equal(command, "plugin:dialog|message");
    assert.equal(args.buttons, "OkCancel");
    return new Promise(resolve => { finish = resolve; });
  });
  let settled = false;
  const answer = confirmAction("Test confirmation").then(value => { settled = true; return value; });
  await Promise.resolve();
  assert.equal(settled, false);
  finish("Cancel");
  assert.equal(await answer, false);
});

test("only an explicit OK authorizes the action", async () => {
  for (const choice of ["Ok", "Cancel", undefined]) {
    mockIPC(() => choice);
    assert.equal(await confirmAction("Test confirmation"), choice === "Ok");
  }
});

test("dialog transport failure cancels safely and never rejects an event handler", async () => {
  mockIPC(() => { throw new Error("command unavailable"); });
  assert.equal(await confirmAction("Test confirmation"), false);
  await assert.doesNotReject(showNotice("Test notice"));
  assert.equal(getEntries().filter(entry => entry.level === "error").length, 2);
});
