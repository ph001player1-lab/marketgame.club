/**
 * «Бизнес Квест» — приём заявок с сайта и счётчик визитов.
 *
 * Что делает:
 *   — принимает заявку с сайта, дописывает строку в Google-таблицу
 *     и присылает уведомление в закрытую группу Telegram;
 *   — считает визиты (лист «Визиты»: дата, страница, метки, домен
 *     источника; без IP и личных данных);
 *   — отдаёт сводку по дням для marketgame.club/stats.json (адрес /exec?stats);
 *   — каждый день в 21:00 по Бангкоку присылает владельцу сводку в Telegram.
 *     Включается один раз: функция setupReports (см. README, «Статистика»).
 *
 * Как поставить — подробная инструкция в README репозитория, раздел
 * «Приём заявок». Коротко:
 *   1. Расширения → Apps Script в вашей Google-таблице.
 *   2. Вставить этот файл целиком вместо содержимого Code.gs.
 *   3. Настройки проекта → Свойства скрипта, добавить два свойства:
 *        BOT_TOKEN  — токен бота от @BotFather
 *        CHAT_ID    — id закрытой группы, куда писать (с минусом, напр. -1001234567890)
 *   4. Развернуть → Новое развёртывание → Веб-приложение,
 *      «Запуск от имени: я», «Доступ: все».
 *   5. Скопировать адрес вида .../exec и прислать его мне.
 *
 * ЕСЛИ ЧТО-ТО НЕ РАБОТАЕТ: выберите наверху функцию checkSetup и нажмите
 * «Выполнить». Она проверит ключи, токен, доступ к группе и таблицу,
 * и прямо напишет, что именно сломалось.
 *
 * ВАЖНО: токен живёт в свойствах скрипта и на сайт не попадает.
 * Никогда не вписывайте его прямо в этот файл — он лежит в публичном репозитории.
 */

var SHEET_LEADS = 'Лиды';

// Порядок важен только для нового листа. В существующем строка пишется
// по названиям колонок, а недостающие колонки дописываются справа —
// поэтому новые поля добавляйте в КОНЕЦ списка, и старые строки не поедут.
var HEADERS = [
  'Дата', 'Имя', 'Телефон', 'Telegram', 'Лига',
  'Язык', 'Страница', 'Источник', 'UTM', 'IP-метка',
  'Игра', 'Мессенджер', 'Тип'
];

// Визиты: одна строка на загрузку страницы. Ни IP, ни идентификатора
// посетителя здесь нет — только то, что ниже.
var SHEET_VISITS = 'Визиты';
var VISIT_HEADERS = [
  'Время', 'Страница', 'Источник', 'utm_source', 'utm_medium', 'utm_campaign',
  'Реферер', 'Первый за день'
];

// Итоги по дням: сырые визиты хранятся KEEP_DAYS дней, а итоги — всегда.
var SHEET_DAILY = 'Статистика по дням';
var DAILY_HEADERS = ['День', 'Визиты', 'Уникальные', 'Источники', 'Watch', 'Play'];
var KEEP_DAYS = 40;

var TZ = 'Asia/Bangkok';
var TZ_OFFSET_HOURS = 7;        // в Таиланде нет перехода на летнее время
var REPORT_HOUR = 21;           // ежедневная сводка — в 21:00 по Бангкоку
var OWNER_USERNAME = 'NickBV';  // кому слать сводку (ник в Telegram, без @)
var DASHBOARD_URL = 'https://claude.ai/artifact/GeRrcEDv3RWg6h4xX24USh';

// Ключи мессенджеров, которые присылает форма. Ключ, а не подпись: подпись
// зависит от языка страницы, а в таблице нужно одно значение на всех.
var MESSENGERS = { whatsapp: 'WhatsApp', telegram: 'Telegram', line: 'LINE' };

