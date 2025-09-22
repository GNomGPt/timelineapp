import { addActiveTask, addConstantTask, getState, subscribe, logUnpredictableTask } from "./dataStore.js";
import { timeToMinutes } from "./utils.js";
import { renderTasks, requestPriorityResolution } from "./timeline.js";
import { toggleNotifications, notify } from "./notifications.js";

const constantForm = document.getElementById("constant-task-form");
const activeForm = document.getElementById("active-task-form");
const timelineOrientationInputs = document.querySelectorAll('input[name="timeline-orientation"]');
const notifyToggleBtn = document.getElementById("notify-toggle");
const openTimerBtn = document.getElementById("open-timer");
const unpredictableList = document.getElementById("unpredictable-list");

let orientation = "horizontal";

function parseTaskForm(form) {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

constantForm.addEventListener("submit", event => {
  event.preventDefault();
  const data = parseTaskForm(constantForm);
  const start = timeToMinutes(data.start);
  const end = timeToMinutes(data.end);
  addConstantTask({
    name: data.name,
    start,
    end,
    color: data.color
  });
  constantForm.reset();
});

activeForm.addEventListener("submit", event => {
  event.preventDefault();
  const data = parseTaskForm(activeForm);
  const start = timeToMinutes(data.start);
  const cycles = Number(data.cycles);
  const cycleDuration = Number(data.cycleDuration);
  const restDuration = Number(data.restDuration);
  const breakInterval = Number(data.breakInterval);
  const breakDuration = Number(data.breakDuration);
  const segmentNames = {
    cycles: Array.from({ length: cycles }, (_, index) => `${data.name} цикл ${index + 1}`)
  };
  addActiveTask({
    name: data.name,
    start,
    cycles,
    cycleDuration,
    restDuration,
    breakInterval,
    breakDuration,
    color: data.color,
    restColor: data.restColor,
    breakColor: data.breakColor,
    segmentNames
  });
  activeForm.reset();
});

function render(state) {
  renderTasks(state.tasks, orientation);
  requestPriorityResolution(state.tasks, orientation);
  renderUnpredictable(state.unpredictable);
}

function renderUnpredictable(items) {
  unpredictableList.innerHTML = "";
  const weekly = aggregateWeekly(items);
  weekly.forEach(entry => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${entry.description}</strong><div>Количество: ${entry.count}</div><div>Сумма: ${entry.total} мин</div>`;
    if (entry.suggested) {
      const suggestion = document.createElement("div");
      suggestion.textContent = "Предложение: Добавить в постоянные задачи";
      li.append(suggestion);
    }
    unpredictableList.append(li);
  });
}

function aggregateWeekly(items) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const map = new Map();
  items
    .filter(item => item.occurredAt >= weekAgo)
    .forEach(item => {
      const record = map.get(item.description) ?? { description: item.description, count: 0, total: 0 };
      record.count += 1;
      record.total += item.duration;
      map.set(item.description, record);
    });
  return Array.from(map.values()).map(entry => ({
    ...entry,
    suggested: entry.count >= 3
  }));
}

timelineOrientationInputs.forEach(input => {
  input.addEventListener("change", () => {
    orientation = input.value;
    const state = getState();
    render(state);
  });
});

notifyToggleBtn.addEventListener("click", () => {
  toggleNotifications(enabled => {
    notify("Уведомления", { body: enabled ? "Включены" : "Отклонены" });
  });
});

openTimerBtn.addEventListener("click", () => {
  window.open("timer.html", "_blank");
});

subscribe(render);
render(getState());

window.addEventListener("storage", () => render(getState()));

window.timelineApi = {
  logUnpredictableTask
};
