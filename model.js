const MAX = 1_000_000;
const FIELDS = ['price', 'size', 'minutes', 'tar', 'nicotine', 'co'];

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dayDate(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) throw Error('Некорректная дата');
  const date = new Date(`${key}T00:00:00`);
  if (dayKey(date) !== key || date.getFullYear() < 1900 || date.getFullYear() > 2200) throw Error('Дата вне допустимого периода 1900-2200');
  return date;
}

export function shiftDay(key, offset) {
  const date = dayDate(key);
  if (!Number.isSafeInteger(offset) || Math.abs(offset) > 110000) throw Error('Некорректный сдвиг даты');
  date.setDate(date.getDate() + offset);
  return dayKey(date);
}

export const weekday = key => dayDate(key).getDay() || 7;
export const createState = () => ({ version: 1, habits: [] });

function iso(value) {
  if (value == null || value === '') throw Error('Укажите время');
  const date = new Date(value);
  if (!Number.isFinite(+date)) throw Error('Некорректное время');
  dayDate(dayKey(date));
  return date.toISOString();
}

function titleOf(title) {
  if (typeof title !== 'string' || !title.trim() || title.length > 200) throw Error('Название должно содержать 1-200 символов');
  return title.trim();
}

function reminderOf(value) {
  if (typeof value !== 'string' || (value !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) throw Error('Некорректное время напоминания');
  return value;
}

function parseInputs(value = {}) {
  const result = { average: Number(value.average), currency: value.currency || 'RUB' };
  if (!Number.isFinite(result.average) || result.average <= 0 || result.average > MAX) throw Error('Укажите положительное среднее количество до 1000000');
  if (typeof result.currency !== 'string' || !/^[A-Z]{3}$/.test(result.currency)) throw Error('Укажите трехбуквенный код валюты');
  for (const key of FIELDS) {
    result[key] = value[key] == null || value[key] === '' ? null : Number(value[key]);
    if (result[key] !== null && (!Number.isFinite(result[key]) || result[key] < 0 || result[key] > MAX)) throw Error('Показатели должны быть от 0 до 1000000');
  }
  if (result.size !== null && (!Number.isSafeInteger(result.size) || result.size <= 0)) throw Error('Размер пачки должен быть положительным целым числом');
  if (result.price !== null && result.size === null) throw Error('Укажите размер пачки');
  return result;
}

function parseDays(days) {
  if (!Array.isArray(days) || !days.length || days.length > 7 || days.some(day => !Number.isInteger(day) || day < 1 || day > 7)) throw Error('Выберите дни недели');
  return [...new Set(days)].sort();
}

export function makeHabit({ title, kind = 'regular', days = [1, 2, 3, 4, 5, 6, 7], reminder = '', startAt, inputs }, now = new Date()) {
  const start = iso(startAt || now);
  if (!['regular', 'quit'].includes(kind)) throw Error('Некорректный тип привычки');
  if (new Date(start) > now) throw Error('Начало не может быть в будущем');
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: titleOf(title), kind,
    createdAt: iso(now), createdDay: dayKey(now),
    archivedAt: null, archivedDay: null,
    schedules: [{ from: dayKey(now), days: parseDays(days) }],
    done: {}, reminder: reminderOf(reminder),
    quit: kind === 'quit' ? {
      startAt: start, startDay: dayKey(new Date(start)),
      versions: [{ from: dayKey(new Date(start)), inputs: parseInputs(inputs) }],
      logs: {}
    } : null
  };
}

export const quitCurrentInputs = habit => habit.quit?.versions.at(-1)?.inputs;

export function editHabit(habit, { title, days, reminder, inputs, backfill }, now = new Date()) {
  // Validate every proposed value before mutating the record.
  const nextTitle = title === undefined ? habit.title : titleOf(title);
  const nextReminder = reminder === undefined ? habit.reminder : reminderOf(reminder);
  const nextDays = days === undefined ? null : parseDays(days);
  const nextInputs = inputs && habit.quit ? parseInputs(inputs) : null;
  if (nextInputs) {
    const priced = habit.quit.versions.find(version => version.inputs.price !== null);
    if (priced && nextInputs.currency !== priced.inputs.currency) throw Error('Валюта фиксируется после первого указания цены');
  }
  habit.title = nextTitle;
  habit.reminder = nextReminder;
  const from = dayKey(now);
  if (nextDays) {
    habit.schedules = habit.schedules.filter(schedule => schedule.from !== from);
    habit.schedules.push({ from, days: nextDays });
    habit.schedules.sort((a, b) => a.from.localeCompare(b.from));
  }
  if (nextInputs) {
    // Before a price is entered the currency is a preference, not financial history.
    if (!habit.quit.versions.some(version => version.inputs.price !== null)) {
      for (const version of habit.quit.versions) version.inputs.currency = nextInputs.currency;
    }
    if (backfill) {
      for (const version of habit.quit.versions) {
        for (const key of FIELDS) {
          if (version.inputs[key] === null && nextInputs[key] !== null) version.inputs[key] = nextInputs[key];
        }
      }
    }
    habit.quit.versions = habit.quit.versions.filter(version => version.from !== from);
    habit.quit.versions.push({ from, inputs: nextInputs });
    habit.quit.versions.sort((a, b) => a.from.localeCompare(b.from));
  }
  return habit;
}