/** Форма шлёт POST. Apps Script отдаёт ответ с CORS-заголовком по умолчанию. */
function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Визит, а не заявка: его шлёт visit.js при каждой загрузке страницы
    if (data.kind === 'visit') return recordVisit(data);

    // Ловушка от ботов: поле скрыто в вёрстке, человек его не заполнит.
    if (data.company) return ok({ status: 'ok' });

    // Слишком быстрая отправка — почти наверняка робот.
    if (typeof data.elapsed === 'number' && data.elapsed < 2000) {
      return ok({ status: 'ok' });
    }

    var name = clean(data.name, 100);
    var phone = clean(data.phone, 40);
    var telegram = clean(data.telegram, 80);

    if (!name || (!phone && !telegram)) {
      return ok({ status: 'error', message: 'not enough contact data' });
    }

    var messenger = MESSENGERS[data.messenger] || '';

    var row = {
      date: new Date(),
      name: name,
      phone: phone,
      // во второе поле пишут и Telegram, и LINE; @ нужна только первому
      telegram: messenger === 'LINE' ? telegram : normalizeTelegram(telegram),
      messenger: messenger,
      league: clean(data.league, 40),
      game: clean(data.game, 120),
      lang: clean(data.lang, 10),
      page: clean(data.page, 200),
      referrer: clean(data.referrer, 200),
      utm: clean(data.utm, 300)
    };
    // Тип заявки для статистики: Watch — посмотреть бесплатно, Play — всё остальное
    row.type = data.type === 'watch' ? 'Watch' : data.type === 'play' ? 'Play' : leadType(row.league);

    appendLead(row);
    notifyTelegram(row);

    return ok({ status: 'ok' });
  } catch (err) {
    // Пишем в журнал, но наружу подробности не отдаём.
    console.error(err);
    return ok({ status: 'error', message: 'internal' });
  }
}

/**
 * Проверка, что развёртывание живое: откройте адрес /exec в браузере.
 * Показывает, заданы ли ключи, но сами значения не раскрывает.
 */
function doGet(e) {
  // /exec?stats — сводка по дням за 30 дней; её забирает GitHub в stats.json
  if (e && e.parameter && e.parameter.stats !== undefined) {
    var cache = CacheService.getScriptCache();
    var hit = cache.get('stats30');
    if (hit) return raw(hit);
    var json = JSON.stringify(dailyStats(new Date(), 30));
    try { cache.put('stats30', json, 600); } catch (err) { /* большой ответ — просто не кэшируем */ }
    return raw(json);
  }
  var props = PropertiesService.getScriptProperties();
  return ok({
    status: 'ok',
    service: 'marketgame-leads',
    hasToken: !!props.getProperty('BOT_TOKEN'),
    hasChatId: !!props.getProperty('CHAT_ID'),
    hasOwnerChat: !!props.getProperty('OWNER_CHAT_ID')
  });
}

function appendLead(row) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet();
    var values = {
      'Дата': row.date, 'Имя': row.name, 'Телефон': row.phone,
      'Telegram': row.telegram, 'Лига': row.league, 'Язык': row.lang,
      'Страница': row.page, 'Источник': row.referrer, 'UTM': row.utm,
      'Игра': row.game || '', 'Мессенджер': row.messenger || '',
      'Тип': row.type || ''
    };
    // Раскладываем по заголовкам листа, а не по позиции: менеджер мог
    // переставить колонки, а лист мог остаться от прошлой версии кода.
    sheet.appendRow(headerRow(sheet).map(function (h) {
      return values.hasOwnProperty(h) ? values[h] : '';
    }));
  } finally {
    lock.releaseLock();
  }
}

function getSheet(name, headers) {
  name = name || SHEET_LEADS;
  headers = headers || HEADERS;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  // Лист мог остаться от прошлой версии кода, где колонок было меньше.
  // Недостающие колонки дописываем справа. Переписывать заголовок целиком
  // нельзя: старые строки остались бы под чужими названиями.
  var have = headerRow(sheet);
  var missing = headers.filter(function (h) { return have.indexOf(h) === -1; });
  if (missing.length) {
    sheet.getRange(1, have.length + 1, 1, missing.length)
      .setValues([missing]).setFontWeight('bold');
  }
  return sheet;
}

