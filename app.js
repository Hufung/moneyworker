const STORAGE_KEY = "fundsprint_state_v1";
const MAX_TEXT_LENGTH = 80;
const MAX_CENTS = 50000000000;
const DEFAULT_EXPENSE_CATEGORY = "other";
const MOBILE_VIEWPORT_WIDTH = 900;
const DEFAULT_CURRENCY_CODE = "TWD";
const VALID_NORMALIZED_AMOUNT_PATTERN = /^(?:\d+\.?\d*|\.\d+)$/;
const CURRENCY_MARKER_PATTERN = /[A-Za-z$¥￥£€₹₽₱₩₫₪₴₦₭₡₲₵₸₺₼₾\s]/g;

const SUPPORTED_CURRENCIES = {
  TWD: { label: "新台幣 (TWD)", locale: "zh-TW" },
  HKD: { label: "港幣 (HKD)", locale: "zh-HK" },
  USD: { label: "美元 (USD)", locale: "en-US" },
  SGD: { label: "新加坡幣 (SGD)", locale: "en-SG" },
  CAD: { label: "加幣 (CAD)", locale: "en-CA" },
  AUD: { label: "澳幣 (AUD)", locale: "en-AU" },
};

const DEFAULT_TODO_NAME_SUGGESTIONS = [
  "回覆客戶信件",
  "完成專案報告",
  "整理工作清單",
  "運動 30 分鐘",
  "閱讀 20 分鐘",
  "準備明天會議",
];

const DEFAULT_EXPENSE_NAME_SUGGESTIONS = [
  "早餐",
  "午餐",
  "晚餐",
  "捷運",
  "停車費",
  "網路訂閱",
  "學習課程",
];

const EXPENSE_CATEGORY_LABELS = {
  food: "餐飲",
  transport: "交通",
  housing: "居家",
  learning: "學習",
  health: "健康",
  entertainment: "娛樂",
  bills: "帳單",
  other: "其他",
};

const EXPENSE_CATEGORY_COLORS = {
  food: "#d96b6b",
  transport: "#6f86d6",
  housing: "#7c9a5d",
  learning: "#8f7ad6",
  health: "#4c9f9f",
  entertainment: "#c98a3d",
  bills: "#8c8c8c",
  other: "#b59f8f",
};

let state = createDefaultState();
let startupNotice = "";
let toastTimer = null;
let pendingConfirmCallback = null;
let undoBuffer = null;
let activeNumpadInput = null;
let deferredInstallPrompt = null;

const uiState = {
  todoFilter: "all",
  expenseSort: "latest",
  expenseCategoryFilter: "all",
};

const currencyFormatterCache = new Map();

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  dateStyle: "medium",
  timeStyle: "short",
});

const els = {};

initialize();

function initialize() {
  const loaded = loadState();
  state = loaded.state;
  startupNotice = loaded.notice;

  cacheElements();
  bindEvents();
  renderAll();

  if (startupNotice) {
    showMessage(startupNotice, "warn");
    saveState();
  }
}

function cacheElements() {
  els.commandBar = document.querySelector(".command-bar");

  els.budgetForm = document.getElementById("budgetForm");
  els.budgetInput = document.getElementById("budgetInput");

  els.incomeForm = document.getElementById("incomeForm");
  els.incomeInput = document.getElementById("incomeInput");

  els.todoForm = document.getElementById("todoForm");
  els.todoTitleInput = document.getElementById("todoTitleInput");
  els.todoNameOptions = document.getElementById("todoNameOptions");
  els.todoUnlockInput = document.getElementById("todoUnlockInput");
  els.todoList = document.getElementById("todoList");
  els.todoEmpty = document.getElementById("todoEmpty");
  els.todoCountBadge = document.getElementById("todoCountBadge");
  els.todoFilterButtons = Array.from(
    document.querySelectorAll("button[data-todo-filter]")
  );

  els.expenseForm = document.getElementById("expenseForm");
  els.expenseTitleInput = document.getElementById("expenseTitleInput");
  els.expenseNameOptions = document.getElementById("expenseNameOptions");
  els.expenseCategoryInput = document.getElementById("expenseCategoryInput");
  els.expenseAmountInput = document.getElementById("expenseAmountInput");
  els.expenseSubmitButton = document.getElementById("expenseSubmitButton");
  els.expenseHint = document.getElementById("expenseHint");
  els.expenseCategoryFilter = document.getElementById("expenseCategoryFilter");
  els.expenseList = document.getElementById("expenseList");
  els.expenseEmpty = document.getElementById("expenseEmpty");
  els.expenseCountBadge = document.getElementById("expenseCountBadge");
  els.expenseSortButtons = Array.from(
    document.querySelectorAll("button[data-expense-sort]")
  );

  els.budgetValue = document.getElementById("budgetValue");
  els.availableFundsValue = document.getElementById("availableFundsValue");
  els.incomeValue = document.getElementById("incomeValue");
  els.spentValue = document.getElementById("spentValue");
  els.availableValue = document.getElementById("availableValue");
  els.statusNote = document.getElementById("statusNote");
  els.coachMessage = document.getElementById("coachMessage");
  els.nextUnlockValue = document.getElementById("nextUnlockValue");
  els.expensePieChart = document.getElementById("expensePieChart");
  els.expensePieLegend = document.getElementById("expensePieLegend");
  els.expensePieEmpty = document.getElementById("expensePieEmpty");

  els.unlockProgressText = document.getElementById("unlockProgressText");
  els.spendProgressText = document.getElementById("spendProgressText");
  els.unlockProgressFill = document.getElementById("unlockProgressFill");
  els.spendProgressFill = document.getElementById("spendProgressFill");

  els.messageBar = document.getElementById("messageBar");
  els.undoButton = document.getElementById("undoButton");
  els.resetButton = document.getElementById("resetButton");
  els.saveButton = document.getElementById("saveButton");
  els.exportButton = document.getElementById("exportButton");
  els.importButton = document.getElementById("importButton");
  els.importInput = document.getElementById("importInput");
  els.currencySelect = document.getElementById("currencySelect");

  els.confirmModal = document.getElementById("confirmModal");
  els.confirmTitle = document.getElementById("confirmTitle");
  els.confirmMessage = document.getElementById("confirmMessage");
  els.confirmCancel = document.getElementById("confirmCancel");
  els.confirmOk = document.getElementById("confirmOk");
  els.installAppButton = document.getElementById("installAppButton");

  els.numericInputs = Array.from(document.querySelectorAll("input[data-numpad='true']"));
  els.numberPadRoot = null;
  els.numberPadTarget = null;
}

