import { mixTasks } from "../timeline.js";

const modal = document.getElementById("priority-modal");
const optionsContainer = modal.querySelector(".priority-options");
const cancelBtn = document.getElementById("cancel-priority");

let resolveCallback = null;
let pendingPair = null;

cancelBtn.addEventListener("click", () => {
  closeModal();
});

function renderOption(task, otherTask, direction) {
  const option = document.createElement("button");
  option.className = "priority-option";
  option.style.background = task.color ?? "#ff9800";
  option.textContent = task.name;
  option.addEventListener("click", () => {
    resolveCallback?.({
      primaryId: task.id,
      secondaryId: otherTask.id,
      direction
    });
    closeModal();
  });
  return option;
}

export function openPriorityModal(taskA, taskB, callback) {
  resolveCallback = callback;
  pendingPair = [taskA, taskB];
  optionsContainer.innerHTML = "";
  const forwardOption = renderOption(taskA, taskB, "forward");
  const backwardOption = renderOption(taskB, taskA, "backward");
  optionsContainer.append(forwardOption, backwardOption);
  modal.classList.remove("hidden");
}

export function closeModal() {
  modal.classList.add("hidden");
  optionsContainer.innerHTML = "";
  resolveCallback = null;
  pendingPair = null;
}
