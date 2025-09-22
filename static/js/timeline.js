import { MINUTES_IN_DAY, MINUTE_PX, segmentColor, sortByStart, snapToMinute } from "./utils.js";
import { saveTask, updateTask, getTaskById, getState as getStateSnapshot } from "./dataStore.js";
import { wrapActiveTask, mixActiveTasks, toAbsoluteSegments } from "./taskTransformations.js";
import { openPriorityModal } from "./ui/priorityModal.js";
import { showContextMenu } from "./ui/contextMenu.js";

const timelineEl = document.getElementById("timeline");
const scaleEl = document.getElementById("timeline-scale");

const listeners = new Map();

function renderScale() {
  scaleEl.innerHTML = "";
  for (let hour = 0; hour < 24; hour++) {
    const marker = document.createElement("div");
    marker.textContent = `${hour.toString().padStart(2, "0")}:00`;
    scaleEl.append(marker);
  }
}

renderScale();

export function clearTimeline() {
  timelineEl.innerHTML = "";
  listeners.clear();
}

function createSegmentElement(segment, task, orientation) {
  const segmentEl = document.createElement("div");
  segmentEl.className = "segment";
  segmentEl.style.background = segmentColor(segment, task);
  const duration = segment.end - segment.start;
  if (orientation === "horizontal") {
    segmentEl.style.width = `${duration * MINUTE_PX}px`;
  } else {
    segmentEl.style.height = `${duration * MINUTE_PX}px`;
  }
  segmentEl.textContent = segment.name;
  return segmentEl;
}

function attachEvent(el, event, handler) {
  el.addEventListener(event, handler);
  listeners.set(`${event}-${el.dataset.id}`, handler);
}

function computeTaskLayout(task, orientation) {
  const width = (task.end - task.start) * MINUTE_PX;
  const height = 60;
  const top = task.type === "constant" ? 10 : 90;
  const left = task.start * MINUTE_PX;
  return {
    width,
    height,
    top,
    left,
    orientation
  };
}

function createTaskElement(task, orientation) {
  const taskEl = document.createElement("div");
  taskEl.className = "task-block";
  taskEl.dataset.id = task.id;
  taskEl.dataset.type = task.type;
  const layout = computeTaskLayout(task, orientation);
  if (orientation === "horizontal") {
    taskEl.style.width = `${layout.width}px`;
    taskEl.style.height = `${layout.height}px`;
    taskEl.style.left = `${layout.left}px`;
    taskEl.style.top = `${task.type === "constant" ? 10 : 100}px`;
  } else {
    taskEl.style.height = `${layout.width}px`;
    taskEl.style.width = `${layout.height}px`;
    taskEl.style.top = `${layout.left}px`;
    taskEl.style.left = `${task.type === "constant" ? 10 : 100}px`;
    taskEl.classList.add("vertical");
  }

  const label = document.createElement("div");
  label.className = "task-label";
  label.textContent = task.name;
  taskEl.append(label);

  let segments = toAbsoluteSegments(task);
  if (segments.length === 0) {
    segments = [
      {
        type: "constant",
        name: task.name,
        start: task.start,
        end: task.end
      }
    ];
  }
  segments.forEach(segment => {
    const segmentEl = createSegmentElement(segment, task, orientation);
    taskEl.append(segmentEl);
  });

  taskEl.addEventListener("pointerdown", event => {
    taskEl.classList.add("active-grab");
    taskEl.setPointerCapture(event.pointerId);
    startDrag(event, taskEl, task, orientation);
  });

  taskEl.addEventListener("contextmenu", event => {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY, task);
  });

  return taskEl;
}

export function renderTasks(tasks, orientation) {
  clearTimeline();
  const container = timelineEl;
  container.classList.toggle("timeline-horizontal", orientation === "horizontal");
  container.classList.toggle("timeline-vertical", orientation === "vertical");
  if (orientation === "horizontal") {
    container.style.width = `${MINUTES_IN_DAY * MINUTE_PX}px`;
    container.style.height = `220px`;
  } else {
    container.style.height = `${MINUTES_IN_DAY * MINUTE_PX}px`;
    container.style.width = `220px`;
  }
  tasks
    .slice()
    .sort(sortByStart)
    .forEach(task => {
      const taskEl = createTaskElement(task, orientation);
      container.append(taskEl);
    });
}

