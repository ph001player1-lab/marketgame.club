/* Выбор языка. Один файл на весь сайт.

   1. На английских «корневых» страницах (главная, /phuket/) скрипт подключён
      в <head> с атрибутом data-root. При первом заходе он смотрит язык
      браузера: если это один из языков сайта — открывает эту версию,
      иначе остаётся на английской.
   2. Когда человек выбирает язык в меню, выбор запоминается. Дальше главная
      его уже не перебрасывает, даже если язык браузера другой.

   Поисковые роботы приходят без сохранённого выбора и с английским языком,
   поэтому английская версия индексируется как обычно, а остальные — по своим
   адресам (они перечислены в теге hreflang).

   Хранилище браузера может быть недоступно (приватный режим) — тогда просто
   работает определение по языку браузера. */

(function () {
  'use strict';

  var KEY = 'mg-lang';
  var script = document.currentScript;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(code) {
    try { localStorage.setItem(KEY, code); } catch (e) { /* не страшно */ }
  }

  // --- 1. перенаправление с английской страницы ------------------------------
  if (script && script.hasAttribute('data-root')) {
    var langs = (script.getAttribute('data-langs') || '').split(/\s+/).filter(Boolean);
    var target = null;
    var pick = saved();

    if (pick) {
      if (langs.indexOf(pick) !== -1) target = pick;       // выбрал другой язык раньше
    } else {
      var list = navigator.languages && navigator.languages.length
        ? navigator.languages : [navigator.language || ''];
      for (var i = 0; i < list.length; i++) {
        var code = String(list[i] || '').slice(0, 2).toLowerCase();
        if (code === 'en') break;                           // английский выше в списке — остаёмся
        if (langs.indexOf(code) !== -1) { target = code; break; }
      }
    }
    if (target) {
      // для счётчика визитов (visit.js): эту страницу не считать, а откуда
      // человек пришёл — передать странице, на которую перебрасываем
      window.__mgRedirect = true;
      try { sessionStorage.setItem('mg-ref', document.referrer); } catch (e) { /* не страшно */ }
      location.replace(target + '/' + location.search + location.hash);
      return;
    }
  }

  // --- 2. меню выбора языка ---------------------------------------------------
  function init() {
    var menus = document.querySelectorAll('.langpick');
    if (!menus.length) return;

    document.addEventListener('click', function (event) {
      var link = event.target.closest('[data-pick]');
      if (link) save(link.getAttribute('data-pick'));
      // клик мимо открытого меню его закрывает
      Array.prototype.forEach.call(menus, function (m) {
        if (m.open && !m.contains(event.target)) m.open = false;
      });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      Array.prototype.forEach.call(menus, function (m) {
        if (m.open) { m.open = false; m.querySelector('summary').focus(); }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