function bindEvents() {
  bindIfPresent(els.budgetForm, "submit", handleBudgetSubmit);
  bindIfPresent(els.incomeForm, "submit", handleIncomeSubmit);
  bindIfPresent(els.todoForm, "submit", handleTodoSubmit);
  bindIfPresent(els.expenseForm, "submit", handleExpenseSubmit);

  bindIfPresent(els.todoList, "click", handleTodoAction);
  bindIfPresent(els.expenseList, "click", handleExpenseAction);
  bindIfPresent(els.resetButton, "click", resetAllData);
  bindIfPresent(els.saveButton, "click", handleManualSave);
  bindIfPresent(els.undoButton, "click", restoreLastDeletedItem);
  bindIfPresent(els.exportButton, "click", exportBackup);
  bindIfPresent(els.importButton, "click", triggerImportBackup);
  bindIfPresent(els.importInput, "change", handleImportBackup);
  bindIfPresent(els.currencySelect, "change", handleCurrencyChange);

  if (els.commandBar) {
    els.commandBar.addEventListener("click", handleQuickFocus);
  }

  els.todoFilterButtons.forEach((button) => {
    button.addEventListener("click", handleTodoFilterChange);
  });

  els.expenseSortButtons.forEach((button) => {
    button.addEventListener("click", handleExpenseSortChange);
  });

  bindIfPresent(
    els.expenseCategoryFilter,
    "change",
    handleExpenseCategoryFilterChange
  );

  document.addEventListener("keydown", handleGlobalShortcuts);
  window.addEventListener("storage", handleStorageSync);

  if (els.confirmCancel) {
    els.confirmCancel.addEventListener("click", closeConfirmModal);
  }

  if (els.confirmModal) {
    els.confirmModal.addEventListener("cancel", () => {
      pendingConfirmCallback = null;
    });
    els.confirmModal.addEventListener("click", handleConfirmBackdropClick);
  }

  initializeNumberPad();
  initializeInstallPrompt();
  window.addEventListener("resize", syncNumpadInputMode);
}

function handleQuickFocus(event) {
  const button = event.target.closest("button[data-focus]");
  if (!button) {
    return;
  }

  focusInput(button.dataset.focus);
}

function handleGlobalShortcuts(event) {
  if (!event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "b") {
    event.preventDefault();
    focusInput("budgetInput");
    return;
  }

  if (key === "t") {
    event.preventDefault();
    focusInput("todoTitleInput");
    return;
  }

  if (key === "e") {
    event.preventDefault();
    scrollToSection("expensesSection");
    window.setTimeout(() => {
      focusInput("expenseTitleInput");
    }, 140);
    return;
  }

  if (key === "a") {
    event.preventDefault();
    scrollToSection("analysisSection");
    return;
  }

  if (key === "z") {
    event.preventDefault();
    restoreLastDeletedItem();
  }
}

function handleTodoFilterChange(event) {
  const nextFilter = event.currentTarget.dataset.todoFilter;
  if (!nextFilter || uiState.todoFilter === nextFilter) {
    return;
  }

  uiState.todoFilter = nextFilter;
  renderAll();
}

function handleExpenseSortChange(event) {
  const nextSort = event.currentTarget.dataset.expenseSort;
  if (!nextSort || uiState.expenseSort === nextSort) {
    return;
  }

  uiState.expenseSort = nextSort;
  renderAll();
}

function handleExpenseCategoryFilterChange(event) {
  const raw = event.currentTarget.value || "all";
  uiState.expenseCategoryFilter =
    raw === "all" ? "all" : normalizeExpenseCategory(raw);
  renderAll();
}

function handleCurrencyChange(event) {
  const nextCurrencyCode = normalizeCurrencyCode(event.currentTarget.value);
  if (nextCurrencyCode === state.currencyCode) {
    return;
  }

  commit(() => {
    state.currencyCode = nextCurrencyCode;
  });

  showMessage(`已切換顯示幣別為 ${nextCurrencyCode}。`, "success");
}

function handleBudgetSubmit(event) {
  event.preventDefault();

  const cents = parseInputToCents(els.budgetInput.value, true);
  if (cents === null) {
    showMessage("請輸入有效的預算金額（不可為負數）。", "error");
    return;
  }

  commit(() => {
    state.budgetTotalCents = cents;
  });

  showMessage("總預算已更新。", "success");
}

function handleIncomeSubmit(event) {
  event.preventDefault();

  const cents = parseInputToCents(els.incomeInput.value, false);
  if (cents === null) {
    showMessage("請輸入有效的收入金額。", "error");
    return;
  }

  commit(() => {
    state.incomeTotalCents += cents;
  });

  els.incomeInput.value = "";
  showMessage("收入已新增。", "success");
}

function handleTodoSubmit(event) {
  event.preventDefault();

  const title = normalizeText(els.todoTitleInput.value);
  const unlockAmountCents = parseInputToCents(els.todoUnlockInput.value, false);

  if (!title) {
    showMessage("請輸入待辦名稱。", "error");
    return;
  }

  if (unlockAmountCents === null || unlockAmountCents <= 0) {
    showMessage("解鎖金額必須大於 0。", "error");
    return;
  }

  const todo = {
    id: makeId("todo"),
    title,
    unlockAmountCents,
    completed: false,
    unlockedOnce: false,
    createdAt: Date.now(),
    completedAt: null,
  };

  commit(() => {
    state.todos.unshift(todo);
  });

  els.todoForm.reset();
  els.todoTitleInput.focus();
  showMessage("待辦已新增。", "success");
}