export function archiveHabit(habit, now = new Date()) {
  habit.archivedAt = iso(now);
  habit.archivedDay = dayKey(now);
}

export function isDue(habit, key) {
  dayDate(key);
  if (key < habit.createdDay || (habit.archivedDay && key >= habit.archivedDay)) return false;
  return !![...habit.schedules].reverse().find(schedule => schedule.from <= key)?.days.includes(weekday(key));
}

export function habitStatus(habit, key, nowKey = dayKey()) {
  if (habit.done[key]) return isDue(habit, key) ? 'done' : 'off';
  if (!isDue(habit, key)) return 'none';
  return key < nowKey ? 'missed' : 'scheduled';
}

export function toggleHabit(habit, key) {
  dayDate(key);
  if (habit.done[key]) delete habit.done[key];
  else if (key >= habit.createdDay && key <= dayKey() && (!habit.archivedDay || key < habit.archivedDay)) habit.done[key] = true;
}

export function streak(habit, nowKey = dayKey()) {
  let count = 0;
  let key = nowKey;
  if (isDue(habit, key) && !habit.done[key]) key = shiftDay(key, -1);
  for (; key >= habit.createdDay; key = shiftDay(key, -1)) {
    if (!isDue(habit, key)) continue;
    if (!habit.done[key]) break;
    count++;
  }
  return count;
}

export const quitLog = (habit, key) => habit.quit?.logs[key] || null;

export function canLog(habit, key, now = new Date()) {
  dayDate(key);
  return !!habit.quit && key >= habit.quit.startDay && key <= (habit.archivedDay || dayKey(now)) && key <= dayKey(now);
}

export function saveLog(habit, key, count, lastAt, now = new Date()) {
  if (!canLog(habit, key, now) || !Number.isSafeInteger(count) || count < 0 || count > MAX) throw Error('Количество должно быть целым числом от 0 до 1000000');
  const old = quitLog(habit, key);
  const dayStart = old?.dayStart || dayDate(key).toISOString();
  const dayEnd = old?.dayEnd || dayDate(shiftDay(key, 1)).toISOString();
  let last = null;
  if (count > 0) {
    last = iso(lastAt);
    const moment = +new Date(last);
    if (moment < +new Date(dayStart) || moment >= +new Date(dayEnd) || moment < +new Date(habit.quit.startAt) || moment > +new Date(habit.archivedAt || now) || moment > +now) throw Error('Последняя сигарета должна входить в выбранный день и период учета');
  }
  return habit.quit.logs[key] = { count, lastAt: last, dayStart, dayEnd };
}

export function removeLog(habit, key) {
  dayDate(key);
  delete habit.quit.logs[key];
}

export function missingDays(habit, from, to, now = new Date()) {
  dayDate(from);
  dayDate(to);
  const result = [];
  let visited = 0;
  for (let key = from; key <= to; key = shiftDay(key, 1)) {
    if (++visited > 40000) throw Error('Слишком большой период');
    if (key < dayKey(now) && canLog(habit, key, now) && !quitLog(habit, key)) result.push(key);
  }
  return result;
}

export function markMissingDays(habit, from, to, now = new Date()) {
  for (const key of missingDays(habit, from, to, now)) saveLog(habit, key, 0, null, now);
}

export function lastSmoke(habit) {
  return Object.values(habit.quit?.logs || {}).filter(log => log.count > 0 && log.lastAt).map(log => log.lastAt).sort().at(-1) || null;
}

export function quitSummary(habit, { from, to } = {}, now = new Date()) {
  const quit = habit.quit;
  if (!quit) throw Error('Это не дневник отказа от курения');
  from = from && from > quit.startDay ? from : quit.startDay;
  const cap = habit.archivedDay || dayKey(now);
  to = to && to < cap ? to : cap;
  dayDate(from);
  dayDate(to);
  const metrics = Object.fromEntries(['money', 'minutes', 'tar', 'nicotine', 'co'].map(key => [key, { value: null, known: 0 }]));
  const result = { from, to, days: [], tracked: 0, recorded: 0, smokeFree: 0, partial: false, savedCigarettes: 0, metrics, currency: quitCurrentInputs(habit).currency };
  let visited = 0;
  for (let key = from; key <= to; key = shiftDay(key, 1)) {
    if (++visited > 40000) throw Error('Слишком большой период');
    const log = quitLog(habit, key);
    const start = +(log?.dayStart ? new Date(log.dayStart) : dayDate(key));
    const end = +(log?.dayEnd ? new Date(log.dayEnd) : dayDate(shiftDay(key, 1)));
    const lower = Math.max(start, +new Date(quit.startAt));
    const upper = Math.min(end, +now, habit.archivedAt ? +new Date(habit.archivedAt) : Infinity);
    if (upper <= lower) continue;
    const fraction = (upper - lower) / (end - start);
    const inputs = [...quit.versions].reverse().find(version => version.from <= key)?.inputs || quit.versions[0].inputs;
    const expected = inputs.average * fraction;
    const actual = log?.count ?? null;
    const diff = actual === null ? null : expected - actual;
    result.tracked++;
    result.days.push({ key, expected, actual, diff, inputs });
    if (!log) continue;
    result.recorded++;
    result.savedCigarettes += diff;
    result.partial ||= fraction < 1;
    if (fraction === 1 && log.count === 0) result.smokeFree++;
    for (const name of Object.keys(metrics)) {
      const factor = name === 'money' ? (inputs.price !== null && inputs.size ? inputs.price / inputs.size : null) : inputs[name];
      if (factor === null) continue;
      metrics[name].value = (metrics[name].value ?? 0) + diff * factor;
      metrics[name].known++;
    }
  }
  return result;
}

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Ожидается объект');
}

