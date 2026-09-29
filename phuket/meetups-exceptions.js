/* Отмены и разовые встречи — одни на все языковые версии страницы Пхукета.

   MEETUPS_EXCEPTIONS:
     "2026-11-14"           — в этот день не проводится ничего;
     "2026-11-19 workshop"  — отменена одна встреча (id правила из RULES в meetups.js).

   MEETUPS_EXTRA — разовая встреча:
     { date: "2026-11-21", time: "10:00", format: "talk", hours: 1.5,
       topic: { en: "Topic", ru: "Тема", vi: "…", pt: "…", es: "…" } }
   format — один из game, breakfast, workshop, talk, mixer.
   Тему можно написать одной строкой — тогда она будет одинаковой на всех языках.
   Время — пхукетское. Прошедшие даты можно не убирать. */
window.MEETUPS_EXCEPTIONS = [
];
window.MEETUPS_EXTRA = [
];