function handleExpenseSubmit(event) {
  event.preventDefault();

  const title = normalizeText(els.expenseTitleInput.value);
  const category = normalizeExpenseCategory(
    els.expenseCategoryInput ? els.expenseCategoryInput.value : DEFAULT_EXPENSE_CATEGORY
  );
  const amountCents = parseInputToCents(els.expenseAmountInput.value, false);

  if (!title) {
    showMessage("請輸入支出名稱。", "error");
    return;
  }

  if (amountCents === null || amountCents <= 0) {
    showMessage("支出金額必須大於 0。", "error");
    return;
  }

  const expense = {
    id: makeId("exp"),
    title,
    category,
    amountCents,
    createdAt: Date.now(),
  };

  commit(() => {
    state.expenses.unshift(expense);
  });

  els.expenseForm.reset();
  els.expenseTitleInput.focus();
  const remainingAfterSubmit = computeDerived(state).availableFundsCents;
  showMessage(
    remainingAfterSubmit < 0 ? "支出已新增（目前為透支狀態）。" : "支出已新增。",
    remainingAfterSubmit < 0 ? "warn" : "success"
  );
}

function handleTodoAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "complete") {
    completeTodo(id);
    return;
  }

  if (action === "delete") {
    deleteTodo(id);
  }
}

function handleExpenseAction(event) {
  const button = event.target.closest("button[data-action='delete-expense']");
  if (!button) {
    return;
  }

  const id = button.dataset.id;
  const index = state.expenses.findIndex((item) => item.id === id);
  if (index < 0) {
    return;
  }

  const deletedExpense = state.expenses[index];

  showConfirm(
    {
      title: "刪除支出",
      message: "確定刪除這筆支出？",
      confirmText: "刪除",
    },
    () => {
      commit(() => {
        setUndoBuffer("expense", deletedExpense, index);
        state.expenses.splice(index, 1);
      });
      showMessage("支出已刪除，可按 Alt+Z 復原。", "warn");
    }
  );
}

function completeTodo(todoId) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo || todo.completed) {
    return;
  }

  commit(() => {
    todo.completed = true;
    todo.completedAt = Date.now();

    if (!todo.unlockedOnce) {
      todo.unlockedOnce = true;
      state.unlockedEverCents += todo.unlockAmountCents;
    }
  });

  showMessage(`已解鎖 ${formatCurrency(todo.unlockAmountCents)}。`, "success");
}

function deleteTodo(todoId) {
  const index = state.todos.findIndex((item) => item.id === todoId);
  if (index < 0) {
    return;
  }

  const todo = state.todos[index];
  const prompt = todo.completed
    ? "刪除已完成待辦不會回收已解鎖資金，確定刪除？"
    : "確定刪除這筆待辦？";

  showConfirm(
    {
      title: "刪除待辦",
      message: prompt,
      confirmText: "刪除",
    },
    () => {
      commit(() => {
        setUndoBuffer("todo", todo, index);
        state.todos.splice(index, 1);
      });
      showMessage("待辦已刪除，可按 Alt+Z 復原。", "warn");
    }
  );
}

function resetAllData() {
  showConfirm(
    {
      title: "清空所有資料",
      message: "確定要清空所有資料？此動作無法復原。",
      confirmText: "清空",
    },
    () => {
      state = createDefaultState();
      undoBuffer = null;
      saveState();
      renderAll();
      showMessage("所有資料已清空。", "warn");
    }
  );
}

function handleManualSave() {
  state.updatedAt = Date.now();
  if (saveState()) {
    showMessage("已儲存至本機。", "success");
  }
}

