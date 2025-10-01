import { MINUTES_IN_DAY, calculateTaskSegments, deepClone, uuid } from "./utils.js";
import { wrapActiveTask } from "./taskTransformations.js";

const STORAGE_KEY = "timeline-app-state-v1";

const defaultState = {
  tasks: [],
  unpredictable: [],
  notificationsEnabled: false
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(defaultState);
    const parsed = JSON.parse(raw);
    parsed.tasks ??= [];
    parsed.unpredictable ??= [];
    parsed.notificationsEnabled ??= false;
    return parsed;
  } catch (error) {
    console.error("Failed to load state", error);
    return deepClone(defaultState);
  }
}

let state = loadState();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getState() {
  return deepClone(state);
}

export function subscribe(callback) {
  const listener = () => callback(deepClone(state));
  window.addEventListener("timeline-state", listener);
  return () => window.removeEventListener("timeline-state", listener);
}

function emit() {
  persist();
  window.dispatchEvent(new CustomEvent("timeline-state"));
}

export function addConstantTask({ name, start, end, color }) {
  const id = uuid();
  const startMinutes = start;
  const endMinutes = end;
  const duration = (endMinutes - startMinutes + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const task = {
    id,
    type: "constant",
    name,
    start: startMinutes,
    end: startMinutes + duration,
    duration,
    color,
    createdAt: Date.now()
  };
  state.tasks.push(task);
  emit();
  return id;
}

export function addActiveTask(payload) {
  const id = uuid();
  const start = payload.start;
  const task = {
    id,
    type: "active",
    name: payload.name,
    start,
    cycles: payload.cycles,
    cycleDuration: payload.cycleDuration,
    restDuration: payload.restDuration,
    breakInterval: payload.breakInterval,
    breakDuration: payload.breakDuration,
    color: payload.color,
    restColor: payload.restColor,
    breakColor: payload.breakColor,
    segmentNames: payload.segmentNames ?? {},
    createdAt: Date.now()
  };
  const segments = calculateTaskSegments({ ...task, start });
  task.end = segments[segments.length - 1]?.end ?? start;
  task.duration = task.end - task.start;
  task.segments = segments.map(segment => ({
    type: segment.type,
    name: segment.name,
    relativeStart: segment.start - task.start,
    relativeEnd: segment.end - task.start
  }));
  const constants = state.tasks.filter(item => item.type === "constant");
  const wrappedTask = wrapActiveTask(task, constants);
  state.tasks.push(wrappedTask);
  emit();
  return id;
}

export function updateTask(id, updater) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  const updated = updater(deepClone(task));
  if (!updated) return;
  Object.assign(task, updated);
  emit();
}

export function replaceTask(id, replacement) {
  const index = state.tasks.findIndex(task => task.id === id);
  if (index === -1) return;
  state.tasks[index] = replacement;
  emit();
}

export function removeTask(id) {
  state.tasks = state.tasks.filter(task => task.id !== id);
  emit();
}

export function setNotificationsEnabled(enabled) {
  state.notificationsEnabled = enabled;
  emit();
}

export function logUnpredictableTask(task) {
  state.unpredictable.push({
    id: uuid(),
    description: task.description,
    duration: task.duration,
    occurredAt: Date.now()
  });
  emit();
}

export function getTaskById(id) {
  return deepClone(state.tasks.find(task => task.id === id));
}

export function reorderTask(id, start) {
  updateTask(id, task => {
    const offset = start - task.start;
    task.start = start;
    task.end = task.end + offset;
    task.segments = task.segments.map(segment => ({
      ...segment,
      relativeStart: segment.relativeStart,
      relativeEnd: segment.relativeEnd
    }));
    return task;
  });
}

export function saveTask(task) {
  let prepared = task;
  if (task.type === "active") {
    const constants = state.tasks
      .filter(item => item.type === "constant" || item.id === task.id)
      .filter(item => item.id !== task.id);
    prepared = wrapActiveTask(task, constants);
  }
  const index = state.tasks.findIndex(existing => existing.id === task.id);
  if (index === -1) {
    state.tasks.push(prepared);
  } else {
    state.tasks[index] = prepared;
  }
  emit();
}