function headerRow(sheet) {
  var width = sheet.getLastColumn();
  if (!width) return [];
  return sheet.getRange(1, 1, 1, width).getValues()[0].map(String);
}

/**
 * Отправка в Telegram. Возвращает {ok, error} и НИКОГДА не бросает исключение:
 * заявка к этому моменту уже лежит в таблице, и терять её из-за Telegram нельзя.
 * Всё, что пошло не так, попадает в журнал выполнения.
 */
function sendToTelegram(text, toChat) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  var chatId = toChat || props.getProperty('CHAT_ID');

  if (!token) return { ok: false, error: 'В свойствах скрипта не задан BOT_TOKEN' };
  if (!chatId) return { ok: false, error: 'В свойствах скрипта не задан CHAT_ID' };

  try {
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
      muteHttpExceptions: true
    });

    var body = {};
    try { body = JSON.parse(res.getContentText()); } catch (e) {}

    if (body.ok) return { ok: true };

    var reason = body.description || ('HTTP ' + res.getResponseCode());
    console.error('Telegram отказал: ' + reason);
    return { ok: false, error: reason, hint: explainTelegramError(reason) };
  } catch (err) {
    console.error('Не удалось обратиться к Telegram: ' + err);
    return { ok: false, error: String(err) };
  }
}

/** Перевод ответов Telegram на человеческий язык. */
function explainTelegramError(reason) {
  var r = String(reason).toLowerCase();
  if (r.indexOf('chat not found') > -1) {
    return 'CHAT_ID неверный. У групп он отрицательный и обычно начинается с -100. ' +
           'Проверьте, что скопировали его целиком, вместе с минусом.';
  }
  if (r.indexOf('unauthorized') > -1 || r.indexOf('401') > -1) {
    return 'BOT_TOKEN неверный или бот удалён. Возьмите токен заново у @BotFather.';
  }
  if (r.indexOf('kicked') > -1 || r.indexOf('not a member') > -1) {
    return 'Бота нет в группе. Добавьте его обратно.';
  }
  if (r.indexOf('not enough rights') > -1 || r.indexOf('have no rights') > -1) {
    return 'Бот в группе, но ему запрещено писать. Сделайте его администратором.';
  }
  if (r.indexOf('bots can\'t send messages to bots') > -1) {
    return 'CHAT_ID указывает на бота, а не на группу.';
  }
  return 'Полный текст ошибки выше — он от Telegram.';
}

function notifyTelegram(row) {
  var lines = [
    '<b>Новая заявка</b>',
    '',
    'Имя: ' + esc(row.name),
    row.phone ? 'Телефон: ' + esc(row.phone) : '',
    row.telegram ? 'Telegram: ' + esc(row.telegram) : '',
    row.league ? 'Лига: ' + esc(row.league) : '',
    row.game ? 'Игра: ' + esc(row.game) : '',
    row.messenger ? 'Написать в: ' + esc(row.messenger) : '',
    'Язык страницы: ' + esc(row.lang || '—'),
    row.utm ? 'Метки: ' + esc(row.utm) : '',
    row.referrer ? 'Пришёл с: ' + esc(row.referrer) : ''
  ].filter(function (l) { return l !== ''; });

  return sendToTelegram(lines.join('\n'));
}