function exportBackup() {
  const backupPayload = {
    app: "FundSprint",
    version: 1,
    exportedAt: Date.now(),
    state,
  };

  const serialized = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([serialized], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `fundsprint-backup-${stamp}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  showMessage("備份已匯出。", "success");
}

function triggerImportBackup() {
  if (!els.importInput) {
    return;
  }

  els.importInput.click();
}

async function handleImportBackup(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    const candidateState =
      isObject(parsed) && isObject(parsed.state) ? parsed.state : parsed;

    if (!isObject(candidateState)) {
      throw new Error("invalid-structure");
    }

    const nextState = normalizeState(candidateState);
    showConfirm(
      {
        title: "匯入備份",
        message: "匯入後會覆蓋目前資料，確定繼續？",
        confirmText: "匯入",
      },
      () => {
        state = nextState;
        undoBuffer = null;
        saveState();
        renderAll();
        showMessage("匯入完成。", "success");
      }
    );
  } catch {
    showMessage("匯入失敗：檔案格式不正確。", "error");
  } finally {
    event.target.value = "";
  }
}

function handleStorageSync(event) {
  if (event.key !== STORAGE_KEY || !event.newValue) {
    return;
  }

  const loaded = loadState();
  state = loaded.state;
  undoBuffer = null;
  renderAll();
  showMessage("已同步其他分頁的變更。", "warn");
}

function renderAll() {
  const derived = computeDerived(state);

  syncSegmentState(els.todoFilterButtons, uiState.todoFilter, "todoFilter");
  syncSegmentState(els.expenseSortButtons, uiState.expenseSort, "expenseSort");
  if (els.expenseCategoryFilter) {
    els.expenseCategoryFilter.value = uiState.expenseCategoryFilter;
  }

  renderSummary(derived);
  renderTodoList();
  renderExpenseList();
  renderBudgetInput();
  renderCurrencySelector();
  renderExpenseAvailability(derived);
  renderInsights(derived);
  renderExpensePie();
  renderNameSuggestions();
  renderUndoState();
}

function renderSummary(derived) {
  if (
    !els.budgetValue ||
    !els.availableFundsValue ||
    !els.incomeValue ||
    !els.spentValue ||
    !els.availableValue
  ) {
    return;
  }

  els.budgetValue.textContent = formatCurrency(derived.currentBudgetCents);
  els.availableFundsValue.textContent = formatCurrency(derived.availableFundsCents);
  els.incomeValue.textContent = formatCurrency(state.incomeTotalCents);
  els.spentValue.textContent = formatCurrency(derived.spentTotalCents);
  els.availableValue.textContent = formatCurrency(derived.availableFundsCents);

  const overspent = derived.availableFundsCents < 0;
  els.availableFundsValue.classList.toggle("is-negative", overspent);
  els.availableValue.classList.toggle("is-negative", overspent);
  if (els.statusNote) {
    els.statusNote.textContent = overspent
      ? "目前超出可用額度，請先刪除支出或提高預算"
      : "可新增支出";
  }

  if (!els.unlockProgressText || !els.spendProgressText) {
    return;
  }

  els.unlockProgressText.textContent = `${Math.round(derived.budgetRatio * 100)}%`;
  els.spendProgressText.textContent = `${Math.round(derived.spendRatioRaw * 100)}%`;

  if (els.unlockProgressFill) {
    els.unlockProgressFill.style.width = `${Math.round(derived.budgetRatio * 100)}%`;
  }
  if (els.spendProgressFill) {
    els.spendProgressFill.style.width = `${Math.round(
      derived.spendRatioClamped * 100
    )}%`;
  }
}

function renderTodoList() {
  if (!els.todoList || !els.todoEmpty || !els.todoCountBadge) {
    return;
  }

  const visibleTodos = getVisibleTodos(state.todos, uiState.todoFilter);

  els.todoCountBadge.textContent =
    uiState.todoFilter === "all"
      ? `${state.todos.length} 筆`
      : `${visibleTodos.length}/${state.todos.length} 筆`;
  els.todoEmpty.hidden = visibleTodos.length > 0;

  if (state.todos.length === 0) {
    els.todoList.innerHTML = "";
    els.todoEmpty.textContent = "尚未建立待辦，先新增第一筆吧。";
    return;
  }

  if (visibleTodos.length === 0) {
    els.todoList.innerHTML = "";
    els.todoEmpty.textContent = "目前篩選條件下沒有待辦。";
    return;
  }

  els.todoList.innerHTML = visibleTodos
    .map((todo) => {
      const statusText = todo.completed
        ? `完成於 ${formatDate(todo.completedAt)}`
        : "尚未完成";

      const completeButton = todo.completed
        ? '<button type="button" class="muted" disabled><span class="icon">✅</span>已解鎖</button>'
        : `<button type="button" data-action="complete" data-id="${todo.id}"><span class="icon">✨</span>解鎖</button>`;

      return `
        <li class="item${todo.completed ? " is-done" : ""}">
          <div class="item-main">
            <p class="item-title">${escapeHtml(todo.title)}</p>
            <p class="item-meta">解鎖 ${formatCurrency(
              todo.unlockAmountCents
            )} · ${statusText}</p>
          </div>
          <div class="item-actions">
            ${completeButton}
            <button type="button" class="danger" data-action="delete" data-id="${
              todo.id
            }">刪除</button>
          </div>
        </li>
      `;
    })
    .join("");
}

function renderExpenseList() {
  if (!els.expenseList || !els.expenseEmpty || !els.expenseCountBadge) {
    return;
  }

  const visibleExpenses = getVisibleExpenses(
    state.expenses,
    uiState.expenseSort,
    uiState.expenseCategoryFilter
  );

  els.expenseCountBadge.textContent =
    uiState.expenseCategoryFilter === "all"
      ? `${state.expenses.length} 筆`
      : `${visibleExpenses.length}/${state.expenses.length} 筆`;
  els.expenseEmpty.hidden = visibleExpenses.length > 0;

  if (state.expenses.length === 0) {
    els.expenseList.innerHTML = "";
    els.expenseEmpty.textContent = "尚未記錄支出。";
    return;
  }

  if (visibleExpenses.length === 0) {
    els.expenseList.innerHTML = "";
    els.expenseEmpty.textContent = "目前篩選分類下沒有支出。";
    return;
  }

  els.expenseList.innerHTML = visibleExpenses
    .map(
      (expense) => `
        <li class="item">
          <div class="item-main">
            <p class="item-title">${escapeHtml(expense.title)}</p>
            <p class="item-meta">
              <span class="category-tag">${getExpenseCategoryLabel(expense.category)}</span>
              ${formatCurrency(expense.amountCents)} · ${formatDate(expense.createdAt)}
            </p>
          </div>
          <div class="item-actions">
            <button type="button" class="danger" data-action="delete-expense" data-id="${
              expense.id
            }">刪除</button>
          </div>
        </li>
      `
    )
    .join("");
}

function renderBudgetInput() {
  if (!els.budgetInput) {
    return;
  }

  els.budgetInput.value = centsToInput(state.budgetTotalCents);
}

function renderCurrencySelector() {
  if (!els.currencySelect) {
    return;
  }

  els.currencySelect.value = normalizeCurrencyCode(state.currencyCode);
}

function renderExpenseAvailability(derived) {
  if (!els.expenseHint || !els.expenseSubmitButton) {
    return;
  }

  const available = derived.availableFundsCents;
  if (available > 0) {
    els.expenseHint.textContent = `建議新增上限：${formatCurrency(available)}`;
  } else if (available === 0) {
    els.expenseHint.textContent = "目前可用為 0，可透支新增支出。";
  } else {
    els.expenseHint.textContent = `目前透支 ${formatCurrency(
      Math.abs(available)
    )}，可繼續新增支出。`;
  }
  els.expenseHint.classList.toggle("is-blocked", available <= 0);
  els.expenseSubmitButton.disabled = false;
}

function renderInsights(derived) {
  if (!els.coachMessage || !els.nextUnlockValue) {
    return;
  }

  const nextUnlockTodo = getNextUnlockTodo(state.todos);

  if (nextUnlockTodo) {
    els.nextUnlockValue.textContent = `${formatCurrency(
      nextUnlockTodo.unlockAmountCents
    )} · ${nextUnlockTodo.title}`;
  } else {
    els.nextUnlockValue.textContent = "已全部解鎖";
  }

  if (state.budgetTotalCents <= 0) {
    els.coachMessage.textContent = "先設定總預算，建立本次資金的硬上限。";
    return;
  }

  if (state.todos.length === 0) {
    els.coachMessage.textContent = "新增待辦並設定解鎖金額，開始第一段可用資金。";
    return;
  }

  if (nextUnlockTodo) {
    els.coachMessage.textContent = `再完成 1 筆待辦，可多解鎖 ${formatCurrency(
      nextUnlockTodo.unlockAmountCents
    )}。`;
    return;
  }

  if (derived.availableFundsCents > 0) {
    els.coachMessage.textContent = `全部待辦完成，目前仍可使用 ${formatCurrency(
      derived.availableFundsCents
    )}。`;
    return;
  }

  els.coachMessage.textContent = "已用完可用資金，可提高預算或刪除部分支出。";
}

function renderExpensePie() {
  if (!els.expensePieChart || !els.expensePieLegend || !els.expensePieEmpty) {
    return;
  }

  const breakdown = getExpenseCategoryBreakdown(state.expenses);
  if (breakdown.length === 0) {
    els.expensePieChart.style.background = "conic-gradient(var(--line) 0deg 360deg)";
    els.expensePieChart.setAttribute("aria-label", "目前尚無支出資料");
    els.expensePieLegend.innerHTML = "";
    els.expensePieEmpty.hidden = false;
    return;
  }

  let currentDegree = 0;
  const gradientStops = breakdown
    .map((item) => {
      const start = currentDegree;
      const end = currentDegree + item.ratio * 360;
      currentDegree = end;
      return `${item.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  els.expensePieChart.style.background = `conic-gradient(${gradientStops})`;
  els.expensePieChart.setAttribute(
    "aria-label",
    breakdown
      .map((item) => `${item.label} ${Math.round(item.ratio * 100)}%`)
      .join("，")
  );

  els.expensePieLegend.innerHTML = breakdown
    .map(
      (item) => `
        <li>
          <span class="pie-dot" style="background:${item.color}"></span>
          <span class="pie-label">${escapeHtml(item.label)}</span>
          <span class="pie-value">${Math.round(item.ratio * 100)}% · ${formatCurrency(
            item.amountCents
          )}</span>
        </li>
      `
    )
    .join("");
  els.expensePieEmpty.hidden = true;
}

