import { MINUTES_IN_DAY, MINUTE_PX, segmentColor, sortByStart, snapToMinute } from "./utils.js";
import { saveTask, updateTask, getTaskById, getState as getStateSnapshot } from "./dataStore.js";
import { wrapActiveTask, mixActiveTasks, toAbsoluteSegments } from "./taskTransformations.js";
import { openPriorityModal } from "./ui/priorityModal.js";
import { showContextMenu } from "./ui/contextMenu.js";

const timelineEl = document.getElementById("timeline");
const scaleEl = document.getElementById("timeline-scale");
const scaleContainer = document.querySelector(".timeline-scale-container");
const timelineWrapper = document.querySelector(".timeline-wrapper");

let isSyncingScroll = false;

if (timelineWrapper && scaleContainer) {
  timelineWrapper.addEventListener("scroll", () => {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    if (scaleContainer.classList.contains("is-horizontal")) {
      scaleContainer.scrollLeft = timelineWrapper.scrollLeft;
    }
    if (scaleContainer.classList.contains("is-vertical")) {
      scaleContainer.scrollTop = timelineWrapper.scrollTop;
    }
    isSyncingScroll = false;
  });

  scaleContainer.addEventListener("scroll", () => {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    if (scaleContainer.classList.contains("is-horizontal")) {
      timelineWrapper.scrollLeft = scaleContainer.scrollLeft;
    }
    if (scaleContainer.classList.contains("is-vertical")) {
      timelineWrapper.scrollTop = scaleContainer.scrollTop;
    }
    isSyncingScroll = false;
  });
}

const listeners = new Map();

function renderScale(orientation) {
  scaleEl.innerHTML = "";
  scaleEl.classList.toggle("scale-horizontal", orientation === "horizontal");
  scaleEl.classList.toggle("scale-vertical", orientation === "vertical");
  const hourSize = 60 * MINUTE_PX;
  if (scaleContainer) {
    scaleContainer.classList.toggle("is-horizontal", orientation === "horizontal");
    scaleContainer.classList.toggle("is-vertical", orientation === "vertical");
  }
  if (orientation === "horizontal") {
    scaleEl.style.width = `${MINUTES_IN_DAY * MINUTE_PX}px`;
    scaleEl.style.height = "48px";
    if (scaleContainer) {
      scaleContainer.scrollTop = 0;
    }
  } else {
    scaleEl.style.height = `${MINUTES_IN_DAY * MINUTE_PX}px`;
    scaleEl.style.width = `180px`;
    if (scaleContainer) {
      scaleContainer.scrollLeft = 0;
    }
  }
  for (let hour = 0; hour < 24; hour++) {
    const marker = document.createElement("div");
    marker.className = "scale-hour";
    marker.textContent = `${hour.toString().padStart(2, "0")}:00`;
    if (orientation === "horizontal") {
      marker.style.width = `${hourSize}px`;
    } else {
      marker.style.height = `${hourSize}px`;
    }
    scaleEl.append(marker);
  }
}

export function clearTimeline() {
  timelineEl.innerHTML = "";
  listeners.clear();
}

function createSegmentElement(segment, task, orientation) {
  const segmentEl = document.createElement("div");
  segmentEl.className = "segment";
  segmentEl.style.background = segmentColor(segment, task);
  const duration = segment.end - segment.start;
  const offset = segment.start - task.start;
  segmentEl.title = segment.name;
  if (orientation === "horizontal") {
    segmentEl.style.left = `${offset * MINUTE_PX}px`;
    segmentEl.style.width = `${duration * MINUTE_PX}px`;
    segmentEl.style.height = "100%";
  } else {
    segmentEl.style.top = `${offset * MINUTE_PX}px`;
    segmentEl.style.height = `${duration * MINUTE_PX}px`;
    segmentEl.style.width = "100%";
  }
  segmentEl.style.position = "absolute";
  if (orientation === "horizontal") {
    segmentEl.style.top = "0";
  } else {
    segmentEl.style.left = "0";
  }
  segmentEl.textContent = segment.name;
  return segmentEl;
}