function clean(value, max) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeTelegram(value) {
  if (!value) return '';
  var v = value.replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').trim();
  return v ? '@' + v : '';
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function raw(json) {
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function ok(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ГЛАВНАЯ ФУНКЦИЯ ДЛЯ НАСТРОЙКИ.
 *
 * Выберите её в списке функций наверху редактора и нажмите «Выполнить».
 * Она проверит всё по шагам и прямо скажет, что не так. Результат виден
 * в панели выполнения внизу — читать журнал отдельно не нужно.
 */
function checkSetup() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  var chatId = props.getProperty('CHAT_ID');
  var out = [];

  function say(line) { out.push(line); console.log(line); }
  function stop(line) {
    say('✗ ' + line);
    throw new Error('\n\n' + out.join('\n') + '\n');
  }

  say('--- Проверка настройки ---');

  // 1. Ключи на месте?
  if (!token) {
    stop('Не задан BOT_TOKEN.\n' +
         '  Настройки проекта (шестерёнка слева) → Свойства скрипта →\n' +
         '  Добавить свойство. Имя ровно BOT_TOKEN, значение — токен от @BotFather.');
  }
  say('✓ BOT_TOKEN задан (' + token.length + ' символов)');

  if (!chatId) {
    stop('Не задан CHAT_ID.\n' +
         '  Там же добавьте свойство CHAT_ID со значением id группы.');
  }
  say('✓ CHAT_ID задан: ' + chatId);

  if (String(chatId).indexOf('-') !== 0) {
    say('⚠ CHAT_ID не начинается с минуса. У групп он отрицательный,\n' +
        '  обычно вида -1001234567890. Если это id личного чата — сообщения\n' +
        '  будут приходить вам лично, а не в группу.');
  }

  // 2. Токен рабочий?
  var me;
  try {
    var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getMe',
                              { muteHttpExceptions: true });
    me = JSON.parse(r.getContentText());
  } catch (err) {
    stop('Не удалось обратиться к Telegram: ' + err + '\n' +
         '  Если Google показал окно с запросом доступа — согласитесь и запустите снова.');
  }

  if (!me.ok) {
    stop('Telegram не принял токен: ' + (me.description || 'неизвестная ошибка') + '\n' +
         '  ' + explainTelegramError(me.description || ''));
  }
  say('✓ Токен рабочий, бот: @' + me.result.username);

  // 3. Сообщение доходит?
  var sent = sendToTelegram(
    '<b>Проверка настройки</b>\n\nЕсли вы это читаете — приём заявок настроен верно.');

  if (!sent.ok) {
    stop('Бот не смог написать в группу.\n' +
         '  Ответ Telegram: ' + sent.error + '\n' +
         '  ' + (sent.hint || ''));
  }
  say('✓ Сообщение отправлено — проверьте группу');

  // 4. Таблица на месте?
  try {
    var sheet = getSheet();
    say('✓ Лист «' + sheet.getName() + '» готов, строк с данными: ' +
        Math.max(0, sheet.getLastRow() - 1));
  } catch (err) {
    stop('Не удалось открыть таблицу: ' + err + '\n' +
         '  Скрипт должен быть привязан к таблице: откройте таблицу →\n' +
         '  Расширения → Apps Script, и вставьте код там.');
  }

  say('');
  say('ВСЁ ГОТОВО. Осталось развернуть: Развернуть → Управление развёртываниями →');
  say('карандаш → Версия: новая → Развернуть.');

  var report = out.join('\n');
  console.log(report);
  return report;
}

/**
 * Полный прогон: делает вид, что с сайта пришла заявка.
 * Пишет строку в таблицу и шлёт сообщение — ровно как в боевом режиме.
 * Строку потом удалите из таблицы вручную.
 */
function testLead() {
  var row = {
    date: new Date(),
    name: 'Тестовая заявка',
    phone: '+7 000 000-00-00',
    telegram: '@test',
    league: 'Лига 12 · Старт — $25',
    game: 'суббота, 3 января · Лига 12 · Русский',
    lang: 'ru',
    page: 'проверка из редактора',
    referrer: '',
    utm: ''
  };

  appendLead(row);
  var sent = notifyTelegram(row);

  if (!sent.ok) {
    throw new Error('\nСтрока в таблицу записана, но в Telegram не ушло.\n' +
                    'Ответ Telegram: ' + sent.error + '\n' +
                    (sent.hint || '') + '\n');
  }
  return 'Готово: строка в таблице и сообщение в группе.';
}


/* ============================================================
 * СЧЁТЧИК ВИЗИТОВ И СТАТИСТИКА
 * ============================================================ */

/** Одна загрузка страницы. Пишем только то, что перечислено в VISIT_HEADERS. */
function recordVisit(data) {
  var path = clean(data.path, 200);
  if (path.charAt(0) !== '/') return ok({ status: 'ok' });
  var utmSource = clean(data.utm_source, 60).toLowerCase();
  var ref = clean(data.ref, 80).toLowerCase().replace(/^www\./, '');
  if (!/^[a-z0-9.-]*$/.test(ref)) ref = '';           // только домен, без пути
  var values = {
    'Время': new Date(),
    'Страница': path,
    'Источник': sourceOf(utmSource, ref),
    'utm_source': utmSource,
    'utm_medium': clean(data.utm_medium, 60),
    'utm_campaign': clean(data.utm_campaign, 100),
    'Реферер': ref,
    'Первый за день': data.first ? 1 : 0
  };
  var sheet = getSheet(SHEET_VISITS, VISIT_HEADERS);
  sheet.appendRow(headerRow(sheet).map(function (h) {
    return values.hasOwnProperty(h) ? values[h] : '';
  }));
  return ok({ status: 'ok' });
}

/**
 * Источник визита для сводки: utm_source, если он есть (так размечаются
 * ссылки в постах — instagram, facebook, fb_group…), иначе — по домену,
 * с которого пришли, иначе direct.
 */
function sourceOf(utmSource, ref) {
  var u = String(utmSource || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 30);
  if (u) return u;
  var h = String(ref || '');
  if (!h) return 'direct';
  var known = [
    [/(^|\.)instagram\.com$/, 'instagram'],
    [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
    [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/, 'telegram'],
    [/(^|\.)(wa\.me|whatsapp\.com)$/, 'whatsapp'],
    [/(^|\.)line\.me$/, 'line'],
    [/(^|\.)google\.[a-z.]+$/, 'google'],
    [/(^|\.)bing\.com$/, 'bing'],
    [/(^|\.)yandex\.[a-z.]+$/, 'yandex'],
    [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
    [/(^|\.)(chatgpt\.com|openai\.com)$/, 'chatgpt'],
    [/(^|\.)perplexity\.ai$/, 'perplexity'],
    [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
    [/(^|\.)linkedin\.com$/, 'linkedin'],
    [/(^|\.)tiktok\.com$/, 'tiktok'],
    [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'x'],
    [/(^|\.)marketgame\.club$/, 'direct']
  ];
  for (var i = 0; i < known.length; i++) if (known[i][0].test(h)) return known[i][1];
  return h.slice(0, 30);
}

/** Тип заявки по подписи лиги — для старых строк, где колонки «Тип» ещё не было. */
function leadType(league) {
  return /Зритель|Посмотреть игру/i.test(String(league || '')) ? 'Watch' : 'Play';
}

/** Дата по Бангкоку: '2026-10-01'. */
function bkDay(d) {
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function asDate(v) {
  if (v instanceof Date) return v;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Все визиты из листа: [{at, source, first}]. */
function readVisits() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_VISITS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getDataRange().getValues();
  var h = rows[0].map(String);
  var iAt = h.indexOf('Время'), iSrc = h.indexOf('Источник'), iFirst = h.indexOf('Первый за день');
  var out = [];
  for (var r = 1; r < rows.length; r++) {
    var at = asDate(rows[r][iAt]);
    if (!at) continue;
    out.push({ at: at, source: String(rows[r][iSrc] || 'direct'), first: Number(rows[r][iFirst]) === 1 });
  }
  return out;
}

/** Все заявки: [{at, type}]. Тестовые заявки из редактора не считаем. */
function readLeads() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LEADS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getDataRange().getValues();
  var h = rows[0].map(String);
  var iAt = h.indexOf('Дата'), iType = h.indexOf('Тип'), iLeague = h.indexOf('Лига'), iName = h.indexOf('Имя');
  var out = [];
  for (var r = 1; r < rows.length; r++) {
    var at = asDate(rows[r][iAt]);
    if (!at || String(rows[r][iName]) === 'Тестовая заявка') continue;
    var t = iType > -1 ? String(rows[r][iType] || '') : '';
    out.push({ at: at, type: t === 'Watch' || t === 'Play' ? t : leadType(rows[r][iLeague]) });
  }
  return out;
}

function sortedCounts(obj) {
  var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a] || (a < b ? -1 : 1); });
  var out = {};
  keys.forEach(function (k) { out[k] = obj[k]; });
  return out;
}

/**
 * Сводка по дням (Бангкок) за последние n дней, включая сегодняшний неполный:
 * [{date, visits, unique, by_source, leads_watch, leads_play}], от старых к новым.
 */
function dailyStats(now, n, visits, leads) {
  visits = visits || readVisits();
  leads = leads || readLeads();
  var days = {}, order = [];
  for (var i = n - 1; i >= 0; i--) {
    var d = bkDay(new Date(now.getTime() - i * 86400000));
    if (days[d]) continue;
    days[d] = { date: d, visits: 0, unique: 0, by_source: {}, leads_watch: 0, leads_play: 0 };
    order.push(d);
  }
  visits.forEach(function (v) {
    var day = days[bkDay(v.at)];
    if (!day) return;
    day.visits++;
    if (v.first) day.unique++;
    day.by_source[v.source] = (day.by_source[v.source] || 0) + 1;
  });
  leads.forEach(function (l) {
    var day = days[bkDay(l.at)];
    if (!day) return;
    if (l.type === 'Watch') day.leads_watch++; else day.leads_play++;
  });
  return order.map(function (d) {
    days[d].by_source = sortedCounts(days[d].by_source);
    return days[d];
  });
}

/** Итоги за окно [from, to): визиты, уникальные, источники, заявки. */
function windowStats(from, to, visits, leads) {
  var s = { visits: 0, unique: 0, by_source: {}, watch: 0, play: 0 };
  visits.forEach(function (v) {
    var t = v.at.getTime();
    if (t < from || t >= to) return;
    s.visits++;
    if (v.first) s.unique++;
    s.by_source[v.source] = (s.by_source[v.source] || 0) + 1;
  });
  leads.forEach(function (l) {
    var t = l.at.getTime();
    if (t < from || t >= to) return;
    if (l.type === 'Watch') s.watch++; else s.play++;
  });
  s.by_source = sortedCounts(s.by_source);
  return s;
}

var MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
                 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** Текст ежедневной сводки. «За сутки» — 24 часа до момента отправки. */
function reportText(now) {
  var visits = readVisits(), leads = readLeads();
  var t = now.getTime();
  var day = windowStats(t - 86400000, t + 1, visits, leads);
  var week = windowStats(t - 7 * 86400000, t + 1, visits, leads);
  var bk = new Date(t + TZ_OFFSET_HOURS * 3600000);
  var title = bk.getUTCDate() + ' ' + MONTHS_RU[bk.getUTCMonth()];

  function sources(obj, limit) {
    var keys = Object.keys(obj);
    if (!keys.length) return ['—'];
    var lines = keys.slice(0, limit).map(function (k) { return esc(k) + ' — ' + obj[k]; });
    if (keys.length > limit) {
      var rest = keys.slice(limit).reduce(function (a, k) { return a + obj[k]; }, 0);
      lines.push('прочие — ' + rest);
    }
    return lines;
  }

  return [
    '<b>Market Game · сводка за ' + title + '</b>',
    '',
    '<b>Визиты</b>',
    'За сутки: ' + day.visits + ' (уникальных ' + day.unique + ')',
    'За 7 дней: ' + week.visits + ' (уникальных ' + week.unique + ')',
    '',
    '<b>Источники за сутки</b>'
  ].concat(sources(day.by_source, 8)).concat([
    '',
    '<b>Источники за 7 дней</b>'
  ]).concat(sources(week.by_source, 8)).concat([
    '',
    '<b>Заявки</b>',
    'За сутки: Watch ' + day.watch + ' · Play ' + day.play,
    'За 7 дней: Watch ' + week.watch + ' · Play ' + week.play,
    '',
    'Дашборд: ' + DASHBOARD_URL
  ]).join('\n');
}

/* ------------------------------------------------------------
 * Ежедневная сводка в 21:00 по Бангкоку
 *
 * Обычный «ежедневный» триггер Apps Script срабатывает когда-то в течение
 * часа, поэтому ставим разовый триггер ровно на 21:00, а после отправки —
 * следующий. Страховка — ежечасный hourlyTick: если сводка почему-то не
 * ушла или цепочка разовых триггеров оборвалась, он её восстановит.
 * ------------------------------------------------------------ */

/** Запустить ОДИН РАЗ из редактора: включает сводку и ежечасную страховку. */
function setupReports() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'hourlyTick' || f === 'dailyReport') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('hourlyTick').timeBased().everyHours(1).create();
  var at = scheduleNextReport();
  var owner = ownerChatId();
  var lines = [
    '✓ Ежечасная проверка включена',
    '✓ Следующая сводка: ' + Utilities.formatDate(at, TZ, 'yyyy-MM-dd HH:mm') + ' (Бангкок)',
    owner ? '✓ Личный чат @' + OWNER_USERNAME + ' найден: ' + owner
          : '✗ Личный чат @' + OWNER_USERNAME + ' не найден. Откройте бота в Telegram, нажмите «Start» ' +
            '(или напишите ему что угодно) и запустите setupReports ещё раз.'
  ];
  console.log(lines.join('\n'));
  return lines.join('\n');
}