function renderNameSuggestions() {
  populateDatalist(
    els.todoNameOptions,
    DEFAULT_TODO_NAME_SUGGESTIONS,
    state.todos.map((todo) => todo.title)
  );

  populateDatalist(
    els.expenseNameOptions,
    DEFAULT_EXPENSE_NAME_SUGGESTIONS,
    state.expenses.map((expense) => expense.title)
  );
}

function populateDatalist(target, defaults, historyValues) {
  if (!target) {
    return;
  }

  const merged = [];
  const seen = new Set();
  const candidates = [...defaults, ...historyValues];

  candidates.forEach((value) => {
    const normalized = normalizeText(value);
    if (!normalized) {
      return;
    }

    const dedupeKey = normalized.toLocaleLowerCase("zh-TW");
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    merged.push(normalized);
  });

  const limited = merged.slice(0, 18);
  target.innerHTML = "";

  limited.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    target.append(option);
  });
}

function renderUndoState() {
  if (!els.undoButton) {
    return;
  }

  if (!undoBuffer) {
    els.undoButton.disabled = true;
    els.undoButton.textContent = "復原刪除";
    return;
  }

  const targetLabel = undoBuffer.type === "todo" ? "待辦" : "支出";
  els.undoButton.disabled = false;
  els.undoButton.textContent = `復原${targetLabel}`;
}

function setUndoBuffer(type, item, index) {
  undoBuffer = {
    type,
    index,
    item: clonePlainObject(item),
    capturedAt: Date.now(),
  };
}

function restoreLastDeletedItem() {
  if (!undoBuffer) {
    showMessage("目前沒有可復原的刪除項目。", "warn");
    return;
  }

  const snapshot = undoBuffer;
  commit(() => {
    if (snapshot.type === "todo") {
      const insertIndex = clamp(snapshot.index, 0, state.todos.length);
      state.todos.splice(insertIndex, 0, snapshot.item);
    } else {
      const insertIndex = clamp(snapshot.index, 0, state.expenses.length);
      state.expenses.splice(insertIndex, 0, snapshot.item);
    }
  });

  undoBuffer = null;
  renderUndoState();
  showMessage("已復原上一筆刪除。", "success");
}

