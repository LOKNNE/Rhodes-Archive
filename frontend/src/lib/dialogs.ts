import { confirm, message } from "@tauri-apps/plugin-dialog";
import { pushLog } from "./debugLog.js";

/** Native dialogs are asynchronous in Tauri. Rejecting or failing to open a
 * confirmation must never authorize a deletion or a bulk download. */
export async function confirmAction(text: string): Promise<boolean> {
  try {
    return await confirm(text, { title: "方舟剧场", kind: "warning" });
  } catch (error) {
    pushLog("error", "无法打开确认弹窗，操作已取消:", error);
    return false;
  }
}

export async function showNotice(text: string): Promise<void> {
  try {
    await message(text, { title: "方舟剧场" });
  } catch (error) {
    pushLog("error", "无法显示提示:", text, error);
  }
}
