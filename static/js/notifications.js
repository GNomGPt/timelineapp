import { setNotificationsEnabled, getState } from "./dataStore.js";

let permission = Notification?.permission ?? "default";
let enabled = getState().notificationsEnabled ?? false;

function ensurePermission() {
  if (!("Notification" in window)) return Promise.resolve(false);
  if (permission === "granted") return Promise.resolve(true);
  if (permission === "denied") return Promise.resolve(false);
  return Notification.requestPermission().then(result => {
    permission = result;
    return result === "granted";
  });
}

export function toggleNotifications(callback) {
  if (enabled) {
    enabled = false;
    setNotificationsEnabled(false);
    callback?.(false);
    return;
  }
  ensurePermission().then(granted => {
    enabled = granted;
    setNotificationsEnabled(granted);
    callback?.(granted);
  });
}

export function notify(title, options = {}) {
  if (!enabled || !("Notification" in window) || permission !== "granted") {
    spawnInlineNotification(title, options.body);
    return;
  }
  new Notification(title, options);
}

function spawnInlineNotification(title, body) {
  const wrapper = document.createElement("div");
  wrapper.className = "notification";
  wrapper.innerHTML = `<strong>${title}</strong><div>${body ?? ""}</div>`;
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => wrapper.remove());
  wrapper.append(closeBtn);
  document.body.append(wrapper);
  setTimeout(() => wrapper.remove(), 5000);
}