function syncSegmentState(buttons, activeValue, datasetKey) {
  if (!Array.isArray(buttons)) {
    return;
  }

  buttons.forEach((button) => {
    const isActive = button.dataset[datasetKey] === activeValue;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getVisibleTodos(todos, filter) {
  if (filter === "pending") {
    return todos.filter((todo) => !todo.completed);
  }

  if (filter === "completed") {
    return todos.filter((todo) => todo.completed);
  }

  return todos;
}

function getVisibleExpenses(expenses, sort, categoryFilter) {
  const filtered =
    categoryFilter === "all"
      ? [...expenses]
      : expenses.filter((expense) => normalizeExpenseCategory(expense.category) === categoryFilter);

  if (sort === "highest") {
    filtered.sort(
      (a, b) => b.amountCents - a.amountCents || b.createdAt - a.createdAt
    );
    return filtered;
  }

  filtered.sort((a, b) => b.createdAt - a.createdAt);
  return filtered;
}

function getExpenseCategoryBreakdown(expenses) {
  const amountByCategory = expenses.reduce((map, expense) => {
    const category = normalizeExpenseCategory(expense.category);
    const nextAmount = (map.get(category) || 0) + expense.amountCents;
    map.set(category, nextAmount);
    return map;
  }, new Map());

  const breakdown = Array.from(amountByCategory, ([category, amountCents]) => ({
    category,
    label: getExpenseCategoryLabel(category),
    amountCents,
    color: EXPENSE_CATEGORY_COLORS[category] || EXPENSE_CATEGORY_COLORS.other,
  })).sort((a, b) => b.amountCents - a.amountCents);

  const totalCents = breakdown.reduce((sum, item) => sum + item.amountCents, 0);
  if (totalCents === 0) {
    return [];
  }

  if (totalCents < 0) {
    return [];
  }

  return breakdown.map((item) => ({
    ...item,
    ratio: item.amountCents / totalCents,
  }));
}

function getNextUnlockTodo(todos) {
  const pendingTodos = todos.filter((todo) => !todo.completed);
  if (pendingTodos.length === 0) {
    return null;
  }

  pendingTodos.sort(
    (a, b) => a.unlockAmountCents - b.unlockAmountCents || a.createdAt - b.createdAt
  );
  return pendingTodos[0];
}

function computeDerived(currentState) {
  const spentTotalCents = currentState.expenses.reduce(
    (sum, expense) => sum + expense.amountCents,
    0
  );

  const totalOwnedCents = currentState.budgetTotalCents + currentState.incomeTotalCents;
  const unlockedFundsCents = Math.min(currentState.unlockedEverCents, totalOwnedCents);

  const currentBudgetCents = totalOwnedCents - spentTotalCents;

  const availableFundsCents = unlockedFundsCents - spentTotalCents;

  const budgetRatio =
    totalOwnedCents > 0
      ? clamp(currentBudgetCents / totalOwnedCents, 0, 1)
      : 0;

  const spendRatioRaw = unlockedFundsCents > 0 ? spentTotalCents / unlockedFundsCents : 0;
  const spendRatioClamped = clamp(spendRatioRaw, 0, 1);

  return {
    spentTotalCents,
    totalOwnedCents,
    currentBudgetCents,
    availableFundsCents,
    budgetRatio,
    spendRatioRaw,
    spendRatioClamped,
  };
}

function commit(mutator) {
  mutator();
  state.updatedAt = Date.now();
  saveState();
  renderAll();
}

function createDefaultState() {
  const now = Date.now();

  return {
    version: 1,
    currencyCode: DEFAULT_CURRENCY_CODE,
    budgetTotalCents: 0,
    incomeTotalCents: 0,
    unlockedEverCents: 0,
    todos: [],
    expenses: [],
    createdAt: now,
    updatedAt: now,
  };
}

function loadState() {
  const fallback = createDefaultState();
  let raw = null;

  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      state: fallback,
      notice: "瀏覽器限制了 localStorage，資料將無法持久保存。",
    };
  }

  if (!raw) {
    return { state: fallback, notice: "" };
  }

  try {
    const parsed = JSON.parse(raw);
    return { state: normalizeState(parsed), notice: "" };
  } catch {
    return {
      state: fallback,
      notice: "偵測到損壞的本機資料，已自動重建新狀態。",
    };
  }
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    showMessage("儲存失敗：可能是儲存空間不足或瀏覽器限制。", "error");
    return false;
  }
}

function normalizeState(raw) {
  const fallback = createDefaultState();

  if (!isObject(raw)) {
    return fallback;
  }

  const todos = Array.isArray(raw.todos)
    ? raw.todos.map(normalizeTodo).filter(Boolean)
    : [];

  const expenses = Array.isArray(raw.expenses)
    ? raw.expenses.map(normalizeExpense).filter(Boolean)
    : [];

  const currencyCode = normalizeCurrencyCode(raw.currencyCode);

  const budgetTotalCents = sanitizeStoredCents(raw.budgetTotalCents) ?? 0;
  const unlockedFromStorage = sanitizeStoredCents(raw.unlockedEverCents) ?? 0;

  const unlockedFromCompletedTodos = todos.reduce(
    (sum, todo) => (todo.unlockedOnce ? sum + todo.unlockAmountCents : sum),
    0
  );

  const unlockedEverCents = Math.max(unlockedFromStorage, unlockedFromCompletedTodos);

  const incomeTotalCents = sanitizeStoredCents(raw.incomeTotalCents) ?? 0;

  return {
    version: 1,
    currencyCode,
    budgetTotalCents,
    incomeTotalCents,
    unlockedEverCents,
    todos,
    expenses,
    createdAt: toSafeTimestamp(raw.createdAt) ?? fallback.createdAt,
    updatedAt: toSafeTimestamp(raw.updatedAt) ?? Date.now(),
  };
}

function normalizeTodo(raw) {
  if (!isObject(raw)) {
    return null;
  }

  const title = normalizeText(raw.title);
  const unlockAmountCents = sanitizeStoredCents(raw.unlockAmountCents);

  if (!title || unlockAmountCents === null || unlockAmountCents <= 0) {
    return null;
  }

  const completed = Boolean(raw.completed);
  const unlockedOnce = Boolean(raw.unlockedOnce || completed);

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : makeId("todo"),
    title,
    unlockAmountCents,
    completed,
    unlockedOnce,
    createdAt: toSafeTimestamp(raw.createdAt) ?? Date.now(),
    completedAt: completed ? toSafeTimestamp(raw.completedAt) ?? Date.now() : null,
  };
}

