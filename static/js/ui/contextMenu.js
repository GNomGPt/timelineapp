import { minutesToTime, snapToMinute } from "../utils.js";
import { saveTask, getTaskById } from "../dataStore.js";

const template = document.getElementById("context-menu-template");
let menuEl = null;

function removeMenu() {
  menuEl?.remove();
  menuEl = null;
}

export function showContextMenu(x, y, task) {
  removeMenu();
  menuEl = template.content.firstElementChild.cloneNode(true);
  menuEl.style.left = `${x}px`;
  menuEl.style.top = `${y}px`;
  const timeRange = menuEl.querySelector(".time-range");
  timeRange.textContent = `${minutesToTime(task.start)} — ${minutesToTime(task.end)}`;
  const minutesInput = menuEl.querySelector("input");
  menuEl.querySelector('[data-action="shift-minus"]').addEventListener("click", () => {
    shiftTask(task.id, -snapToMinute(Number(minutesInput.value || 0)));
  });
  menuEl.querySelector('[data-action="shift-plus"]').addEventListener("click", () => {
    shiftTask(task.id, snapToMinute(Number(minutesInput.value || 0)));
  });
  document.body.append(menuEl);
  setTimeout(() => {
    document.addEventListener("click", removeMenu, { once: true });
  });
}

function shiftTask(taskId, delta) {
  if (!delta) return;
  const task = getTaskById(taskId);
  if (!task) return;
  task.start += delta;
  task.end += delta;
  saveTask(task);
  removeMenu();
}