function startDrag(event, element, task, orientation) {
  const startPos = orientation === "horizontal" ? event.clientX : event.clientY;
  const originalStart = task.start;

  const handleMove = moveEvent => {
    const delta = (orientation === "horizontal" ? moveEvent.clientX : moveEvent.clientY) - startPos;
    const minuteDelta = snapToMinute(delta / MINUTE_PX);
    const newStart = Math.max(0, Math.min(MINUTES_IN_DAY - 1, originalStart + minuteDelta));
    const offset = newStart - task.start;
    if (orientation === "horizontal") {
      element.style.left = `${(task.start + offset) * MINUTE_PX}px`;
    } else {
      element.style.top = `${(task.start + offset) * MINUTE_PX}px`;
    }
    updateDragOutline(element, true);
    dragState.currentStart = newStart;
  };

  const handleUp = upEvent => {
    element.classList.remove("active-grab");
    element.releasePointerCapture(upEvent.pointerId);
    element.removeEventListener("pointermove", handleMove);
    element.removeEventListener("pointerup", handleUp);
    element.removeEventListener("pointercancel", handleUp);
    updateDragOutline(element, false);

    if (dragState.currentStart === undefined) return;
    const targetStart = dragState.currentStart;
    onTaskMoved(task.id, targetStart);
    dragState.currentStart = undefined;
  };

  element.addEventListener("pointermove", handleMove);
  element.addEventListener("pointerup", handleUp);
  element.addEventListener("pointercancel", handleUp);
}

const dragState = {
  currentStart: undefined
};

function updateDragOutline(element, dragging) {
  element.classList.toggle("active-grab", dragging);
}

function onTaskMoved(taskId, newStart) {
  const task = getTaskById(taskId);
  if (!task) return;
  const originalStart = task.start;
  if (newStart === originalStart) return;
  const offset = newStart - originalStart;
  const newTask = adjustTaskStart(task, offset);
  saveTask(newTask);
}

function adjustTaskStart(task, offset) {
  let updated = { ...task };
  updated.start += offset;
  updated.end += offset;
  if (task.type === "active") {
    updated.segments = task.segments.map(segment => ({ ...segment }));
    updated = resolveWrapping(updated);
  }
  return updated;
}

function resolveWrapping(task) {
  const constantsData = getStateSnapshot().tasks.filter(item => item.type === "constant");
  return wrapActiveTask(task, constantsData);
}

export function mixTasks(primaryTaskId, secondaryTaskId, direction = "forward") {
  const primary = getTaskById(primaryTaskId);
  const secondary = getTaskById(secondaryTaskId);
  if (!primary || !secondary) return;
  const { primary: updatedPrimary, secondary: updatedSecondary } = mixActiveTasks(
    direction === "forward" ? primary : secondary,
    direction === "forward" ? secondary : primary,
    direction === "forward"
  );
  saveTask(updatedPrimary);
  saveTask(updatedSecondary);
}

export function detectTaskCollisions(tasks) {
  const activeTasks = tasks.filter(task => task.type === "active");
  const collisions = [];
  activeTasks.forEach((task, index) => {
    for (let i = index + 1; i < activeTasks.length; i++) {
      const other = activeTasks[i];
      if (task.end <= other.start || other.end <= task.start) continue;
      collisions.push([task, other]);
    }
  });
  return collisions;
}

export function requestPriorityResolution(tasks, orientation) {
  const collisions = detectTaskCollisions(tasks);
  if (collisions.length === 0) return;
  const [first] = collisions;
  openPriorityModal(first[0], first[1], result => {
    const direction = result.direction ?? "forward";
    mixTasks(result.primaryId, result.secondaryId, direction);
  });
}
