import { dom } from "./dom.js";
import { createId, escapeHtml, readStoredValue, setStatus, writeStoredValue, STORAGE_KEYS } from "./shared.js";
import { state } from "./state.js";

function setTaskMessage(message, type = "info") {
  setStatus(dom.taskMessageElement, message, type);
}

async function loadSavedTasks() {
  const storedTasks = await readStoredValue(STORAGE_KEYS.tasks, []);

  state.tasks.items = Array.isArray(storedTasks)
    ? storedTasks
        .filter((task) => task && typeof task.id === "string")
        .map((task) => {
          const text = String(task.text || "").trim();

          if (!text) {
            return null;
          }

          return {
            id: task.id,
            text,
            completed: Boolean(task.completed),
          };
        })
        .filter(Boolean)
    : [];
}

async function persistTasks() {
  return writeStoredValue(STORAGE_KEYS.tasks, state.tasks.items);
}

function resetTaskForm(clearMessage = false) {
  dom.taskFormElement?.reset();

  if (clearMessage) {
    setTaskMessage("");
  }

  dom.taskInputElement?.focus();
}

function renderTasks() {
  if (!dom.taskListElement || !dom.tasksEmptyStateElement) {
    return;
  }

  dom.taskListElement.innerHTML = "";

  if (state.tasks.items.length === 0) {
    dom.tasksEmptyStateElement.hidden = false;
    return;
  }

  dom.tasksEmptyStateElement.hidden = true;

  for (const task of state.tasks.items) {
    const taskId = `task-checkbox-${task.id}`;
    const item = document.createElement("li");
    item.className = task.completed ? "task-item is-complete" : "task-item";
    item.dataset.taskId = task.id;
    item.draggable = true;
    item.setAttribute("aria-grabbed", "false");

    item.innerHTML = `
      <div class="task-item__main">
        <input
          class="task-checkbox"
          id="${escapeHtml(taskId)}"
          type="checkbox"
          data-task-action="toggle"
          data-task-id="${escapeHtml(task.id)}"
          ${task.completed ? "checked" : ""}
        />
        <label class="task-label" for="${escapeHtml(taskId)}">
          <span class="task-text">${escapeHtml(task.text)}</span>
        </label>
      </div>
      <button class="task-delete" type="button" data-task-action="delete" data-task-id="${escapeHtml(task.id)}">
        Delete
      </button>
    `;

    dom.taskListElement.appendChild(item);
  }
}

export function getTaskFromDragData(dataTransfer) {
  if (!dataTransfer) {
    return null;
  }

  const rawPayload =
    dataTransfer.getData("application/x-newtab-task") || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload);

    if (parsed && typeof parsed.text === "string") {
      return String(parsed.text).trim() || null;
    }
  } catch {
    // Fall back to plain text if the custom payload is not JSON.
  }

  return String(rawPayload).trim() || null;
}

// Each task is draggable so the user can launch it directly from the to-do list.
function handleTaskListDragStart(event) {
  const taskItem = event.target.closest("[data-task-id]");

  if (!taskItem || event.target.closest("[data-task-action]")) {
    return;
  }

  const task = state.tasks.items.find((item) => item.id === taskItem.dataset.taskId);

  if (!task || !event.dataTransfer) {
    return;
  }

  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(
    "application/x-newtab-task",
    JSON.stringify({ id: task.id, text: task.text }),
  );
  event.dataTransfer.setData("text/plain", task.text);

  taskItem.classList.add("is-dragging");
  taskItem.setAttribute("aria-grabbed", "true");
}

function handleTaskListDragEnd(event) {
  const taskItem = event.target.closest("[data-task-id]");

  if (!taskItem) {
    return;
  }

  taskItem.classList.remove("is-dragging");
  taskItem.setAttribute("aria-grabbed", "false");
}

async function handleTaskFormSubmit(event) {
  event.preventDefault();

  if (!dom.taskInputElement) {
    return;
  }

  const text = dom.taskInputElement.value.trim();

  if (!text) {
    setTaskMessage("Please enter a task before adding it.", "error");
    dom.taskInputElement.focus();
    return;
  }

  state.tasks.items = [
    {
      id: createId("task"),
      text,
      completed: false,
    },
    ...state.tasks.items,
  ];

  await persistTasks();
  renderTasks();
  setTaskMessage("");
  resetTaskForm();
}

async function toggleTaskCompletion(taskId, completed) {
  const task = state.tasks.items.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  task.completed = completed;

  await persistTasks();
  renderTasks();
}

async function deleteTask(taskId) {
  const nextTasks = state.tasks.items.filter((task) => task.id !== taskId);

  if (nextTasks.length === state.tasks.items.length) {
    return;
  }

  state.tasks.items = nextTasks;

  await persistTasks();
  renderTasks();
}

function handleTaskListChange(event) {
  const actionElement = event.target.closest("[data-task-action='toggle']");

  if (!actionElement) {
    return;
  }

  void toggleTaskCompletion(actionElement.dataset.taskId, actionElement.checked);
}

function handleTaskListClick(event) {
  const actionElement = event.target.closest("[data-task-action='delete']");

  if (!actionElement) {
    return;
  }

  const shouldDelete = window.confirm("Delete this task?");

  if (shouldDelete) {
    void deleteTask(actionElement.dataset.taskId);
  }
}

export async function resetTodoList() {
  state.tasks.items = [];
  const saved = await persistTasks();
  renderTasks();
  setStatus(
    dom.taskMessageElement,
    saved ? "To-do list reset." : "To-do list reset locally only.",
    saved ? "saved" : "error",
  );
  return saved;
}

export async function initTodoList() {
  if (!dom.taskFormElement || !dom.taskListElement || !dom.tasksEmptyStateElement) {
    return;
  }

  await loadSavedTasks();
  renderTasks();

  if (!state.ui.todoListenersBound) {
    dom.taskFormElement.addEventListener("submit", handleTaskFormSubmit);
    dom.taskListElement.addEventListener("change", handleTaskListChange);
    dom.taskListElement.addEventListener("click", handleTaskListClick);
    dom.taskListElement.addEventListener("dragstart", handleTaskListDragStart);
    dom.taskListElement.addEventListener("dragend", handleTaskListDragEnd);
    state.ui.todoListenersBound = true;
  }
}