/** Отправить сводку прямо сейчас — для проверки. */
function testReport() {
  var owner = ownerChatId();
  if (!owner) throw new Error('\nЛичный чат не найден: нажмите «Start» у бота и запустите снова.\n');
  var text = reportText(new Date());
  var res = sendToTelegram(text, owner);
  if (!res.ok) throw new Error('\nTelegram не принял сообщение: ' + res.error + '\n' + (res.hint || '') + '\n');
  return text;
}

/** Разовый триггер на 21:00: отправляет сводку и ставит следующий. */
function dailyReport() {
  try {
    sendDailyReport();
  } finally {
    scheduleNextReport();
  }
}

/** Ежечасно: страховка сводки, итоги дня в отдельный лист, чистка старых визитов. */
function hourlyTick() {
  var props = PropertiesService.getScriptProperties();
  var now = new Date();
  var bk = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600000);
  var minutes = bk.getUTCHours() * 60 + bk.getUTCMinutes();
  // сводка сегодня не ушла, а 21:00 уже прошло с запасом — отправляем сейчас
  if (minutes >= REPORT_HOUR * 60 + 15 && props.getProperty('LAST_REPORT_DAY') !== bkDay(now)) {
    sendDailyReport();
  }
  // цепочка разовых триггеров оборвалась — ставим заново
  var next = Number(props.getProperty('NEXT_REPORT_AT') || 0);
  if (!next || next < now.getTime() - 15 * 60000) scheduleNextReport();
  if (props.getProperty('LAST_ARCHIVE_DAY') !== bkDay(now)) {
    archiveDays(now);
    props.setProperty('LAST_ARCHIVE_DAY', bkDay(now));
  }
}