function attachEvent(el, event, handler) {
  el.addEventListener(event, handler);
  listeners.set(`${event}-${el.dataset.id}`, handler);
}

function computeTaskLayout(task, orientation) {
  const span = Math.max(0, task.end - task.start);
  if (orientation === "horizontal") {
    return {
      width: span * MINUTE_PX,
      height: 56,
      top: 36,
      left: task.start * MINUTE_PX
    };
  }
  return {
    width: 56,
    height: span * MINUTE_PX,
    top: task.start * MINUTE_PX,
    left: 36
  };
}

function createTaskElement(task, orientation) {
  const taskEl = document.createElement("div");
  taskEl.className = "task-block";
  taskEl.dataset.id = task.id;
  taskEl.dataset.type = task.type;
  taskEl.style.zIndex = task.type === "constant" ? "4" : "5";
  const layout = computeTaskLayout(task, orientation);
  if (orientation === "horizontal") {
    taskEl.style.width = `${layout.width}px`;
    taskEl.style.height = `${layout.height}px`;
    taskEl.style.left = `${layout.left}px`;
    taskEl.style.top = `${layout.top}px`;
  } else {
    taskEl.style.width = `${layout.width}px`;
    taskEl.style.height = `${layout.height}px`;
    taskEl.style.top = `${layout.top}px`;
    taskEl.style.left = `${layout.left}px`;
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

  if (task.type === "active") {
    taskEl.addEventListener("pointerdown", event => {
      taskEl.classList.add("active-grab");
      taskEl.setPointerCapture(event.pointerId);
      startDrag(event, taskEl, task, orientation);
    });
  } else {
    taskEl.classList.add("task-static");
  }

  taskEl.addEventListener("contextmenu", event => {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY, task);
  });

  return taskEl;
}

export function renderTasks(tasks, orientation) {
  renderScale(orientation);
  clearTimeline();
  const container = timelineEl;
  container.classList.toggle("timeline-horizontal", orientation === "horizontal");
  container.classList.toggle("timeline-vertical", orientation === "vertical");
  if (orientation === "horizontal") {
    container.style.width = `${MINUTES_IN_DAY * MINUTE_PX}px`;
    container.style.height = `180px`;
    if (scaleContainer) {
      scaleContainer.style.maxHeight = "";
    }
  } else {
    container.style.height = `${MINUTES_IN_DAY * MINUTE_PX}px`;
    container.style.width = `180px`;
    if (scaleContainer) {
      const visibleHeight = timelineWrapper ? timelineWrapper.clientHeight : 320;
      scaleContainer.style.maxHeight = `${visibleHeight}px`;
    }
  }
  tasks
    .slice()
    .sort(sortByStart)
    .forEach(task => {
      const taskEl = createTaskElement(task, orientation);
      container.append(taskEl);
    });
  if (scaleContainer && timelineWrapper) {
    if (orientation === "horizontal") {
      scaleContainer.scrollLeft = timelineWrapper.scrollLeft;
    } else {
      scaleContainer.scrollTop = timelineWrapper.scrollTop;
    }
  }
}

function startDrag(event, element, task, orientation) {
  const startPos = orientation === "horizontal" ? event.clientX : event.clientY;
  const originalStart = task.start;

  const handleMove = moveEvent => {
    const delta = (orientation === "horizontal" ? moveEvent.clientX : moveEvent.clientY) - startPos;
    const minuteDelta = snapToMinute(delta / MINUTE_PX);
    const newStart = Math.max(0, Math.min(MINUTES_IN_DAY - 1, originalStart + minuteDelta));
    const offset = newStart - originalStart;
    if (orientation === "horizontal") {
      element.style.left = `${(originalStart + offset) * MINUTE_PX}px`;
    } else {
      element.style.top = `${(originalStart + offset) * MINUTE_PX}px`;
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