function normalizeExpense(raw) {
  if (!isObject(raw)) {
    return null;
  }

  const title = normalizeText(raw.title);
  const category = normalizeExpenseCategory(raw.category);
  const amountCents = sanitizeStoredCents(raw.amountCents);

  if (!title || amountCents === null || amountCents <= 0) {
    return null;
  }

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : makeId("exp"),
    title,
    category,
    amountCents,
    createdAt: toSafeTimestamp(raw.createdAt) ?? Date.now(),
  };
}

function parseInputToCents(value, allowZero) {
  const cents = parseMajorUnitInputToCents(value);
  if (cents === null) {
    return null;
  }

  if (!allowZero && cents === 0) {
    return null;
  }

  if (cents > MAX_CENTS) {
    return null;
  }

  return cents;
}

function sanitizeStoredCents(value) {
  const cents = parseStoredValueToCents(value);
  if (cents === null) {
    return null;
  }
  if (cents < 0 || cents > MAX_CENTS) {
    return null;
  }

  return cents;
}

function parseMajorUnitInputToCents(value) {
  const normalized = normalizeAmountInput(value);
  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.round(numeric * 100);
}

function parseStoredValueToCents(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.round(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = normalizeAmountInput(trimmed);
  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.round(numeric * 100);
}

function normalizeAmountInput(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/,/g, "")
    .replace(CURRENCY_MARKER_PATTERN, "");
  if (!normalized || !VALID_NORMALIZED_AMOUNT_PATTERN.test(normalized)) {
    return "";
  }
  return normalized;
}

function normalizeText(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_TEXT_LENGTH);

  return text || null;
}

function normalizeExpenseCategory(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(EXPENSE_CATEGORY_LABELS, key)) {
    return key;
  }

  return DEFAULT_EXPENSE_CATEGORY;
}

function normalizeCurrencyCode(value) {
  const key = String(value ?? "")
    .trim()
    .toUpperCase();
  if (Object.prototype.hasOwnProperty.call(SUPPORTED_CURRENCIES, key)) {
    return key;
  }

  return DEFAULT_CURRENCY_CODE;
}

function getExpenseCategoryLabel(category) {
  const key = normalizeExpenseCategory(category);
  return EXPENSE_CATEGORY_LABELS[key];
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatCurrency(cents) {
  const currencyCode = normalizeCurrencyCode(state.currencyCode);
  const formatter = getCurrencyFormatter(currencyCode);
  return formatter.format((Number(cents) || 0) / 100);
}

function getCurrencyFormatter(currencyCode) {
  const normalizedCode = normalizeCurrencyCode(currencyCode);
  if (currencyFormatterCache.has(normalizedCode)) {
    return currencyFormatterCache.get(normalizedCode);
  }

  const locale = SUPPORTED_CURRENCIES[normalizedCode].locale;
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizedCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  currencyFormatterCache.set(normalizedCode, formatter);
  return formatter;
}

function centsToInput(cents) {
  return (cents / 100).toFixed(2);
}

function formatDate(timestamp) {
  return dateFormatter.format(new Date(timestamp));
}

function toSafeTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  return timestamp;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clonePlainObject(item) {
  return JSON.parse(JSON.stringify(item));
}

function initializeNumberPad() {
  if (!Array.isArray(els.numericInputs) || els.numericInputs.length === 0) {
    return;
  }

  if (els.numberPadRoot) {
    syncNumpadInputMode();
    return;
  }

  createNumberPadElement();

  els.numericInputs.forEach((input) => {
    bindIfPresent(input, "focus", () => openNumberPad(input));
    bindIfPresent(input, "click", () => openNumberPad(input));
  });

  document.addEventListener("focusin", handleNumpadFocusIn);
  syncNumpadInputMode();
}

function createNumberPadElement() {
  const container = document.createElement("div");
  container.className = "number-pad";
  container.setAttribute("aria-hidden", "true");
  container.innerHTML = `
    <section class="number-pad__sheet" aria-label="數字鍵盤">
      <header class="number-pad__header">
        <span class="number-pad__title">數字鍵盤</span>
        <span class="number-pad__target" id="numberPadTarget">-</span>
      </header>
      <div class="number-pad__keys" role="group" aria-label="數字輸入">
        <button type="button" class="number-pad__key" data-pad-key="7">7</button>
        <button type="button" class="number-pad__key" data-pad-key="8">8</button>
        <button type="button" class="number-pad__key" data-pad-key="9">9</button>
        <button type="button" class="number-pad__key" data-pad-key="4">4</button>
        <button type="button" class="number-pad__key" data-pad-key="5">5</button>
        <button type="button" class="number-pad__key" data-pad-key="6">6</button>
        <button type="button" class="number-pad__key" data-pad-key="1">1</button>
        <button type="button" class="number-pad__key" data-pad-key="2">2</button>
        <button type="button" class="number-pad__key" data-pad-key="3">3</button>
        <button type="button" class="number-pad__key action" data-pad-key="back">刪除</button>
        <button type="button" class="number-pad__key" data-pad-key="0">0</button>
        <button type="button" class="number-pad__key" data-pad-key="dot">.</button>
      </div>
      <footer class="number-pad__footer">
        <button type="button" class="number-pad__key action" data-pad-key="clear">清空</button>
        <button type="button" class="number-pad__key done" data-pad-key="done">完成</button>
      </footer>
    </section>
  `;

  document.body.append(container);
  els.numberPadRoot = container;
  els.numberPadTarget = container.querySelector("#numberPadTarget");

  bindIfPresent(els.numberPadRoot, "click", handleNumberPadClick);
}

function syncNumpadInputMode() {
  if (!els.numericInputs) {
    return;
  }

  const mobile = isMobileViewport();
  els.numericInputs.forEach((input) => {
    if (mobile) {
      input.setAttribute("readonly", "readonly");
      return;
    }

    input.removeAttribute("readonly");
  });

  if (!mobile) {
    closeNumberPad();
  }
}

function openNumberPad(input) {
  if (!isMobileViewport() || !els.numberPadRoot || !input) {
    return;
  }

  activeNumpadInput = input;
  const label = getInputFriendlyName(input);
  if (els.numberPadTarget) {
    els.numberPadTarget.textContent = label;
  }

  els.numberPadRoot.classList.add("show");
  els.numberPadRoot.setAttribute("aria-hidden", "false");
  document.body.classList.add("number-pad-open");
}

function closeNumberPad() {
  if (!els.numberPadRoot) {
    return;
  }

  els.numberPadRoot.classList.remove("show");
  els.numberPadRoot.setAttribute("aria-hidden", "true");
  document.body.classList.remove("number-pad-open");
  activeNumpadInput = null;
}

function handleNumpadFocusIn(event) {
  if (!els.numberPadRoot || !isMobileViewport()) {
    return;
  }

  const target = event.target;
  const isNumericTarget =
    target instanceof HTMLElement && target.matches("input[data-numpad='true']");
  const isInsideNumpad =
    target instanceof Node && els.numberPadRoot.contains(target);

  if (!isNumericTarget && !isInsideNumpad) {
    closeNumberPad();
  }
}

function handleNumberPadClick(event) {
  const button = event.target.closest("button[data-pad-key]");
  if (!button || !activeNumpadInput) {
    return;
  }

  const key = button.dataset.padKey;
  const current = activeNumpadInput.value || "";

  if (key === "done") {
    activeNumpadInput.blur();
    closeNumberPad();
    return;
  }

  if (key === "clear") {
    updateNumpadValue("");
    return;
  }

  if (key === "back") {
    updateNumpadValue(current.slice(0, -1));
    return;
  }

  if (key === "dot") {
    if (current.includes(".")) {
      return;
    }

    updateNumpadValue(current ? `${current}.` : "0.");
    return;
  }

  if (/^[0-9]$/.test(key)) {
    const nextValue = current === "0" ? key : `${current}${key}`;
    updateNumpadValue(nextValue);
  }
}

function updateNumpadValue(nextValue) {
  if (!activeNumpadInput) {
    return;
  }

  activeNumpadInput.value = nextValue;
  activeNumpadInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function getInputFriendlyName(input) {
  if (!input || !input.id) {
    return "金額";
  }

  const label = document.querySelector(`label[for='${input.id}']`);
  if (label) {
    return label.textContent.trim();
  }

  return "金額";
}

function isMobileViewport() {
  return window.matchMedia(`(max-width: ${MOBILE_VIEWPORT_WIDTH}px)`).matches;
}

function initializeInstallPrompt() {
  if (!els.installAppButton) {
    return;
  }

  bindIfPresent(els.installAppButton, "click", () => {
    void handleInstallPrompt();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    showMessage("已成功加入主畫面。", "success");
  });
}

async function handleInstallPrompt() {
  if (isStandaloneMode()) {
    showMessage("此網站已在主畫面。", "success");
    return;
  }

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choiceResult = await deferredInstallPrompt.userChoice;
    if (choiceResult && choiceResult.outcome === "accepted") {
      showMessage("安裝請求已送出。", "success");
    } else {
      showMessage("您已取消安裝，可稍後再試。", "warn");
    }
    deferredInstallPrompt = null;
    return;
  }

  if (isIOSDevice()) {
    showMessage("iOS：點「分享」→「加入主畫面」。", "warn");
    return;
  }

  showMessage("Android：開啟瀏覽器選單，選「加到主畫面」。", "warn");
}

function isIOSDevice() {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return (
    /iphone|ipad|ipod/i.test(userAgent) ||
    (platform === "MacIntel" && Number(navigator.maxTouchPoints) > 1)
  );
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(window.navigator.standalone)
  );
}