function sendDailyReport() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var now = new Date();
    if (props.getProperty('LAST_REPORT_DAY') === bkDay(now)) return;   // уже отправлена
    var owner = ownerChatId();
    if (!owner) {
      console.error('Сводка не отправлена: личный чат @' + OWNER_USERNAME + ' не найден — нажмите Start у бота.');
      return;
    }
    var res = sendToTelegram(reportText(now), owner);
    if (res.ok) props.setProperty('LAST_REPORT_DAY', bkDay(now));
  } finally {
    lock.releaseLock();
  }
}

/** Ближайшие 21:00 по Бангкоку (не раньше чем через минуту). */
function nextReportTime(now) {
  var bk = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600000);
  var t = Date.UTC(bk.getUTCFullYear(), bk.getUTCMonth(), bk.getUTCDate(), REPORT_HOUR - TZ_OFFSET_HOURS, 0, 0);
  if (t <= now.getTime() + 60000) t += 86400000;
  return new Date(t);
}

function scheduleNextReport() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyReport') ScriptApp.deleteTrigger(t);
  });
  var at = nextReportTime(new Date());
  ScriptApp.newTrigger('dailyReport').timeBased().at(at).create();
  PropertiesService.getScriptProperties().setProperty('NEXT_REPORT_AT', String(at.getTime()));
  return at;
}

