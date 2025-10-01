import { getState, saveTask, logUnpredictableTask } from "./dataStore.js";
import { minutesToTime } from "./utils.js";

const currentLabel = document.getElementById("current-task");
const nextLabel = document.getElementById("next-task");
const ring = document.getElementById("progress-ring");
const timerLabel = document.getElementById("timer-label");

const startBtn = document.getElementById("start-timer");
const pauseBtn = document.getElementById("pause-timer");
const stopBtn = document.getElementById("stop-timer");
const unpredictableBtn = document.getElementById("unpredictable-button");

let timerState = {
  running: false,
  remainingMs: 0,
  totalMs: 0,
  currentTaskId: null,
  currentSegmentName: "",
  endTimestamp: 0
};

function init() {
  const state = getState();
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const tasks = state.tasks
    .map(task => ({
      ...task,
      segments:
        task.segments?.map(segment => ({
          ...segment,
          start: task.start + (segment.relativeStart ?? 0),
          end: task.start + (segment.relativeEnd ?? 0)
        })) ?? [
          {
            name: task.name,
            start: task.start,
            end: task.end,
            type: task.type
          }
        ]
    }))
    .sort((a, b) => a.start - b.start);
  const current = tasks.find(task => task.start <= minutes && task.end > minutes);
  const next = tasks.find(task => task.start > minutes);
  if (current) {
    const segment = current.segments.find(segment => segment.start <= minutes && segment.end > minutes);
    startTimer(current, segment, minutes);
  }
  currentLabel.textContent = current ? `${current.name}` : "Нет задачи";
  nextLabel.textContent = next ? `${next.name} в ${minutesToTime(next.start)}` : "Нет";
}

function startTimer(task, segment, nowMinutes) {
  const segmentDuration = segment ? segment.end - segment.start : task.duration ?? 0;
  const remainingMinutes = segment ? segment.end - nowMinutes : segmentDuration;
  const remainingMs = Math.max(0, remainingMinutes * 60000);
  const totalMs = Math.max(0, segmentDuration * 60000);
  timerState = {
    running: true,
    remainingMs,
    totalMs,
    currentTaskId: task.id,
    currentSegmentName: segment?.name ?? task.name,
    endTimestamp: Date.now() + remainingMs
  };
  updateTimerLabel();
}

function updateTimerLabel() {
  const remainingMs = timerState.running
    ? Math.max(0, timerState.endTimestamp - Date.now())
    : timerState.remainingMs;
  timerState.remainingMs = remainingMs;
  const totalMs = timerState.totalMs || 1;
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  timerLabel.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
  const progress = totalMs ? remainingMs / totalMs : 0;
  ring.style.strokeDashoffset = `${326.72 * (1 - progress)}`;
}

let tickInterval = null;

function startTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    updateTimerLabel();
  }, 1000);
}

startBtn.addEventListener("click", () => {
  if (timerState.remainingMs <= 0) return;
  timerState.running = true;
  timerState.endTimestamp = Date.now() + timerState.remainingMs;
  if (!tickInterval) startTick();
});

pauseBtn.addEventListener("click", () => {
  timerState.running = false;
});

stopBtn.addEventListener("click", () => {
  timerState.running = false;
  timerState.remainingMs = timerState.totalMs;
  updateTimerLabel();
});

unpredictableBtn.addEventListener("click", () => {
  timerState.running = false;
  const description = prompt("Опишите непредсказуемую задачу");
  if (!description) return;
  const spentMinutes = Math.round((timerState.totalMs - timerState.remainingMs) / 60000);
  logUnpredictableTask({ description, duration: spentMinutes });
  alert("Непредсказуемая задача зарегистрирована");
});

init();
startTick();
