import { dom } from "./dom.js";
import {
  createId,
  escapeHtml,
  DEFAULT_TASK_PRIORITY_ID,
  getTodayKey,
  readStoredValue,
  setStatus,
  TASK_PRIORITY_OPTIONS,
  STORAGE_KEYS,
  writeStoredValue,
} from "./shared.js";
import { state } from "./state.js";

function setTaskMessage(message, type = "info") {
  setStatus(dom.taskMessageElement, message, type);
}

function normalizeSubtask(subtask) {
  const text = String(subtask?.text || "").trim();

  if (!text) {
    return null;
  }

  return {
    id: typeof subtask.id === "string" && subtask.id ? subtask.id : createId("subtask"),
    text,
    completed: Boolean(subtask.completed),
  };
}

function normalizeCompletionHistoryEntry(entry) {
  const rawDateValue = entry?.dateKey ?? entry?.completedAt ?? entry?.date ?? entry?.timestamp;
  const date = rawDateValue instanceof Date ? rawDateValue : rawDateValue ? new Date(rawDateValue) : null;
  const dateKey =
    String(entry?.dateKey || "").trim() ||
    (date && !Number.isNaN(date.getTime()) ? getTodayKey(date) : "");

  if (!dateKey) {
    return null;
  }

  return {
    id: typeof entry?.id === "string" && entry.id ? entry.id : createId("task-completion"),
    taskId: typeof entry?.taskId === "string" ? entry.taskId : "",
    taskText: String(entry?.taskText || "").trim(),
    dateKey,
  };
}

function normalizeTaskPriority(priority) {
  const candidate = String(priority || "").trim();

  return TASK_PRIORITY_OPTIONS.some((option) => option.id === candidate)
    ? candidate
    : DEFAULT_TASK_PRIORITY_ID;
}

function normalizeTask(task) {
  const text = String(task?.text || "").trim();

  if (!text) {
    return null;
  }

  const subtasks = Array.isArray(task?.subtasks)
    ? task.subtasks.map(normalizeSubtask).filter(Boolean)
    : [];

  return {
    id: typeof task.id === "string" && task.id ? task.id : createId("task"),
    text,
    completed: Boolean(task.completed),
    priority: normalizeTaskPriority(task?.priority),
    subtasks,
  };
}

function splitLinkToken(token) {
  const leadingChars = "([{\"'`<";
  const trailingChars = ")]}.!,?:;\"'`>";
  let start = 0;
  let end = token.length;

  while (start < end && leadingChars.includes(token[start])) {
    start += 1;
  }

  while (end > start && trailingChars.includes(token[end - 1])) {
    end -= 1;
  }

  return {
    leading: token.slice(0, start),
    core: token.slice(start, end),
    trailing: token.slice(end),
  };
}

function renderSubtaskTextMarkup(text) {
  return String(text)
    .split(/(\s+)/)
    .map((part) => {
      if (!part || /^\s+$/.test(part)) {
        return escapeHtml(part);
      }

      const { leading, core, trailing } = splitLinkToken(part);

      if (!core.startsWith("https://")) {
        return escapeHtml(part);
      }

      return (
        `${escapeHtml(leading)}<a class="task-subtask-link" href="${escapeHtml(core)}" ` +
        `target="_blank" rel="noreferrer noopener">${escapeHtml(core)}</a>${escapeHtml(trailing)}`
      );
    })
    .join("");
}

function splitTasksByCompletion(taskItems) {
  const activeTasks = [];
  const doneTasks = [];

  for (const task of taskItems) {
    if (task.completed) {
      doneTasks.push(task);
    } else {
      activeTasks.push(task);
    }
  }

  return {
    activeTasks,
    doneTasks,
  };
}

function countCompletedSubtasks(taskItems) {
  return taskItems.reduce((sum, task) => {
    if (!Array.isArray(task.subtasks)) {
      return sum;
    }

    return (
      sum +
      task.subtasks.reduce((subtaskSum, subtask) => subtaskSum + (subtask.completed ? 1 : 0), 0)
    );
  }, 0);
}