function ordered(list, minimum) {
  if (!Array.isArray(list) || list.length === 0 || list.length > 40000) throw Error('Некорректная история');
  let previous = null;
  for (const entry of list) {
    object(entry);
    dayDate(entry.from);
    if (entry.from < minimum || (previous && entry.from <= previous)) throw Error('Нарушен порядок истории');
    previous = entry.from;
  }
}

export function validateState(input) {
  // JSON roundtrip drops executable prototypes; the reviver rejects dangerous keys recursively.
  const state = JSON.parse(JSON.stringify(input), (key, value) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('Недопустимое поле резервной копии');
    return value;
  });
  object(state);
  if (state.version !== 1 || !Array.isArray(state.habits) || state.habits.length > 1000) throw Error('Некорректная резервная копия');
  const ids = new Set();
  for (const habit of state.habits) {
    object(habit);
    if (typeof habit.id !== 'string' || !habit.id || habit.id.length > 200 || ids.has(habit.id)) throw Error('Некорректный идентификатор');
    ids.add(habit.id);
    titleOf(habit.title);
    reminderOf(habit.reminder);
    if (!['regular', 'quit'].includes(habit.kind)) throw Error('Некорректный тип привычки');
    iso(habit.createdAt);
    dayDate(habit.createdDay);
    if ((habit.archivedAt === null) !== (habit.archivedDay === null)) throw Error('Некорректный архив');
    if (habit.archivedAt !== null) {
      iso(habit.archivedAt);
      dayDate(habit.archivedDay);
      if (new Date(habit.archivedAt) < new Date(habit.createdAt) || habit.archivedDay < habit.createdDay) throw Error('Архив предшествует созданию');
    }
    ordered(habit.schedules, habit.createdDay);
    if (habit.schedules[0].from !== habit.createdDay) throw Error('Отсутствует начальное расписание');
    for (const schedule of habit.schedules) parseDays(schedule.days);
    object(habit.done);
    for (const [key, value] of Object.entries(habit.done)) {
      dayDate(key);
      if (value !== true || key < habit.createdDay) throw Error('Некорректная отметка');
    }
    if (habit.kind === 'regular') {
      if (habit.quit !== null) throw Error('Лишний дневник');
      continue;
    }
    const quit = habit.quit;
    object(quit);
    iso(quit.startAt);
    dayDate(quit.startDay);
    if (new Date(quit.startAt) > new Date(habit.createdAt) || quit.startDay > habit.createdDay) throw Error('Некорректное начало учета');
    ordered(quit.versions, quit.startDay);
    if (quit.versions[0].from !== quit.startDay) throw Error('Отсутствуют начальные данные');
    let currency = null;
    for (const version of quit.versions) {
      object(version.inputs);
      for (const key of ['average', ...FIELDS]) {
        if (version.inputs[key] !== null && typeof version.inputs[key] !== 'number') throw Error('Некорректный тип показателя');
      }
      version.inputs = parseInputs(version.inputs);
      if (version.inputs.price !== null) {
        currency ||= version.inputs.currency;
        if (currency !== version.inputs.currency) throw Error('В истории смешаны валюты');
      }
      if (currency && version.inputs.currency !== currency) throw Error('В истории смешаны валюты');
    }
    object(quit.logs);
    if (Object.keys(quit.logs).length > 40000) throw Error('Слишком много записей');
    for (const [key, log] of Object.entries(quit.logs)) {
      dayDate(key);
      object(log);
      if (key < quit.startDay || (habit.archivedDay && key > habit.archivedDay)) throw Error('Запись вне периода учета');
      if (!Number.isSafeInteger(log.count) || log.count < 0 || log.count > MAX) throw Error('Некорректное количество');
      const start = +new Date(iso(log.dayStart));
      const end = +new Date(iso(log.dayEnd));
      if (end <= start || end - start < 20 * 3600000 || end - start > 28 * 3600000) throw Error('Некорректные границы суток');
      if (log.count === 0) {
        if (log.lastAt !== null) throw Error('Для нуля время сигареты не указывается');
      } else {
        const last = +new Date(iso(log.lastAt));
        if (last < start || last >= end || last < +new Date(quit.startAt) || (habit.archivedAt && last > +new Date(habit.archivedAt))) throw Error('Время сигареты вне периода учета');
      }
    }
  }
  return state;
}
