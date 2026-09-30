/* Счётчик визитов без внешних сервисов. Один файл на весь сайт.

   На каждой загрузке страницы отправляет в наш же приёмник заявок
   (Google Apps Script, тот же адрес, что у формы):
     — адрес страницы без параметров;
     — метки utm_source, utm_medium, utm_campaign;
     — домен, с которого пришёл человек (только домен, без пути);
     — признак «первый визит за день» — для подсчёта уникальных.
   IP, cookie и идентификатора посетителя нет. Чтобы не считать человека
   дважды за день, браузер помнит только дату последнего визита.

   Метки и источник первой страницы запоминаются до закрытия вкладки:
   если человек пришёл из Instagram и открыл ещё две страницы, все три
   засчитаются Instagram, а не «прямым заходам». */

(function () {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbxE0kMC6oIlYu7r6wyIFLdjhnkD862wcumVuhh9k7uDW4CD8QnOKINW2HWd_IWopeQE/exec';

  // только боевой сайт: локальные проверки и копии в статистику не попадают
  if (!/(^|\.)marketgame\.club$/.test(location.hostname)) return;
  // роботы, предпросмотры ссылок и автотесты
  if (navigator.webdriver || /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom/i.test(navigator.userAgent)) return;
  // английская страница прямо сейчас перебрасывает на версию на языке браузера —
  // визит засчитается там
  if (window.__mgRedirect) return;

  function get(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function set(store, key, v) { try { window[store].setItem(key, v); } catch (e) { /* приватный режим */ } }

  // день по Бангкоку — как в сводке
  var today;
  try {
    today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch (e) {
    today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  }
  var first = get('localStorage', 'mg-day') !== today;
  if (first) set('localStorage', 'mg-day', today);

  // источник: реферер сохраняет lang.js, если перебрасывал на другой язык
  var referrer = get('sessionStorage', 'mg-ref');
  if (referrer === null) referrer = document.referrer;
  else try { sessionStorage.removeItem('mg-ref'); } catch (e) { /* не страшно */ }
  var host = '';
  try { host = referrer ? new URL(referrer).hostname.replace(/^www\./, '') : ''; } catch (e) { /* не адрес */ }
  var own = location.hostname.replace(/^www\./, '');
  if (host === own) host = '';

  var q = {};
  location.search.replace(/^\?/, '').split('&').forEach(function (p) {
    var kv = p.split('=');
    if (/^utm_(source|medium|campaign)$/.test(kv[0])) {
      try { q[kv[0]] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')); } catch (e) { q[kv[0]] = ''; }
    }
  });

  var visit = { utm_source: q.utm_source || '', utm_medium: q.utm_medium || '', utm_campaign: q.utm_campaign || '', ref: host };
  if (visit.utm_source || visit.ref) {
    set('sessionStorage', 'mg-src', JSON.stringify(visit));       // новый источник — запоминаем
  } else {
    try { visit = JSON.parse(get('sessionStorage', 'mg-src')) || visit; } catch (e) { /* нет — прямой заход */ }
  }

  var body = JSON.stringify({
    kind: 'visit',
    path: location.pathname,
    utm_source: visit.utm_source, utm_medium: visit.utm_medium, utm_campaign: visit.utm_campaign,
    ref: visit.ref,
    first: first ? 1 : 0
  });

  try {
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
  } catch (e) { /* ниже — запасной способ */ }
  try {
    fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: body });
  } catch (e) { /* статистика не важнее страницы */ }
})();