function bindIfPresent(element, eventName, handler) {
  if (element) {
    element.addEventListener(eventName, handler);
  }
}

function focusInput(inputId) {
  const target = document.getElementById(inputId);
  if (!target) {
    return;
  }

  target.focus();
  if (typeof target.select === "function" && target.type !== "number") {
    target.select();
  }
}

function scrollToSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showConfirm(options, onConfirm) {
  const config =
    typeof options === "string"
      ? { title: "確認操作", message: options, confirmText: "確定" }
      : {
          title: options.title || "確認操作",
          message: options.message || "",
          confirmText: options.confirmText || "確定",
        };

  if (
    !els.confirmModal ||
    !els.confirmTitle ||
    !els.confirmMessage ||
    !els.confirmOk ||
    typeof els.confirmModal.showModal !== "function"
  ) {
    if (window.confirm(config.message)) {
      onConfirm();
    }
    return;
  }

  els.confirmTitle.textContent = config.title;
  els.confirmMessage.textContent = config.message;
  els.confirmOk.textContent = config.confirmText;

  pendingConfirmCallback = onConfirm;
  els.confirmModal.showModal();
  els.confirmOk.focus();

  els.confirmOk.onclick = () => {
    if (els.confirmModal.open) {
      els.confirmModal.close();
    }
    if (pendingConfirmCallback) {
      pendingConfirmCallback();
    }
    pendingConfirmCallback = null;
  };
}

function closeConfirmModal() {
  if (els.confirmModal && els.confirmModal.open) {
    els.confirmModal.close();
  }
  pendingConfirmCallback = null;
}

function handleConfirmBackdropClick(event) {
  if (!els.confirmModal) {
    return;
  }

  const rect = els.confirmModal.getBoundingClientRect();
  const isInside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;

  if (!isInside) {
    closeConfirmModal();
  }
}

function showMessage(text, tone = "success") {
  if (!els.messageBar) {
    return;
  }

  els.messageBar.textContent = text;
  els.messageBar.dataset.tone = tone;
  els.messageBar.classList.add("show");

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    els.messageBar.classList.remove("show");
  }, 2800);
}