/**
 * id личного чата владельца. Бот не может написать человеку первым, поэтому
 * владелец один раз нажимает у бота «Start» — после этого id находится
 * в getUpdates и запоминается в свойстве OWNER_CHAT_ID.
 */
function ownerChatId() {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('OWNER_CHAT_ID');
  if (saved) return saved;
  var token = props.getProperty('BOT_TOKEN');
  if (!token) return null;
  try {
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates',
                                { muteHttpExceptions: true });
    var body = JSON.parse(res.getContentText());
    if (!body.ok) { console.error('getUpdates: ' + body.description); return null; }
    var want = OWNER_USERNAME.toLowerCase();
    for (var i = body.result.length - 1; i >= 0; i--) {
      var u = body.result[i];
      var m = u.message || u.edited_message || u.my_chat_member;
      if (!m || !m.chat || m.chat.type !== 'private') continue;
      if (String((m.from && m.from.username) || m.chat.username || '').toLowerCase() !== want) continue;
      props.setProperty('OWNER_CHAT_ID', String(m.chat.id));
      return String(m.chat.id);
    }
  } catch (err) {
    console.error('Не удалось найти личный чат: ' + err);
  }
  return null;
}

/**
 * Итоги прошедших дней — в лист «Статистика по дням» (навсегда),
 * а сырые визиты старше KEEP_DAYS дней — удаляем, чтобы таблица не росла.
 */
function archiveDays(now) {
  var visits = readVisits(), leads = readLeads();
  var sheet = getSheet(SHEET_DAILY, DAILY_HEADERS);
  var have = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var v = r[0];
      have[v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v).replace(/^'/, '')] = true;
    });
  }
  var today = bkDay(now);
  dailyStats(now, KEEP_DAYS - 5, visits, leads).forEach(function (d) {
    if (d.date === today || have[d.date] || (!d.visits && !d.leads_watch && !d.leads_play)) return;
    // «'» — чтобы таблица не превратила дату в свой формат
    sheet.appendRow(["'" + d.date, d.visits, d.unique, JSON.stringify(d.by_source), d.leads_watch, d.leads_play]);
  });

  var vs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_VISITS);
  if (!vs || vs.getLastRow() < 2) return;
  var cutoff = now.getTime() - KEEP_DAYS * 86400000;
  var times = vs.getRange(2, 1, vs.getLastRow() - 1, 1).getValues();
  var old = 0;
  while (old < times.length) {
    var at = asDate(times[old][0]);
    if (!at || at.getTime() >= cutoff) break;
    old++;
  }
  if (old) vs.deleteRows(2, old);
}
