const currentEl = document.getElementById("current");
const historyEl = document.getElementById("history");
const keys = document.querySelector(".keys");
const historyPanel = document.getElementById("history-panel");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const historyToggle = document.getElementById("history-toggle");
const themeToggle = document.getElementById("theme-toggle");

let current = "0";
let previous = null;
let operator = null;
let justEvaluated = false;
let error = false;
let log = [];

const symbols = { "/": "÷", "*": "×", "-": "−", "+": "+" };

/* ---------- storage helpers (safe if storage is blocked) ---------- */
function store(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}
function load(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

/* ---------- formatting ---------- */
function format(value) {
  if (value === "Error" || String(value).includes("e")) return String(value);
  const [int, dec] = String(value).split(".");
  const sign = int.startsWith("-") ? "-" : "";
  const digits = int.replace("-", "");
  const grouped = Number(digits).toLocaleString("en-US");
  return sign + grouped + (dec !== undefined ? "." + dec : "");
}

function clean(n) {
  return String(parseFloat(n.toPrecision(12)));
}

function update() {
  currentEl.textContent = format(current);
  currentEl.style.fontSize = current.length > 12 ? "1.8rem" : current.length > 8 ? "2.2rem" : "2.8rem";
  historyEl.textContent = previous !== null && operator
    ? `${format(previous)} ${symbols[operator]}`
    : "";
  document.querySelectorAll(".operator").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.value === operator && !justEvaluated && previous !== null && current === "");
  });
}

/* ---------- history panel ---------- */
function addLog(expr, result) {
  if (result === "Error") return;
  log.unshift({ expr, result });
  log = log.slice(0, 50);
  store("amit-calc-history", JSON.stringify(log));
  renderLog();
}

function renderLog() {
  historyList.innerHTML = "";
  log.forEach(item => {
    const li = document.createElement("li");
    const expr = document.createElement("span");
    expr.className = "expr";
    expr.textContent = item.expr;
    const res = document.createElement("span");
    res.className = "res";
    res.textContent = format(item.result);
    li.append(expr, res);
    li.title = "Click to use this result";
    li.addEventListener("click", () => {
      reset();
      current = item.result;
      justEvaluated = true;
      update();
    });
    historyList.appendChild(li);
  });
  historyEmpty.hidden = log.length > 0;
}

historyToggle.addEventListener("click", () => {
  const open = historyPanel.hidden;
  historyPanel.hidden = !open;
  historyToggle.setAttribute("aria-expanded", String(open));
});

document.getElementById("history-clear").addEventListener("click", () => {
  log = [];
  store("amit-calc-history", "[]");
  renderLog();
});

/* ---------- theme ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  store("amit-calc-theme", theme);
}
themeToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
});

/* ---------- calculator logic ---------- */
function compute(a, b, op) {
  a = parseFloat(a);
  b = parseFloat(b);
  let result;
  switch (op) {
    case "+": result = a + b; break;
    case "-": result = a - b; break;
    case "*": result = a * b; break;
    case "/": if (b === 0) return "Error"; result = a / b; break;
  }
  return clean(result);
}

function reset() {
  current = "0";
  previous = null;
  operator = null;
  justEvaluated = false;
  error = false;
}

function inputNumber(n) {
  if (error) reset();
  if (justEvaluated) {
    current = n;
    justEvaluated = false;
  } else if (current === "0") {
    current = n;
  } else if (current.replace(/[-.]/g, "").length < 15) {
    current += n;
  }
}

function inputDecimal() {
  if (error) reset();
  if (justEvaluated) {
    current = "0.";
    justEvaluated = false;
  } else if (current === "") {
    current = "0.";
  } else if (!current.includes(".")) {
    current += ".";
  }
}

function inputOperator(op) {
  if (error) return;
  if (operator && current !== "" && !justEvaluated) {
    current = compute(previous, current, operator);
    if (current === "Error") { error = true; previous = null; operator = null; return; }
  }
  previous = current === "" ? previous : current;
  operator = op;
  current = "";
  justEvaluated = false;
}

function equals() {
  if (error || operator === null || previous === null || current === "") return;
  const result = compute(previous, current, operator);
  const expr = `${format(previous)} ${symbols[operator]} ${format(current)}`;
  historyEl.textContent = `${expr} =`;
  addLog(expr, result);
  current = result;
  previous = null;
  operator = null;
  justEvaluated = true;
  if (result === "Error") error = true;
  currentEl.textContent = format(current);
  return true;
}

function percent() {
  if (error || current === "") return;
  current = clean(parseFloat(current) / 100);
}

function backspace() {
  if (error || justEvaluated) return;
  current = current.length > 1 ? current.slice(0, -1) : "0";
  if (current === "-") current = "0";
}

/* One-operand functions: sqrt, square, reciprocal, negate */
function unary(kind) {
  if (error || current === "") return;
  const x = parseFloat(current);
  const shown = format(current);
  let result, expr;
  switch (kind) {
    case "negate":
      current = current.startsWith("-") ? current.slice(1) : (x === 0 ? current : "-" + current);
      return;
    case "sqrt":
      expr = `√(${shown})`;
      if (x < 0) { current = "Error"; error = true; return; }
      result = Math.sqrt(x);
      break;
    case "square":
      expr = `(${shown})²`;
      result = x * x;
      break;
    case "reciprocal":
      expr = `1 ÷ (${shown})`;
      if (x === 0) { current = "Error"; error = true; return; }
      result = 1 / x;
      break;
  }
  current = clean(result);
  addLog(expr, current);
  justEvaluated = true;
}

function handle(action, value) {
  let keepHistory = false;
  switch (action) {
    case "number": inputNumber(value); break;
    case "decimal": inputDecimal(); break;
    case "operator": inputOperator(value); break;
    case "equals": keepHistory = equals(); break;
    case "percent": percent(); break;
    case "delete": backspace(); break;
    case "clear": reset(); break;
    case "sqrt":
    case "square":
    case "reciprocal":
    case "negate": unary(action); break;
  }
  const savedHistory = historyEl.textContent;
  update();
  if (keepHistory) historyEl.textContent = savedHistory;
}

keys.addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  handle(btn.dataset.action, btn.dataset.value);
});

document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[0-9]$/.test(e.key)) handle("number", e.key);
  else if (e.key === ".") handle("decimal");
  else if (["+", "-", "*", "/"].includes(e.key)) { e.preventDefault(); handle("operator", e.key); }
  else if (e.key === "Enter" || e.key === "=") { e.preventDefault(); handle("equals"); }
  else if (e.key === "Backspace") handle("delete");
  else if (e.key === "Escape") handle("clear");
  else if (e.key === "%") handle("percent");
});

/* ---------- init ---------- */
(function init() {
  const savedTheme = load("amit-calc-theme");
  const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(savedTheme || (prefersLight ? "light" : "dark"));
  try { log = JSON.parse(load("amit-calc-history") || "[]"); } catch (_) { log = []; }
  renderLog();
  update();
})();