function escapeMarkdownInline(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll(">", "\\>")
    .replaceAll("\r\n", " ")
    .replaceAll("\n", " ");
}

function appendMarkdownTaskLine(lines, task, indentLevel = 0, { includePriority = false } = {}) {
  const indent = "  ".repeat(indentLevel);
  const checkbox = task.completed ? "x" : " ";
  const normalizedPriority = normalizeTaskPriority(task.priority);
  const prioritySuffix =
    includePriority && normalizedPriority !== DEFAULT_TASK_PRIORITY_ID
      ? ` (${escapeMarkdownInline(getTaskPriorityLabel(normalizedPriority))})`
      : "";

  lines.push(`${indent}- [${checkbox}] ${escapeMarkdownInline(task.text)}${prioritySuffix}`);

  if (!Array.isArray(task.subtasks) || task.subtasks.length === 0) {
    return;
  }

  for (const subtask of task.subtasks) {
    appendMarkdownTaskLine(lines, subtask, indentLevel + 1);
  }
}

function buildTodoMarkdown(taskItems) {
  const { activeTasks, doneTasks } = splitTasksByCompletion(taskItems);
  const exportDateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date());
  const lines = ["# To-Do List", "", `Exported ${exportDateLabel}`, ""];

  lines.push("## Active");

  if (activeTasks.length === 0) {
    lines.push("- No active tasks");
  } else {
    for (const task of activeTasks) {
      appendMarkdownTaskLine(lines, task, 0, { includePriority: true });
    }
  }

  lines.push("", "## Done");

  if (doneTasks.length === 0) {
    lines.push("- No completed tasks");
  } else {
    for (const task of doneTasks) {
      appendMarkdownTaskLine(lines, task, 0, { includePriority: true });
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function normalizeTaskOrder(taskItems) {
  const normalizedTasks = Array.isArray(taskItems) ? taskItems.map(normalizeTask).filter(Boolean) : [];
  const { activeTasks, doneTasks } = splitTasksByCompletion(normalizedTasks);
  return [...activeTasks, ...doneTasks];
}

async function loadSavedTasks() {
  const storedTasks = await readStoredValue(STORAGE_KEYS.tasks, []);

  if (Array.isArray(storedTasks)) {
    state.tasks.items = normalizeTaskOrder(storedTasks);
    state.tasks.completionHistory = [];
    return;
  }

  if (storedTasks && typeof storedTasks === "object") {
    state.tasks.items = normalizeTaskOrder(storedTasks.items ?? storedTasks.tasks ?? []);
    state.tasks.completionHistory = Array.isArray(storedTasks.completionHistory)
      ? storedTasks.completionHistory.map(normalizeCompletionHistoryEntry).filter(Boolean)
      : Array.isArray(storedTasks.history)
        ? storedTasks.history.map(normalizeCompletionHistoryEntry).filter(Boolean)
        : [];
    return;
  }

  state.tasks.items = [];
  state.tasks.completionHistory = [];
}

async function persistTasks() {
  return writeStoredValue(STORAGE_KEYS.tasks, {
    items: state.tasks.items,
    completionHistory: state.tasks.completionHistory,
  });
}

function resetTaskForm(clearMessage = false) {
  if (dom.taskInputElement) {
    dom.taskInputElement.value = "";
  }

  if (clearMessage) {
    setTaskMessage("");
  }

  dom.taskInputElement?.focus();
}

function getTaskLabelId(taskId) {
  return `task-checkbox-${taskId}`;
}

function getSubtaskLabelId(taskId, subtaskId) {
  return `subtask-checkbox-${taskId}-${subtaskId}`;
}

function getTaskPriorityLabel(priorityId) {
  return (
    TASK_PRIORITY_OPTIONS.find((option) => option.id === normalizeTaskPriority(priorityId))?.label ||
    "Medium"
  );
}

function getNextTaskPriority(priorityId) {
  const normalizedPriority = normalizeTaskPriority(priorityId);
  const currentIndex = TASK_PRIORITY_OPTIONS.findIndex((option) => option.id === normalizedPriority);

  if (currentIndex === -1) {
    return DEFAULT_TASK_PRIORITY_ID;
  }

  return TASK_PRIORITY_OPTIONS[(currentIndex + 1) % TASK_PRIORITY_OPTIONS.length].id;
}

function getDateFromKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map((part) => Number(part));

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatHistoryDateLabel(dateKey) {
  const date = getDateFromKey(dateKey);

  if (!date) {
    return dateKey;
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function buildTaskCompletionHeatmapDays(historyItems, windowSize = 30) {
  const countsByDate = new Map();

  for (const entry of historyItems) {
    countsByDate.set(entry.dateKey, (countsByDate.get(entry.dateKey) || 0) + 1);
  }

  const days = [];

  for (let offset = windowSize - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const dateKey = getTodayKey(date);

    days.push({
      dateKey,
      dateLabel: formatHistoryDateLabel(dateKey),
      count: countsByDate.get(dateKey) || 0,
    });
  }

  return days;
}

function getHeatmapLevel(count, maxCount) {
  if (count <= 0) {
    return 0;
  }

  if (maxCount <= 1) {
    return 1;
  }

  const ratio = count / maxCount;

  if (ratio < 0.25) {
    return 1;
  }

  if (ratio < 0.5) {
    return 2;
  }

  if (ratio < 0.75) {
    return 3;
  }

  return 4;
}

function renderTaskCompletionHeatmapMarkup(element, historyItems) {
  if (!element) {
    return;
  }

  const days = buildTaskCompletionHeatmapDays(historyItems);
  const maxCount = days.reduce((max, day) => Math.max(max, day.count), 0);
  const totalCompletions = days.reduce((sum, day) => sum + day.count, 0);

  if (dom.taskDoneHistoryCountElement) {
    dom.taskDoneHistoryCountElement.textContent = `${totalCompletions} completion${
      totalCompletions === 1 ? "" : "s"
    }`;
  }

  element.innerHTML = days
    .map((day) => {
      const level = getHeatmapLevel(day.count, maxCount);
      const completionLabel = day.count === 1 ? "1 completion" : `${day.count} completions`;

      return `
        <span
          class="task-done-heatmap__cell task-done-heatmap__cell--level-${level}"
          title="${escapeHtml(`${day.dateLabel}: ${completionLabel}`)}"
          aria-label="${escapeHtml(`${day.dateLabel}: ${completionLabel}`)}"
          data-date-key="${escapeHtml(day.dateKey)}"
          data-completions="${day.count}"
        ></span>
      `;
    })
    .join("");
}

function getActiveTaskListFromPoint(clientX, clientY) {
  if (!dom.taskListElement) {
    return null;
  }

  const hitElements = document.elementsFromPoint(clientX, clientY);

  for (const hitElement of hitElements) {
    if (!(hitElement instanceof Element)) {
      continue;
    }

    const taskElement = hitElement.closest("[data-task-id]");

    if (taskElement && dom.taskListElement.contains(taskElement)) {
      return taskElement;
    }
  }

  let closestTask = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const taskElement of Array.from(dom.taskListElement.children)) {
    if (!(taskElement instanceof HTMLElement)) {
      continue;
    }

    const rect = taskElement.getBoundingClientRect();
    const xDistance =
      clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    const yDistance =
      clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    const distance = xDistance * xDistance + yDistance * yDistance;

    if (distance < closestDistance) {
      closestDistance = distance;
      closestTask = taskElement;
    }
  }

  return closestTask;
}

function getTaskDropPosition(taskElement, clientY) {
  const rect = taskElement.getBoundingClientRect();
  const middleY = rect.top + rect.height / 2;

  return clientY < middleY ? "before" : "after";
}

function updateTaskDragClasses() {
  if (!dom.taskListElement) {
    return;
  }

  for (const taskElement of dom.taskListElement.children) {
    if (!(taskElement instanceof HTMLElement)) {
      continue;
    }

    const taskId = taskElement.dataset.taskId;
    const isDragging = taskId === state.tasks.draggingTaskId;
    const isDropTarget = taskId === state.tasks.dropTargetTaskId;

    taskElement.classList.toggle("is-dragging", isDragging);
    taskElement.classList.toggle("is-drop-target", isDropTarget);

    if (isDropTarget && state.tasks.dropPosition) {
      taskElement.dataset.dropPosition = state.tasks.dropPosition;
    } else {
      taskElement.removeAttribute("data-drop-position");
    }
  }
}

function clearTaskDragState() {
  state.tasks.draggingTaskId = null;
  state.tasks.dropTargetTaskId = null;
  state.tasks.dropPosition = null;
  updateTaskDragClasses();
}

function setTaskDropTarget(taskId, dropPosition) {
  state.tasks.dropTargetTaskId = taskId;
  state.tasks.dropPosition = dropPosition;
  updateTaskDragClasses();
}

function renderSubtaskMarkup(task) {
  if (!task.subtasks.length) {
    return "";
  }

  const subtasksMarkup = task.subtasks
    .map((subtask) => {
      const subtaskCheckboxId = getSubtaskLabelId(task.id, subtask.id);

      return `
        <li class="task-subtask-item${subtask.completed ? " is-complete" : ""}" data-subtask-id="${escapeHtml(subtask.id)}">
          <label class="task-subtask-label" for="${escapeHtml(subtaskCheckboxId)}">
            <input
              class="task-subtask-checkbox"
              id="${escapeHtml(subtaskCheckboxId)}"
              type="checkbox"
              data-task-action="toggle-subtask"
              data-parent-task-id="${escapeHtml(task.id)}"
              data-subtask-id="${escapeHtml(subtask.id)}"
              ${subtask.completed ? "checked" : ""}
            />
            <span class="task-subtask-text">${renderSubtaskTextMarkup(subtask.text)}</span>
          </label>
          <div class="task-subtask-actions">
            <button
              class="task-subtask-delete"
              type="button"
              data-task-action="delete-subtask"
              data-parent-task-id="${escapeHtml(task.id)}"
              data-subtask-id="${escapeHtml(subtask.id)}"
            >
              Delete
            </button>
          </div>
        </li>
      `;
    })
    .join("");

  return `
    <ul class="task-subtask-list" aria-label="Subtasks for ${escapeHtml(task.text)}">
      ${subtasksMarkup}
    </ul>
  `;
}

async function exportTodoMarkdown() {
  try {
    const markdown = buildTodoMarkdown(state.tasks.items);
    const fileName = `todo-list-${getTodayKey()}.md`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = fileName;
    link.rel = "noopener";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    setTaskMessage(`Exported ${fileName}.`, "saved");
    return true;
  } catch (error) {
    console.warn("New Tab Dashboard: failed to export the to-do list as Markdown.", error);
    setTaskMessage("Could not export the to-do list right now.", "error");
    return false;
  }
}

function renderTaskPriorityMarkup(task) {
  const priorityId = normalizeTaskPriority(task.priority);
  const priorityLabel = getTaskPriorityLabel(priorityId);

  return `
    <button
      class="task-priority-badge task-priority-badge--${escapeHtml(priorityId)}"
      type="button"
      data-task-action="cycle-priority"
      data-task-id="${escapeHtml(task.id)}"
      aria-label="Change priority for ${escapeHtml(task.text)}"
      title="Click to cycle priority"
    >
      ${escapeHtml(priorityLabel)}
    </button>
  `;
}

export function createTaskMarkup(task, { showBumpButton = true } = {}) {
  const taskCheckboxId = getTaskLabelId(task.id);
  const bumpButtonMarkup = showBumpButton
    ? `
      <button
        class="task-action-button task-action-button--bump"
        type="button"
        data-task-action="bump-top"
        data-task-id="${escapeHtml(task.id)}"
        aria-label="Move ${escapeHtml(task.text)} to the top"
        title="Move to top"
      >
        Top
      </button>
    `
    : "";

  return `
    <div class="task-item__main">
      <input
        class="task-checkbox"
        id="${escapeHtml(taskCheckboxId)}"
        type="checkbox"
        data-task-action="toggle"
        data-task-id="${escapeHtml(task.id)}"
        ${task.completed ? "checked" : ""}
      />
      <label class="task-label" for="${escapeHtml(taskCheckboxId)}">
        <span class="task-text">${escapeHtml(task.text)}</span>
      </label>
    </div>
    <div class="task-item__actions">
      ${renderTaskPriorityMarkup(task)}
      ${bumpButtonMarkup}
      <button
        class="task-action-button task-action-button--subtask"
        type="button"
        data-task-action="add-subtask"
        data-task-id="${escapeHtml(task.id)}"
      >
        Subtask
      </button>
      <button
        class="task-delete"
        type="button"
        data-task-action="delete"
        data-task-id="${escapeHtml(task.id)}"
      >
        Delete
      </button>
    </div>
    ${renderSubtaskMarkup(task)}
  `;
}

function renderTaskList(listElement, tasks, { isDoneList = false } = {}) {
  if (!listElement) {
    return;
  }

  listElement.innerHTML = "";

  for (const task of tasks) {
    const item = document.createElement("li");
    item.className = task.completed ? "task-item is-complete task-item--done" : "task-item";
    item.dataset.taskId = task.id;
    item.draggable = !task.completed && !isDoneList;
    item.setAttribute("aria-grabbed", "false");
    item.innerHTML = createTaskMarkup(task, { showBumpButton: !isDoneList });
    listElement.appendChild(item);
  }
}

function renderTasks() {
  if (!dom.taskListElement || !dom.tasksEmptyStateElement) {
    return;
  }

  const { activeTasks, doneTasks } = splitTasksByCompletion(state.tasks.items);
  const completedItemCount = doneTasks.length + countCompletedSubtasks(state.tasks.items);
  const hasCompletionHistory = state.tasks.completionHistory.length > 0;

  renderTaskList(dom.taskListElement, activeTasks);
  renderTaskList(dom.taskDoneListElement, doneTasks, { isDoneList: true });
  renderTaskCompletionHeatmapMarkup(dom.taskDoneSummaryHeatmapElement, state.tasks.completionHistory);
  renderTaskCompletionHeatmapMarkup(dom.taskDoneHeatmapElement, state.tasks.completionHistory);

  if (activeTasks.length === 0) {
    dom.tasksEmptyStateElement.hidden = false;
    dom.tasksEmptyStateElement.textContent = doneTasks.length
      ? "No active tasks. Check the Done section below for completed items."
      : "No tasks yet. Add one above to get started.";
  } else {
    dom.tasksEmptyStateElement.hidden = true;
  }

  if (dom.taskDoneEmptyStateElement) {
    dom.taskDoneEmptyStateElement.hidden = completedItemCount > 0 || hasCompletionHistory;
  }

  if (dom.taskDonePanelElement) {
    dom.taskDonePanelElement.hidden = completedItemCount === 0 && !hasCompletionHistory;
  }

  if (dom.taskDoneCountElement) {
    dom.taskDoneCountElement.textContent = String(completedItemCount);
  }

  updateTaskDragClasses();
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

// Each active task is draggable so the user can reorder the to-do list.
function handleTaskListDragStart(event) {
  const taskItem = event.target.closest("[data-task-id]");

  if (!taskItem || event.target.closest("[data-task-action]")) {
    return;
  }

  const task = state.tasks.items.find((item) => item.id === taskItem.dataset.taskId);

  if (!task || task.completed || !event.dataTransfer) {
    return;
  }

  state.tasks.draggingTaskId = task.id;
  state.tasks.dropTargetTaskId = null;
  state.tasks.dropPosition = null;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(
    "application/x-newtab-task",
    JSON.stringify({ id: task.id, text: task.text }),
  );
  event.dataTransfer.setData("text/plain", task.text);

  updateTaskDragClasses();
}

function handleTaskListDragOver(event) {
  if (!dom.taskListElement || !state.tasks.draggingTaskId || !event.dataTransfer) {
    return;
  }

  const dragTypes = Array.from(event.dataTransfer.types || []);

  if (!dragTypes.includes("application/x-newtab-task") && !dragTypes.includes("text/plain")) {
    return;
  }

  event.preventDefault();

  const taskItem = getActiveTaskListFromPoint(event.clientX, event.clientY);

  if (!taskItem) {
    state.tasks.dropTargetTaskId = null;
    state.tasks.dropPosition = null;
    updateTaskDragClasses();
    return;
  }

  const taskId = taskItem.dataset.taskId;

  if (!taskId) {
    return;
  }

  const dropPosition = getTaskDropPosition(taskItem, event.clientY);
  event.dataTransfer.dropEffect = "move";

  if (state.tasks.dropTargetTaskId === taskId && state.tasks.dropPosition === dropPosition) {
    return;
  }

  setTaskDropTarget(taskId, dropPosition);
}

async function handleTaskListDrop(event) {
  event.preventDefault();

  const movingTaskId = state.tasks.draggingTaskId;
  const targetTask = getActiveTaskListFromPoint(event.clientX, event.clientY);
  const targetTaskId = targetTask ? targetTask.dataset.taskId || "" : "";
  const dropPosition = targetTask ? getTaskDropPosition(targetTask, event.clientY) : "after";

  clearTaskDragState();

  if (!movingTaskId || !targetTaskId || movingTaskId === targetTaskId) {
    return;
  }

  const { activeTasks, doneTasks } = splitTasksByCompletion(state.tasks.items);
  const movingIndex = activeTasks.findIndex((task) => task.id === movingTaskId);
  const targetIndex = activeTasks.findIndex((task) => task.id === targetTaskId);

  if (movingIndex === -1 || targetIndex === -1) {
    return;
  }

  const reorderedActiveTasks = [...activeTasks];
  const [movingTask] = reorderedActiveTasks.splice(movingIndex, 1);
  const adjustedTargetIndex = reorderedActiveTasks.findIndex((task) => task.id === targetTaskId);

  if (adjustedTargetIndex === -1) {
    return;
  }

  const insertIndex = dropPosition === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
  reorderedActiveTasks.splice(insertIndex, 0, movingTask);

  state.tasks.items = [...reorderedActiveTasks, ...doneTasks];
  await persistTasks();
  renderTasks();
}

function handleTaskListDragEnd() {
  clearTaskDragState();
}

async function handleTaskFormSubmit(event) {
  event.preventDefault();

  if (!dom.taskInputElement) {
    return;
  }

  const text = dom.taskInputElement.value.trim();
  const priority = normalizeTaskPriority(dom.taskPrioritySelectElement?.value);

  if (!text) {
    setTaskMessage("Please enter a task before adding it.", "error");
    dom.taskInputElement.focus();
    return;
  }

  const nextTasks = [
    {
      id: createId("task"),
      text,
      completed: false,
      priority,
      subtasks: [],
    },
    ...state.tasks.items,
  ];

  state.tasks.items = normalizeTaskOrder(nextTasks);

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

  const wasCompleted = task.completed;
  task.completed = completed;
  task.subtasks = Array.isArray(task.subtasks)
    ? task.subtasks.map((subtask) => ({
        ...subtask,
        completed,
      }))
    : [];

  if (completed && !wasCompleted) {
    state.tasks.completionHistory = [
      ...state.tasks.completionHistory,
      {
        id: createId("task-completion"),
        taskId: task.id,
        taskText: task.text,
        dateKey: getTodayKey(),
      },
    ];
  }

  state.tasks.items = normalizeTaskOrder(state.tasks.items);

  await persistTasks();
  renderTasks();
}

async function cycleTaskPriority(taskId) {
  const task = state.tasks.items.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  task.priority = getNextTaskPriority(task.priority);

  await persistTasks();
  renderTasks();
}

async function bumpTaskToTop(taskId) {
  const { activeTasks, doneTasks } = splitTasksByCompletion(state.tasks.items);
  const movingIndex = activeTasks.findIndex((task) => task.id === taskId);

  if (movingIndex <= 0) {
    return;
  }

  const reorderedActiveTasks = [...activeTasks];
  const [movingTask] = reorderedActiveTasks.splice(movingIndex, 1);

  if (!movingTask) {
    return;
  }

  reorderedActiveTasks.unshift(movingTask);
  state.tasks.items = [...reorderedActiveTasks, ...doneTasks];

  await persistTasks();
  renderTasks();
}

async function addSubtask(taskId) {
  const task = state.tasks.items.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  const text = window.prompt(`Add a subtask for "${task.text}"`);

  if (!text || !text.trim()) {
    return;
  }

  task.subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  task.subtasks.push({
    id: createId("subtask"),
    text: text.trim(),
    completed: false,
  });

  await persistTasks();
  renderTasks();
}

async function toggleSubtaskCompletion(taskId, subtaskId, completed) {
  const task = state.tasks.items.find((item) => item.id === taskId);

  if (!task || !Array.isArray(task.subtasks)) {
    return;
  }

  const subtask = task.subtasks.find((item) => item.id === subtaskId);

  if (!subtask) {
    return;
  }

  subtask.completed = completed;
  await persistTasks();
  renderTasks();
}

async function deleteSubtask(taskId, subtaskId) {
  const task = state.tasks.items.find((item) => item.id === taskId);

  if (!task || !Array.isArray(task.subtasks)) {
    return;
  }

  const nextSubtasks = task.subtasks.filter((subtask) => subtask.id !== subtaskId);

  if (nextSubtasks.length === task.subtasks.length) {
    return;
  }

  task.subtasks = nextSubtasks;
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
  const actionElement = event.target.closest("[data-task-action]");

  if (!actionElement) {
    return;
  }

  const action = actionElement.dataset.taskAction;

  if (action === "toggle") {
    void toggleTaskCompletion(actionElement.dataset.taskId, actionElement.checked);
  } else if (action === "toggle-subtask") {
    void toggleSubtaskCompletion(
      actionElement.dataset.parentTaskId,
      actionElement.dataset.subtaskId,
      actionElement.checked,
    );
  }
}

function handleTaskListClick(event) {
  const actionElement = event.target.closest("[data-task-action]");

  if (!actionElement) {
    return;
  }

  const action = actionElement.dataset.taskAction;

  if (action === "delete") {
    const shouldDelete = window.confirm("Delete this task?");

    if (shouldDelete) {
      void deleteTask(actionElement.dataset.taskId);
    }
  } else if (action === "bump-top") {
    void bumpTaskToTop(actionElement.dataset.taskId);
  } else if (action === "cycle-priority") {
    void cycleTaskPriority(actionElement.dataset.taskId);
  } else if (action === "add-subtask") {
    void addSubtask(actionElement.dataset.taskId);
  } else if (action === "delete-subtask") {
    const shouldDelete = window.confirm("Delete this subtask?");

    if (shouldDelete) {
      void deleteSubtask(
        actionElement.dataset.parentTaskId,
        actionElement.dataset.subtaskId,
      );
    }
  }
}

function handleTaskExportClick(event) {
  event.preventDefault();
  void exportTodoMarkdown();
}

export async function resetTodoList() {
  state.tasks.items = [];
  state.tasks.completionHistory = [];
  clearTaskDragState();
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
    dom.taskExportButton?.addEventListener("click", handleTaskExportClick);
    dom.taskListElement.addEventListener("change", handleTaskListChange);
    dom.taskListElement.addEventListener("click", handleTaskListClick);
    dom.taskListElement.addEventListener("dragstart", handleTaskListDragStart);
    dom.taskListElement.addEventListener("dragover", handleTaskListDragOver);
    dom.taskListElement.addEventListener("drop", (event) => {
      void handleTaskListDrop(event);
    });
    dom.taskListElement.addEventListener("dragend", handleTaskListDragEnd);

    dom.taskDoneListElement?.addEventListener("change", handleTaskListChange);
    dom.taskDoneListElement?.addEventListener("click", handleTaskListClick);

    state.ui.todoListenersBound = true;
  }
}
