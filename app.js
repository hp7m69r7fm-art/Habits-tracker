import {
  dayKey, dayDate, shiftDay, weekday, createState, validateState, makeHabit, editHabit,
  archiveHabit, isDue, habitStatus, toggleHabit, streak, quitCurrentInputs, quitLog,
  canLog, saveLog, removeLog, missingDays, markMissingDays, quitSummary, lastSmoke,
} from "./model.js";

const main = document.querySelector("#app");
const nav = document.querySelector("#tabs");
const sheet = document.querySelector("#sheet");
const quick = document.querySelector("#quick");
const toast = document.querySelector("#toast");
const storageKey = `habit-tracker:v1:${new URL("./", location.href).pathname}`;
const stateKey = `${storageKey}:data`;
const themeKey = `${storageKey}:theme`;
const weekNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const statusNames = {
  done: "Выполнено", off: "Выполнено вне плана", missed: "Пропущено",
  scheduled: "Запланировано", none: "Вне расписания",
};
const symbols = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  focus: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="m8 13 3 3 5-6M7 2v4m10-4v4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4m8-4v4m-8 8h2m4 0h2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  arrow: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="15" cy="17" r="2" fill="currentColor"/>',
  spark: '<path d="M12 3c1.2 5.6 3.4 7.8 9 9-5.6 1.2-7.8 3.4-9 9-1.2-5.6-3.4-7.8-9-9 5.6-1.2 7.8-3.4 9-9Z"/>',
  book: '<path d="M12 6c-3.1-2-6-2.4-9-1v14c3-1.4 5.9-1 9 1 3.1-2 6-2.4 9-1V5c-3-1.4-5.9-1-9 1Zm0 0v14"/>',
  drop: '<path d="M12 2c-2 4-7 9-7 13a7 7 0 0 0 14 0c0-4-5-9-7-13Z"/>',
  walk: '<circle cx="14.5" cy="4.5" r="2"/><path d="m8 21 3-6-2-3 3-4 2 4 5 2m-8 1 4 3 1 3M9 12l-5 2"/>',
  lung: '<path d="M12 3v8m-4-6c-3 2-5 6-5 11 0 3 4 4 7 1V9m6-4c3 2 5 6 5 11 0 3-4 4-7 1V9m-4 3 2-2 2 2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  money: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M6 9h1m10 6h1"/>',
  wind: '<path d="M3 8h13a2 2 0 1 0-2-2M3 12h17a2 2 0 1 0-2-2M3 16h10a2 2 0 1 1-2 2"/>',
  archive: '<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M3 4h18v4H3zM9 12h6"/>',
  edit: '<path d="m15 5 4 4M5 19l4-1 11-11-4-4L5 14l0 5Z"/>',
  minus: '<path d="M5 12h14"/>',
  dot: '<circle cx="12" cy="12" r="3"/>',
};

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const icon = (name) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name] || symbols.spark}</svg>`;
const formatDay = (key, options) => new Intl.DateTimeFormat("ru-RU", options).format(dayDate(key));
const longDay = (key) => formatDay(key, { day: "numeric", month: "long", year: "numeric" });
const shortDay = (key) => formatDay(key, { day: "numeric", month: "short" });
const number = (value, digits = 1) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);
const money = (value, currency) => new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const timeLabel = (value) => `${String(Math.floor(value / 3600)).padStart(2, "0")}:${String(Math.floor(value / 60) % 60).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const localTime = (date) => [date.getHours(), date.getMinutes()].map((value) => String(value).padStart(2, "0")).join(":");
const localDateTime = (date) => `${dayKey(date)}T${localTime(date)}`;
const capitalize = (text) => text.charAt(0).toLocaleUpperCase("ru") + text.slice(1);
const clone = (value) => JSON.parse(JSON.stringify(value));

let storageProblem = "";
let state = createState();
let theme = "system";
try {
  const raw = localStorage.getItem(stateKey);
  if (raw) state = validateState(JSON.parse(raw));
  const savedTheme = localStorage.getItem(themeKey);
  if (["light", "dark"].includes(savedTheme)) theme = savedTheme;
} catch {
  storageProblem = "Не удалось прочитать сохраненные данные. Восстановите их из резервной копии.";
}

let screen = "today";
let activeQuit;
let selectedHabit;
let selectedDay;
let month = `${dayKey().slice(0, 7)}-01`;
let period = "week";
let customRange;
let modal;
let previousFocus;
let clearToast;
let lastRenderedDay = dayKey();
let pendingRestore;
let reminderSignature = "";

function button(action, label, extra = "") {
  return `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
}

function iconButton(action, name, label, extra = "") {
  return button(action, icon(name), `aria-label="${escape(label)}" ${extra}`);
}

function getHabit(id) {
  return state.habits.find((habit) => habit.id === id);
}

function notify(message) {
  clearTimeout(clearToast);
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearToast = setTimeout(() => toast.classList.remove("is-visible"), 3500);
}

function persist(next) {
  localStorage.setItem(stateKey, JSON.stringify(next));
  state = next;
  storageProblem = "";
}

function mutate(operation) {
  if (storageProblem) throw new Error(storageProblem);
  const next = clone(state);
  operation(next);
  persist(next);
}

function update(id, operation) {
  mutate((next) => {
    const habit = next.habits.find((item) => item.id === id);
    if (!habit) throw new Error("Привычка недоступна.");
    operation(habit);
  });
}

function go(view) {
  screen = view;
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

function figureFor(habit) {
  const name = habit.title.toLocaleLowerCase("ru");
  if (/чита|книг/.test(name)) return ["book", "lilac"];
  if (/вод|пить/.test(name)) return ["drop", "mint"];
  if (/прогул|гуля|ход/.test(name)) return ["walk", "peach"];
  return habit.kind === "quit" ? ["lung", "peach"] : ["spark", "lilac"];
}

function cardIcon(habit) {
  const [symbol, tone] = figureFor(habit);
  return `<span class="habit-icon tone-${tone}">${icon(symbol)}</span>`;
}

function miniMap(habit, today) {
  const first = shiftDay(today, -(weekday(today) - 1) - 21);
  const cells = Array.from({ length: 28 }, (_, i) => {
    const day = shiftDay(first, i);
    const status = day > today ? "none" : habitStatus(habit, day, today);
    return `<i class="cell is-${status}${day === today ? " is-today" : ""}"></i>`;
  }).join("");
  return `<div class="habit-history" aria-hidden="true"><div class="mini-grid">${cells}</div><small>4 недели</small></div>`;
}

function regularCard(habit, today) {
  const done = habitStatus(habit, today, today) === "done";
  const title = escape(habit.title);
  const id = escape(habit.id);
  return `<article class="habit-card">
    <div class="habit-row">
      ${cardIcon(habit)}
      ${button("edit", `<strong>${title}</strong><small>Серия ${streak(habit, today)}</small>`, `class="habit-main" data-id="${id}"`)}
      ${miniMap(habit, today)}
      ${iconButton("toggle", done ? "check" : "plus", `Отметить выполнение привычки «${habit.title}»`,
          `class="complete${done ? " is-done" : ""}" aria-pressed="${done}" data-id="${id}"`)}
    </div>
  </article>`;
}

function quitStatus(habit, day) {
  const entry = quitLog(habit, day);
  return entry == null ? "Нет записи" : entry.count === 0 ? "Без сигарет" : `Записано ${entry.count} сиг.`;
}

function quitCard(habit, today) {
  const id = escape(habit.id);
  return `<article class="habit-card quit-card">
    <div class="habit-row">
      ${cardIcon(habit)}
      ${button("quit", `<strong>${escape(habit.title)}</strong><small>${quitStatus(habit, today)}</small>`, `class="habit-main" data-id="${id}"`)}
      ${iconButton("quit", "arrow", "Открыть прогресс", `class="icon-button" data-id="${id}"`)}
    </div>
    ${quitActions(habit, today)}
  </article>`;
}

function quitActions(habit, day) {
  const id = escape(habit.id);
  return `<div class="quit-actions">
    ${button("zero", `${icon("check")} Без сигарет`, `class="button primary" data-id="${id}" data-day="${day}"`)}
    ${button("log", `${icon("edit")} Указать количество`, `class="button secondary" data-id="${id}" data-day="${day}"`)}
  </div>`;
}

function dueReminders(now = new Date()) {
  const today = dayKey(now);
  const time = localTime(now);
  return state.habits.filter((habit) => !habit.archivedAt && habit.reminder && habit.reminder <= time &&
    (habit.kind === "quit" ? !quitLog(habit, today) : isDue(habit, today) && habitStatus(habit, today) !== "done"));
}

function renderReminder() {
  const container = document.querySelector("#due-reminders");
  if (!container) return;
  const due = dueReminders();
  const signature = due.map((habit) => `${habit.id}:${habit.title}:${habit.reminder}`).join(",");
  if (signature === reminderSignature) return;
  reminderSignature = signature;
  container.innerHTML = due.length ? `<div class="notice reminder-notice">${icon("clock")}<span><strong>Напоминания</strong><br>${due.map((habit) => escape(habit.title)).join(", ")}</span></div>` : "";
}

function renderToday() {
  const today = dayKey();
  const active = state.habits.filter((habit) => !habit.archivedAt);
  const regular = active.filter((habit) => habit.kind === "regular" && isDue(habit, today));
  const quits = active.filter((habit) => habit.kind === "quit");
  const completed = regular.filter((habit) => habitStatus(habit, today) === "done").length;
  const monday = shiftDay(today, 1 - weekday(today));
  const week = weekNames.map((name, i) => {
    const day = shiftDay(monday, i);
    return `<div class="day${day === today ? " is-today" : ""}" aria-label="${escape(longDay(day))}"${day === today ? ' aria-current="date"' : ""}><span>${name}</span><b>${Number(day.slice(-2))}</b></div>`;
  }).join("");
  const progress = regular.length ? `<div class="hero-stat"><strong>${completed}<span>/${regular.length}</span></strong><span>выполнено</span></div>
    <div class="progress-track" role="progressbar" aria-label="Выполнено привычек" aria-valuenow="${completed}" aria-valuemax="${regular.length}"><span style="width:${completed / regular.length * 100}%"></span></div>` : "";
  return `<header class="hero">
    <div class="hero-meta"><span>${escape(capitalize(formatDay(today, { weekday: "long", day: "numeric", month: "long" })))}</span>
    ${iconButton("settings", "settings", "Настройки", 'class="hero-icon"')}</div>
    <h1>Сегодня</h1>${progress}<div class="week" aria-label="Текущая неделя">${week}</div>
  </header>
  <div id="due-reminders" aria-live="polite"></div>
  <section class="section">
    <div class="section-heading"><h2>Привычки на сегодня</h2></div>
    ${regular.map((habit) => regularCard(habit, today)).join("")}
    ${quits.map((habit) => quitCard(habit, today)).join("")}
    ${regular.length || quits.length ? "" : `<div class="empty">${icon("spark")}<p>${active.length ? "На сегодня ничего не запланировано" : "Добавьте первую привычку"}</p>${button("new", "Добавить привычку", 'class="button secondary"')}</div>`}
  </section>`;
}

function calendarStatus(habit, day, today) {
  if (habit.kind === "regular") {
    const status = habitStatus(habit, day, today);
    const glyph = { done: "check", off: "check", missed: "close", scheduled: "dot", none: "minus" }[status];
    return [status, statusNames[status], glyph];
  }
  if (!canLog(habit, day)) return ["none", "Вне периода отслеживания", "minus"];
  const entry = quitLog(habit, day);
  return entry == null ? ["scheduled", "Нет записи", "dot"] : entry.count === 0 ?
    ["done", "Без сигарет", "check"] : ["missed", quitStatus(habit, day), "edit"];
}

function renderCalendar() {
  const today = dayKey();
  const habit = getHabit(selectedHabit) ?? state.habits.find((item) => !item.archivedAt) ?? state.habits[0];
  if (!habit) return `<header class="page-header"><h1>Календарь</h1></header><div class="empty"><p>Календарь появится после добавления привычки</p>${button("new", "Добавить привычку", 'class="button primary"')}</div>`;
  const shift = weekday(month) - 1;
  const date = dayDate(month);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = shiftDay(month, i);
    const [status, title, glyph] = calendarStatus(habit, day, today);
    return button("day", `<strong>${i + 1}</strong>${icon(glyph)}`,
      `class="calendar-day is-${status}${day === selectedDay ? " is-selected" : ""}${day === today ? " is-today" : ""}"
        data-day="${day}" aria-label="${escape(`${longDay(day)}: ${title}`)}" aria-pressed="${day === selectedDay}"`);
  }).join("");
  const detail = selectedDay && selectedDay.slice(0, 7) === month.slice(0, 7) ?
    `<div class="notice day-detail"><strong>${escape(longDay(selectedDay))}</strong><span>${calendarStatus(habit, selectedDay, today)[1]}</span>
     ${habit.kind === "quit" && canLog(habit, selectedDay) ? button("log", "Открыть запись", `class="button secondary" data-id="${escape(habit.id)}" data-day="${selectedDay}"`) : ""}</div>` : "";
  const legend = habit.kind === "quit" ? [["done", "Без сигарет"], ["missed", "Количество записано"], ["scheduled", "Нет записи"], ["none", "Вне периода"]] :
    Object.entries(statusNames);
  return `<header class="page-header"><h1>Календарь</h1></header>
    <label class="field list-card">Привычка<select data-control="habit">${state.habits.map((item) => `<option value="${escape(item.id)}"${item.id === habit.id ? " selected" : ""}>${escape(item.title)}${item.archivedAt ? " (архив)" : ""}</option>`).join("")}</select></label>
    <section class="month-card">
      <div class="month-controls"><h2>${escape(capitalize(formatDay(month, { month: "long", year: "numeric" })))}</h2>
      <div>${iconButton("prev-month", "left", "Предыдущий месяц", 'class="icon-button"')}${iconButton("next-month", "arrow", "Следующий месяц", 'class="icon-button"')}</div></div>
      <div class="month-grid" role="group" aria-label="Дни месяца">
        ${weekNames.map((name) => `<span class="weekday">${name}</span>`).join("")}
        ${'<span aria-hidden="true"></span>'.repeat(shift)}
        ${days}
      </div>
      ${detail}
      <div class="legend">${legend.map(([status, label]) => `<span class="legend-item"><i class="cell is-${status}"></i>${label}</span>`).join("")}</div>
    </section>
    ${habit.kind === "regular" ? recentHabitStats(habit, today) : button("quit", "Открыть прогресс", `class="button secondary" data-id="${escape(habit.id)}"`)}`;
}

function recentHabitStats(habit, today) {
  const days = Array.from({ length: 7 }, (_, index) => shiftDay(today, -index));
  const due = days.filter((day) => isDue(habit, day));
  const completed = due.filter((day) => habitStatus(habit, day, today) === "done");
  const rate = due.length ? `Выполнено ${completed.length} из ${due.length}` : "Пока нет запланированных дней";
  return `<section class="list-card"><h2>За последние 7 дней</h2><p>${rate}</p><p class="subtle">Текущая серия ${streak(habit, today)}</p></section>`;
}

function renderHabits() {
  const rows = (items) => items.map((habit) => `<div class="list-row">
    ${cardIcon(habit)}
    ${button(habit.kind === "quit" ? "quit" : habit.archivedAt ? "habit-calendar" : "edit",
      `<strong>${escape(habit.title)}</strong><small>${habit.kind === "quit" ? "Дневник" : habit.reminder ? `Напоминание в ${escape(habit.reminder)}` : "Обычная привычка"}</small>`,
      `class="habit-main" data-id="${escape(habit.id)}"`)}
    ${icon(habit.archivedAt ? "archive" : "arrow")}
  </div>`).join("");
  const active = state.habits.filter((habit) => !habit.archivedAt);
  const archived = state.habits.filter((habit) => habit.archivedAt);
  return `<header class="page-header"><h1>Привычки</h1>${iconButton("settings", "settings", "Настройки", 'class="icon-button"')}</header>
    <section class="section"><div class="section-heading"><h2>Активные</h2></div>
      ${active.length ? `<div class="list-card">${rows(active)}</div>` : '<div class="empty">Пока нет активных привычек</div>'}
      ${button("new", `${icon("plus")} Добавить привычку`, 'class="button primary"')}</section>
    ${archived.length ? `<section class="section"><div class="section-heading"><h2>Архив</h2></div><div class="list-card">${rows(archived)}</div></section>` : ""}`;
}

const metricSpec = {
  smokeFree: ["Дней без сигарет", "focus", "mint"],
  cigarettes: ["Меньше сигарет", "lung", "peach", "Больше сигарет"],
  money: ["Расчетная экономия", "money", "mint", "Расход выше прежнего"],
  minutes: ["Сэкономленное время", "clock", "lilac", "Больше времени на курение"],
  tar: ["Смола", "wind", "peach"], nicotine: ["Никотин", "wind", "lilac"], co: ["Угарный газ", "wind", "mint"],
};

function isSubstance(key) {
  return ["tar", "nicotine", "co"].includes(key);
}

function rangeFor(habit) {
  const end = dayKey(habit.archivedAt ? new Date(habit.archivedAt) : new Date());
  if (period === "custom") return customRange;
  if (period === "all") return {};
  return { from: shiftDay(end, period === "month" ? -29 : -6), to: end };
}

function metricInfo(key, summary) {
  const [label, glyph, tone, negative] = metricSpec[key];
  const entry = key === "smokeFree" ? { value: summary.recorded ? summary.smokeFree : null, known: summary.recorded } :
    key === "cigarettes" ? { value: summary.recorded ? summary.savedCigarettes : null, known: summary.recorded } : summary.metrics[key];
  const { value, known } = entry;
  const magnitude = Math.abs(value ?? 0);
  let text = "—";
  if (value != null && summary.recorded) {
    if (key === "money") text = money(magnitude, summary.currency);
    else if (key === "minutes") {
      const rounded = Math.round(magnitude);
      text = rounded < 60 ? `${rounded} мин` : `${Math.floor(rounded / 60)} ч ${rounded % 60} мин`;
    } else if (isSubstance(key)) text = magnitude >= 1000 ? `${number(magnitude / 1000, 3)} г` : `${number(magnitude, 3)} мг`;
    else text = number(magnitude);
  }
  const note = value == null ? (summary.recorded ? "Добавить данные" : "Нет записей") :
    isSubstance(key) ? (value < 0 ? "Расчетный рост" : value > 0 ? "Расчетное снижение" : "Без разницы") :
      key === "cigarettes" ? "относительно прежнего" : known < summary.recorded ? `По ${known} из ${summary.recorded} дней` : "";
  return { label: value < 0 && negative ? negative : label, text, note, glyph, tone, known, value };
}

function metricCard(habit, key, summary) {
  const info = metricInfo(key, summary);
  const id = escape(habit.id);
  const actionable = summary.recorded && info.value == null && !habit.archivedAt;
  return button(actionable ? "edit" : "formula",
    `<span class="metric-icon tone-${info.tone}">${icon(info.glyph)}</span>
    <span class="metric-label">${info.label}</span><strong class="metric-value">${escape(info.text)}</strong>
    <small class="metric-note">${escape(info.note)}</small>`,
    `class="metric-card" data-id="${id}" data-metric="${key}" aria-label="${escape(`${info.label}: ${info.text}. ${actionable ? "Добавить данные" : "Как рассчитано"}`)}"`);
}

function quitStats(habit) {
  const summary = quitSummary(habit, rangeFor(habit));
  return `<div class="coverage">Заполнено ${summary.recorded} из ${summary.tracked} дней${summary.partial ? " · сегодня предварительно" : ""}</div>
    <div class="metric-grid">${Object.keys(metricSpec).map((key) => metricCard(habit, key, summary)).join("")}</div>
    <p class="subtle metric-note">Смола, никотин и угарный газ – оценка по указанным показателям дыма.</p>
    ${chart(summary, habit)}`;
}

function chart(summary, habit) {
  const shown = summary.days.slice(-14);
  const max = Math.max(1, ...shown.map((entry) => Math.max(entry.actual ?? 0, entry.expected)));
  const bars = shown.map((day) => `<div class="chart-column">
      <div class="chart-bar${day.actual == null ? " no-entry" : ""}" style="--amount:${day.actual == null ? 0 : Math.min(day.actual / max * 100, 100)}%;--expected:${Math.min(day.expected / max * 100, 100)}%"></div>
      <small class="chart-day">${Number(day.key.slice(-2))}</small>
    </div>`).join("");
  return `<section class="chart list-card"><h2>Сигареты по дням</h2>
    ${shown.length ? `<div class="chart-bars" aria-hidden="true">${bars}</div><p class="subtle">Риски показывают прежний уровень. Столбцы – записи за последние ${shown.length} дней выбранного периода.</p>` : "<p>Нет дней в выбранном периоде</p>"}
    ${button("journal", "Записи и значения по датам", `class="button secondary" data-id="${escape(habit.id)}"`)}
  </section>`;
}

function renderQuit() {
  const habit = getHabit(activeQuit);
  if (!habit) return renderToday();
  const end = dayKey(habit.archivedAt ? new Date(habit.archivedAt) : new Date());
  const timerLabel = lastSmoke(habit) ? "С последней отмеченной сигареты" : "С начала отслеживания";
  return `<header class="hero quit-hero">
    <div class="hero-meta">${iconButton("today", "left", "На экран Сегодня", 'class="hero-icon"')}
    ${habit.archivedAt ? '<span class="pill">Архив</span>' : iconButton("edit", "settings", "Настройки трекера", `class="hero-icon" data-id="${escape(habit.id)}"`)}</div>
    <h1>${escape(habit.title)}</h1>
    <div class="timer"><span>${timerLabel}</span><div><strong id="timer-days">0 дн.</strong><span id="timer-clock">00:00:00</span></div></div>
    ${habit.archivedAt ? `<p class="subtle">На момент архива · ${escape(longDay(end))}</p>` : `<p class="quit-status">Сегодня · ${quitStatus(habit, end)}</p>${quitActions(habit, end)}`}
  </header>
  <section class="section"><div class="section-heading"><h2>Прогресс</h2>
    <select class="period-picker" aria-label="Период" data-control="period">
      ${[["week", "7 дней"], ["month", "30 дней"], ["all", "Все время"], ["custom", "Свой период"]].map(([key, name]) => `<option value="${key}"${key === period ? " selected" : ""}>${name}</option>`).join("")}
    </select></div>
    <div id="quit-stats">${quitStats(habit)}</div>
    ${button("bulk", "Подтвердить прошедшие дни без сигарет", `class="button secondary" data-id="${escape(habit.id)}"`)}
  </section>`;
}

function updateTimer() {
  const days = document.querySelector("#timer-days");
  const clock = document.querySelector("#timer-clock");
  const habit = getHabit(activeQuit);
  if (!days || !clock || !habit) return;
  const baseline = new Date(lastSmoke(habit) ?? habit.quit.startAt);
  const stop = habit.archivedAt ? new Date(habit.archivedAt) : new Date();
  const seconds = Math.max(0, Math.floor((stop - baseline) / 1000));
  days.textContent = `${Math.floor(seconds / 86400)} дн.`;
  clock.textContent = timeLabel(seconds % 86400);
}

function render() {
  lastRenderedDay = dayKey();
  reminderSignature = "";
  main.dataset.screen = screen;
  main.innerHTML = (storageProblem ? `<p class="notice" role="alert">${escape(storageProblem)}</p>` : "") +
    (screen === "calendar" ? renderCalendar() : screen === "habits" ? renderHabits() : screen === "quit" ? renderQuit() : renderToday());
  quick.hidden = screen !== "today";
  nav.innerHTML = [["today", "focus", "Сегодня"], ["calendar", "calendar", "Календарь"], ["habits", "grid", "Привычки"]]
    .map(([page, glyph, title]) => button(page, `${icon(glyph)}<span>${title}</span>`,
      `class="tab"${(screen === page || (page === "today" && screen === "quit")) ? ' aria-current="page"' : ""}`)).join("");
  renderReminder();
  updateTimer();
}

function openSheet(type, title, content, details = {}, focus = "") {
  modal = { type, ...details };
  if (!sheet.open) previousFocus = document.activeElement;
  sheet.innerHTML = `<div class="sheet-head"><h2 id="sheet-title">${escape(title)}</h2>${iconButton("close", "close", "Закрыть", 'class="icon-button"')}</div>${content}`;
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
  if (focus) sheet.querySelector(focus)?.focus();
}

function closeSheet() {
  if (sheet.open) sheet.close();
}

sheet.addEventListener("close", () => {
  modal = null;
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  else main.focus({ preventScroll: true });
});
sheet.addEventListener("click", (event) => { if (event.target === sheet) closeSheet(); });

function form(fields, tail = "", submit = "Сохранить") {
  return `<form class="sheet-form">${fields}<p class="form-status" role="alert" hidden></p>
    <div class="form-actions"><button class="button primary" type="submit">${submit}</button>${tail}</div></form>`;
}

function input(label, name, value = "", attributes = "") {
  return `<label class="field">${label}<input name="${name}" value="${escape(value)}" ${attributes}></label>`;
}

function moneyFields(values) {
  const field = (label, key) => input(label, key, values[key] ?? "", 'inputmode="decimal" placeholder="—"');
  return `<details class="details"><summary>Данные для расчетов</summary>
    <div class="field-grid">${field("Цена пачки", "price")}${input("Сигарет в пачке", "size", values.size ?? "", 'inputmode="numeric" placeholder="—"')}</div>
    ${input("Валюта", "currency", values.currency ?? "RUB", 'maxlength="3" autocomplete="off" autocapitalize="characters"')}
    ${field("Время на сигарету, мин", "minutes")}
    <div class="field-grid">${field("Смола, мг/сиг.", "tar")}${field("Никотин, мг/сиг.", "nicotine")}</div>
    ${field("Угарный газ, мг/сиг.", "co")}
    <p class="subtle">Введите показатели дыма на одну сигарету, указанные в вашем источнике.</p>
  </details>`;
}

function editSheet(habit, openMetrics = false) {
  const values = habit?.kind === "quit" ? quitCurrentInputs(habit) : {};
  const kind = habit?.kind ?? "regular";
  const now = new Date();
  const days = habit?.schedules?.filter((item) => item.from <= dayKey(now)).at(-1)?.days ?? [1, 2, 3, 4, 5, 6, 7];
  const allowedTypes = habit ? `<input type="hidden" name="kind" value="${kind}">` :
    '<label class="field">Тип<select name="kind" data-control="kind"><option value="regular">Обычная привычка</option><option value="quit">Отказ от курения</option></select></label>';
  const fields = `${input("Название", "title", habit?.title, 'placeholder="Читать 10 минут" maxlength="100" required')}${allowedTypes}
    <fieldset class="plain-fieldset" data-kind="regular"${kind === "regular" ? "" : " disabled hidden"}>
      <legend>Дни недели</legend><div class="choices">${weekNames.map((name, i) => `<label class="choice"><input name="days" type="checkbox" value="${i + 1}"${days.includes(i + 1) ? " checked" : ""}><span>${name}</span></label>`).join("")}</div>
    </fieldset>
    <fieldset class="plain-fieldset" data-kind="quit"${kind === "quit" ? "" : " disabled hidden"}>
      ${habit ? `<p class="subtle">Начало отслеживания · ${escape(longDay(dayKey(new Date(habit.quit.startAt))))}</p>` : input("Начало отслеживания", "start", localDateTime(now), `type="datetime-local" max="${localDateTime(now)}" required`)}
      ${input("Прежнее среднее, сигарет в день", "average", values.average ?? "", 'inputmode="decimal" placeholder="Например, 10" required')}
      ${moneyFields(values)}
      ${habit ? '<label class="inline-check"><input type="checkbox" name="backfill">Применить новые значения к прошлым дням с пустыми полями</label>' : ""}
    </fieldset>
    ${input("Напоминание в открытом трекере", "reminder", habit?.reminder ?? "", 'type="time"')}
    ${habit && !habit.archivedAt ? button("ask-archive", "Архивировать", `class="button text" data-id="${escape(habit.id)}"`) : ""}`;
  openSheet("habit", habit ? "Настройки привычки" : "Новая привычка", form(fields), { id: habit?.id }, habit ? "" : 'input[name="title"]');
  if (openMetrics) sheet.querySelector("details")?.setAttribute("open", "");
}

function logSheet(habit, day) {
  if (!canLog(habit, day)) throw new Error("Дата вне периода отслеживания.");
  const entry = quitLog(habit, day);
  const time = entry?.lastAt ? localTime(new Date(entry.lastAt)) : day === dayKey() ? localTime(new Date()) : "";
  const fields = `<p class="subtle">${escape(longDay(day))}</p>
    ${input("Количество сигарет", "count", entry?.count, 'type="number" min="0" step="1" inputmode="numeric" required')}
    ${input("Время последней сигареты", "time", time, 'type="time"')}
    <p class="subtle">При нуле время можно оставить пустым.</p>
    ${entry ? button("ask-remove", "Отменить запись", `class="button text" data-id="${escape(habit.id)}" data-day="${day}"`) : ""}`;
  openSheet("log", "Дневник", form(fields), { id: habit.id, day }, 'input[name="count"]');
}

function confirmSheet(title, text, action, details, submit = "Подтвердить") {
  openSheet(action, title, form(`<p>${escape(text)}</p>`, button("close", "Отмена", 'class="button secondary"'), submit), details);
}

function customSheet() {
  const habit = getHabit(activeQuit);
  const end = dayKey(habit.archivedAt ? new Date(habit.archivedAt) : new Date());
  const range = customRange ?? { from: shiftDay(end, -6), to: end };
  openSheet("period", "Свой период", form(`<div class="field-grid">
    ${input("С даты", "from", range.from, `type="date" max="${end}" required`)}
    ${input("По дату", "to", range.to, `type="date" max="${end}" required`)}</div>`, "", "Показать"));
}

function bulkSheet(habit) {
  const max = shiftDay(dayKey(), -1);
  const bounds = habit.archivedAt ? dayKey(new Date(habit.archivedAt)) : max;
  const end = max < bounds ? max : bounds;
  if (end < habit.quit.startDay) throw new Error("Пока нет прошедших дней для заполнения.");
  const from = shiftDay(end, -6);
  openSheet("bulk", "Подтвердить дни без сигарет",
    form(`<p>Выберите прошедшие дни. Заполненные записи сохранятся.</p><div class="field-grid">
    ${input("С даты", "from", from < habit.quit.startDay ? habit.quit.startDay : from, `type="date" min="${habit.quit.startDay}" max="${end}" required`)}
    ${input("По дату", "to", end, `type="date" min="${habit.quit.startDay}" max="${end}" required`)}</div>`, "", "Проверить даты"), { id: habit.id });
}

const formula = {
  smokeFree: "Количество полных прошедших дней, за которые записано ноль сигарет.",
  cigarettes: "За каждый заполненный день вычитаем фактическое количество из прежнего среднего. Для неполных суток учитываем только прошедшую часть дня. Складываем разницы со знаком.",
  money: "Дневная разница × цена пачки ÷ число сигарет в пачке. Применяем исходные данные, действовавшие на дату записи.",
  minutes: "Дневная разница × указанное время на одну сигарету.",
  tar: "Дневная разница × указанное количество смолы в дыме одной сигареты.",
  nicotine: "Дневная разница × указанное количество никотина в дыме одной сигареты.",
  co: "Дневная разница × указанное количество угарного газа в дыме одной сигареты.",
};

function rowsForDays(habit, summary, key) {
  return summary.days.slice().reverse().map((day) => {
    const amount = key === "money" && day.inputs.price != null && day.inputs.size ?
      ` · пачка ${money(day.inputs.price, summary.currency)}, ${day.inputs.size} шт.` :
      key === "minutes" && day.inputs.minutes != null ? ` · ${number(day.inputs.minutes)} мин/сиг.` :
      isSubstance(key) && day.inputs[key] != null ? ` · ${number(day.inputs[key], 3)} мг/сиг.` : "";
    return `<li class="log-row">
      <div><strong>${escape(longDay(day.key))}</strong><small>${escape(quitStatus(habit, day.key))} · расчетный уровень ${number(day.expected)}${escape(amount)}</small></div>
      ${canLog(habit, day.key) ? iconButton("log", "edit", `Запись за ${longDay(day.key)}`, `class="icon-button" data-id="${escape(habit.id)}" data-day="${day.key}"`) : ""}
    </li>`;
  }).join("");
}

function showJournal(habit, key = "") {
  const summary = quitSummary(habit, rangeFor(habit));
  const info = key ? metricInfo(key, summary) : null;
  const note = key ? `<div class="notice"><strong>${escape(info.label)} · ${escape(info.text)}</strong>
    <p>${formula[key]}</p><p>Учтено ${info.known} из ${summary.recorded} записанных дней.</p>
    ${isSubstance(key) ? "<p>Условная оценка по показателям дыма.</p>" : ""}</div>` : "";
  openSheet("journal", key ? "Как рассчитано" : "Дневник",
    `${note}${summary.days.length ? `<ul class="log-list">${rowsForDays(habit, summary, key)}</ul>` : "<p>Нет дней в выбранном периоде</p>"}`);
}

function settingsSheet() {
  openSheet("settings", "Настройки", `<label class="field">Оформление
    <select data-control="theme">${[["system", "Как на устройстве"], ["light", "Светлое"], ["dark", "Темное"]].map(([key, name]) =>
      `<option value="${key}"${key === theme ? " selected" : ""}>${name}</option>`).join("")}</select></label>
    <section class="section"><h3>Резервная копия</h3><p class="subtle">Записи хранятся на этом устройстве. Сохрани копию, чтобы перенести их.</p>
    <div class="form-actions">${button("export", "Скачать копию", 'class="button secondary"')}
    <label class="button secondary file-label">Восстановить<input class="sr-only" type="file" accept=".json,application/json" data-control="restore"></label></div></section>
    <p class="subtle">В Safari открой меню «Поделиться» и добавь приложение на экран «Домой».</p>`);
}

function applyTheme() {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

function exportData() {
  if (storageProblem) throw new Error(storageProblem);
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `habit-tracker-${dayKey()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function monthOffset(offset) {
  const date = dayDate(month);
  date.setMonth(date.getMonth() + offset);
  month = dayKey(date);
  selectedDay = undefined;
  render();
}

function saveZero(id, day) {
  update(id, (habit) => saveLog(habit, day, 0, null));
  notify("День отмечен");
}

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const { action, id, day, metric } = control.dataset;
  const habit = getHabit(id);
  try {
    switch (action) {
      case "today": case "calendar": case "habits": go(action); break;
      case "new": editSheet(); break;
      case "edit": if (habit) editSheet(habit, !!metric); break;
      case "settings": settingsSheet(); break;
      case "close": closeSheet(); break;
      case "toggle":
        update(id, (item) => toggleHabit(item, dayKey()));
        render();
        main.querySelector(`[data-action="toggle"][data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
        break;
      case "quit": activeQuit = id; period = "week"; customRange = undefined; go("quit"); break;
      case "habit-calendar": selectedHabit = id; selectedDay = undefined; go("calendar"); break;
      case "prev-month": monthOffset(-1); break;
      case "next-month": monthOffset(1); break;
      case "day": selectedDay = day; render(); main.querySelector(".calendar-day.is-selected")?.focus({ preventScroll: true }); break;
      case "log": if (habit) logSheet(habit, day); break;
      case "zero":
        if (habit && quitLog(habit, day)?.count > 0) confirmSheet("Заменить запись?", "За этот день будет записано ноль сигарет.", "zero", { id, day });
        else { saveZero(id, day); render(); }
        break;
      case "ask-remove": confirmSheet("Отменить запись?", "День будет отмечен как «Нет записи».", "remove", { id, day }, "Отменить запись"); break;
      case "ask-archive": confirmSheet("Архивировать привычку?", "История останется доступна в архиве.", "archive", { id }, "Архивировать"); break;
      case "formula": if (habit && metric in formula) showJournal(habit, metric); break;
      case "journal": if (habit) showJournal(habit); break;
      case "bulk": if (habit) bulkSheet(habit); break;
      case "export": exportData(); break;
    }
  } catch (error) {
    notify(error.message || "Операция недоступна.");
  }
});

function syncKind(value) {
  for (const fieldset of sheet.querySelectorAll("[data-kind]")) {
    fieldset.hidden = fieldset.dataset.kind !== value;
    fieldset.disabled = fieldset.hidden;
  }
  const title = sheet.querySelector('[name="title"]');
  if (value === "quit" && !title.value.trim()) title.value = "Отказ от курения";
}

document.addEventListener("change", async (event) => {
  const target = event.target;
  try {
    switch (target.dataset.control) {
      case "kind": syncKind(target.value); break;
      case "habit": selectedHabit = target.value; selectedDay = undefined; render(); main.querySelector('[data-control="habit"]')?.focus(); break;
      case "period":
        if (target.value === "custom") { target.value = period; customSheet(); }
        else { period = target.value; render(); main.querySelector('[data-control="period"]')?.focus(); }
        break;
      case "theme":
        localStorage.setItem(themeKey, target.value);
        theme = target.value; applyTheme();
        break;
      case "restore": {
        const file = target.files[0];
        if (!file) break;
        if (file.size > 8 * 1024 * 1024) throw new Error("Копия больше 8 МБ.");
        pendingRestore = validateState(JSON.parse(await file.text()));
        confirmSheet("Восстановить копию?", "Записи приложения будут заменены данными из выбранного файла.", "restore", {}, "Восстановить");
        break;
      }
    }
  } catch (error) {
    notify(error instanceof SyntaxError ? "Файл резервной копии поврежден." : error.message || "Не удалось применить изменение.");
  }
});

function decimal(formData, key, label, required = false) {
  const raw = String(formData.get(key) ?? "").trim().replace(",", ".");
  if (!raw && !required) return null;
  if (!/^\d+(?:\.\d+)?$/.test(raw) || !Number.isFinite(Number(raw))) throw new Error(`Проверьте поле «${label}».`);
  return Number(raw);
}

function valuesFrom(formData) {
  return {
    average: decimal(formData, "average", "Прежнее среднее", true),
    price: decimal(formData, "price", "Цена пачки"),
    size: decimal(formData, "size", "Сигарет в пачке"),
    currency: String(formData.get("currency") ?? "RUB").trim().toUpperCase(),
    minutes: decimal(formData, "minutes", "Время на сигарету"),
    tar: decimal(formData, "tar", "Смола"),
    nicotine: decimal(formData, "nicotine", "Никотин"),
    co: decimal(formData, "co", "Угарный газ"),
  };
}

sheet.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!modal) return;
  const current = modal;
  const data = new FormData(event.target);
  const { type, id, day } = current;
  try {
    switch (type) {
      case "habit": {
        const kind = data.get("kind");
        const title = String(data.get("title")).trim();
        const fields = { title, kind, reminder: String(data.get("reminder") ?? "") };
        if (kind === "regular") fields.days = data.getAll("days").map(Number);
        if (kind === "quit") {
          fields.inputs = valuesFrom(data);
          fields.backfill = data.get("backfill") === "on";
          if (!id) fields.startAt = new Date(String(data.get("start"))).toISOString();
        }
        if (id) update(id, (habit) => editHabit(habit, fields));
        else {
          const habit = makeHabit(fields);
          mutate((next) => next.habits.push(habit));
          screen = "today";
          window.scrollTo(0, 0);
        }
        notify("Сохранено");
        break;
      }
      case "log": {
        const count = Number(data.get("count"));
        const time = String(data.get("time") ?? "");
        if (count > 0 && !time) throw new Error("Укажите время последней сигареты.");
        const lastAt = count > 0 ? new Date(`${day}T${time}`).toISOString() : null;
        const habit = getHabit(id);
        if (count === 0 && quitLog(habit, day)?.count > 0) {
          confirmSheet("Заменить запись?", "За этот день будет записано ноль сигарет.", "zero", { id, day });
          return;
        }
        update(id, (item) => saveLog(item, day, count, lastAt));
        notify("Запись сохранена");
        break;
      }
      case "zero": saveZero(id, day); break;
      case "remove": update(id, (habit) => removeLog(habit, day)); notify("Запись отменена"); break;
      case "archive": update(id, (habit) => archiveHabit(habit)); notify("Привычка в архиве"); break;
      case "period": {
        const from = String(data.get("from")), to = String(data.get("to"));
        if (from > to) throw new Error("Дата окончания должна быть позже даты начала.");
        customRange = { from, to };
        period = "custom";
        break;
      }
      case "bulk": {
        const from = String(data.get("from")), to = String(data.get("to"));
        const pending = missingDays(getHabit(id), from, to);
        if (!pending.length) throw new Error("В этом диапазоне нет пустых прошедших дней.");
        confirmSheet("Заполнить выбранные дни?", `Дней без записей: ${pending.length}. В них будет записано ноль сигарет.`, "save-bulk", { id, from, to });
        return;
      }
      case "save-bulk":
        update(id, (habit) => markMissingDays(habit, current.from, current.to));
        notify("Дневник заполнен");
        break;
      case "restore":
        if (!pendingRestore) throw new Error("Выберите резервную копию.");
        persist(pendingRestore); pendingRestore = undefined; screen = "today"; notify("Копия восстановлена");
        break;
    }
    closeSheet();
    render();
  } catch (error) {
    const status = sheet.querySelector(".form-status");
    if (status) {
      status.hidden = false;
      status.textContent = error instanceof RangeError ? "Проверьте выбранные дату и время." : error.message || "Не удалось сохранить.";
    } else notify(error.message || "Не удалось сохранить.");
  }
});

function refresh() {
  if (document.hidden) return;
  const now = dayKey();
  if (now !== lastRenderedDay) render();
  renderReminder();
  const metrics = document.querySelector("#quit-stats");
  if (!sheet.open && metrics && !metrics.contains(document.activeElement)) {
    const habit = getHabit(activeQuit);
    if (habit && !habit.archivedAt) metrics.innerHTML = quitStats(habit);
  }
}

document.addEventListener("visibilitychange", refresh);
window.addEventListener("storage", (event) => {
  if (event.key === stateKey && event.newValue) {
    try {
      state = validateState(JSON.parse(event.newValue));
      storageProblem = "";
      render();
    } catch { notify("Не удалось загрузить изменения из другого окна."); }
  }
});
applyTheme();
render();
setInterval(updateTimer, 1000);
setInterval(refresh, 30_000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Не удалось настроить офлайн-доступ", error));
}
