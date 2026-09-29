"""Страница Phuket Business League на пяти языках.

Тексты — в i18n/phuket_{en,ru,vi,pt,es}.py, шаблон — здесь.
Запуск из корня репозитория:  python3 _tools/build_phuket.py
Пишет phuket/index.html (английская) и phuket/{ru,vi,pt,es}/index.html.
"""
import json, html, importlib, os, sys
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'i18n'))
ROOT = os.path.join(os.path.dirname(HERE), 'phuket')

WA = '66823204796'
TG = 'https://t.me/Nickbv'
LINE_ID = '62803839'
LINE = 'https://line.me/ti/p/~' + LINE_ID
ENDPOINT = 'https://script.google.com/macros/s/AKfycbxE0kMC6oIlYu7r6wyIFLdjhnkD862wcumVuhh9k7uDW4CD8QnOKINW2HWd_IWopeQE/exec'
SITE = 'https://marketgame.club'

LANGS = ['en', 'ru', 'vi', 'pt', 'es']
NAMES = {'en': 'English', 'ru': 'Русский', 'vi': 'Tiếng Việt', 'pt': 'Português', 'es': 'Español'}
OG_LOCALE = {'en': 'en_US', 'ru': 'ru_RU', 'vi': 'vi_VN', 'pt': 'pt_BR', 'es': 'es_LA'}
FORMAT_KEYS = ['game', 'breakfast', 'workshop', 'talk', 'mixer']

T = {c: importlib.import_module('phuket_' + c).L for c in LANGS}


def url_of(c):
    return SITE + '/phuket/' + ('' if c == 'en' else c + '/')


def picker(code):
    here = '' if code == 'en' else '../'
    items = []
    for c in LANGS:
        href = (here + ('' if c == 'en' else c + '/')) or './'
        cur = ' aria-current="page"' if c == code else ''
        items.append(f'<li><a href="{href}" hreflang="{c}" lang="{c}" data-pick="{c}"{cur}>'
                     f'{NAMES[c]} <small>{c.upper()}</small></a></li>')
    return ('<details class="langpick">\n'
            f'        <summary aria-label="{html.escape(NAMES[code])}">{code.upper()}</summary>\n'
            '        <ul>' + ''.join(items) + '</ul>\n'
            '      </details>')

def e(s):  # текст в атрибут
    return html.escape(s, quote=True)

def build(code):
    L = T[code]
    here = '' if code == 'en' else '../'   # путь к /phuket/ от страницы
    up = here + '../'                          # путь к корню сайта
    main = up + ('' if code == 'en' else code + '/')   # главная на том же языке
    privacy_url = main + 'privacy.html'
    url = url_of(code)
    wa = f'https://wa.me/{WA}?text=' + quote(L['wa_text'])
    a = lambda href, text: f'<a href="{href}" target="_blank" rel="noopener">{text}</a>'
    hero_note = L['hero_note'].format(wa=a(wa, 'WhatsApp'), tg=a(TG, 'Telegram'), line=a(LINE, 'LINE'))

    mission = ''.join(f'<article><h3>{t}</h3><p>{p}</p></article>' for t, p in L['mission'])
    principles = ''.join(f'<li><h3>{t}</h3><p>{p}</p></li>' for t, p in L['principles'])
    fmts = ''
    for k in FORMAT_KEYS:
        ln, name, body, price = L['formats'][k]
        fmts += (f'<article class="fmt fmt--{k}"><div class="fmt__top"><span class="fmt__len">{ln}</span>'
                 f'<h3>{name}</h3></div><div class="fmt__body"><p>{body}</p>'
                 + (f'<p class="fmt__price">{price}</p>' if price else '') + '</div></article>\n      ')
    o = L['own']
    fmts += (f'<article class="fmt fmt--own"><div class="fmt__top"><span class="fmt__len">{o[0]}</span>'
             f'<h3>{o[1]}</h3></div><div class="fmt__body"><p>{o[2]}</p>'
             f'<button type="button" class="btn btn--line" data-lead="pk_talk">{o[3]}</button></div></article>')
    rules = ''.join(f'<li><b>{t}</b>{p}</li>' for t, p in L['rules'])
    who = ''.join(f'<div><h3>{t}</h3><p>{p}</p></div>' for t, p in L['who'])
    game_p = ''.join(f'<p>{p}</p>' for p in L['game_p'])
    facts = ''.join(f'<li><span>{t}</span><b>{v}</b></li>' for t, v in L['facts'])
    partners = ''.join(f'<div class="partner"><h3>{t}</h3><p>{p}</p>'
                       f'<button type="button" class="btn btn--line" data-lead="pk_partner">{b}</button></div>'
                       for t, p, b in L['partners'])
    faq = ''.join(f'<details><summary>{q}</summary><p class="faq__a">{ans}</p></details>\n      ' for q, ans in L['faq'])
    contacts = (f'<a class="btn" href="{wa}" target="_blank" rel="noopener">WhatsApp <small>+66 82 320 4796</small></a>'
                f'<a class="btn btn--line" href="{TG}" target="_blank" rel="noopener">Telegram <small>@Nickbv</small></a>'
                f'<a class="btn btn--line" href="{LINE}" target="_blank" rel="noopener">LINE <small>ID {LINE_ID}</small></a>')

    ld = {
      '@context': 'https://schema.org',
      '@graph': [
        {'@type': 'Organization', '@id': SITE + '/phuket/#org', 'name': 'Phuket Business League',
         'url': url, 'description': L['desc'], 'areaServed': {'@type': 'Place', 'name': 'Phuket, Thailand'},
         'contactPoint': {'@type': 'ContactPoint', 'contactType': 'customer support',
                          'telephone': '+66823204796', 'availableLanguage': ['English', 'Russian', 'Vietnamese', 'Portuguese', 'Spanish']},
         'sameAs': [TG]},
        {'@type': 'FAQPage', 'mainEntity': [
          {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': ans}} for q, ans in L['faq']]}
      ]}

    form_cfg = {
      'endpoint': ENDPOINT, 'lang': code, 'privacyUrl': privacy_url,
      'fallback': {'url': f'https://wa.me/{WA}', 'label': 'WhatsApp +66 82 320 4796'},
      'leaguePrefix': 'PHUKET · ',
      'leagues': L['form']['leagues'],
      'managerLeagues': T['ru']['form']['leagues'],
      'messengers': {'whatsapp': 'WhatsApp', 'telegram': 'Telegram', 'line': 'LINE'},
      'text': L['form']['text']}
    M = L['meet']
    meet_cfg = {
      'lang': code, 'locale': M['locale'],
      'hosts': [{'id': 'meetups', 'limit': 8}, {'id': 'nextMeets', 'limit': 3, 'compact': True}],
      'formats': {k: {'name': v[0], 'title': v[1], 'blurb': v[2]} for k, v in M['formats'].items()},
      'topics': M['topics'], 'text': M['text'],
      'leagues': M['leagues'],
      'manager': {'locale': 'ru-RU',
                  'formats': {k: v[0] for k, v in T['ru']['meet']['formats'].items()},
                  'leagues': {'l12': 'Лига 12', 'l24': 'Лига 24'},
                  'topics': T['ru']['meet']['topics']},
      'seo': {'name': 'Phuket Business League', 'url': url, 'place': M['place'],
              'currency': 'THB', 'prices': {'l12': 1000, 'l24': 3500}}}
    J = lambda o: json.dumps(o, ensure_ascii=False, indent=2)

    alt = '\n'.join([f'<link rel="alternate" hreflang="{c}" href="{url_of(c)}">' for c in LANGS]
                     + [f'<link rel="alternate" hreflang="x-default" href="{url_of("en")}">'])
    others = ' '.join(c for c in LANGS if c != 'en')
    root = f' data-root data-langs="{others}"' if code == 'en' else ''

    return f'''<!DOCTYPE html>
<html lang="{code}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(L["title"])}</title>
<meta name="description" content="{e(L["desc"])}">
<meta name="theme-color" content="#FBF6EE">
<link rel="icon" href="{up}favicon.svg" type="image/svg+xml">
<link rel="canonical" href="{url}">

{alt}
<meta property="og:type" content="website">
<meta property="og:locale" content="{OG_LOCALE[code]}">
<meta property="og:title" content="{e(L["og_title"])}">
<meta property="og:description" content="{e(L["og_desc"])}">
<meta property="og:image" content="{SITE}/phuket/og.jpg">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image">

<link rel="stylesheet" href="{up}styles.css">
<link rel="stylesheet" href="{here}phuket.css">
<script src="{up}lang.js"{root}></script>

<script type="application/ld+json">
{J(ld)}
</script>
</head>
<body>

<header class="wrap">
  <div class="bar">
    <div class="logo">Phuket<br><em>Business League</em></div>
    <div class="bar__right">
      {picker(code)}
      <a class="bar__tg" href="#calendar" data-lead="pk_join">{L["join"]}</a>
    </div>
  </div>
</header>

<!-- ПЕРВЫЙ ЭКРАН -->
<section class="wrap hero">
  <div class="hero__in">
    <div>
      <span class="eyebrow">{L["eyebrow"]}</span>
      <h1>{L["h1"]}</h1>
      <p class="lede">{L["lede"]}</p>
      <div class="btns">
        <a class="btn" href="#calendar">{L["btn_meet"]}</a>
        <button type="button" class="btn btn--line" data-lead="pk_join">{L["btn_join"]}</button>
      </div>
      <p class="hero__cta-note">{hero_note}</p>
    </div>
    <aside class="board" aria-label="{e(L["board_t"])}">
      <img class="board__street" src="{here}shophouses.svg" width="600" height="150" alt="">
      <div class="board__in">
        <span class="board__t">{L["board_t"]}</span>
        <div id="nextMeets"><p class="mute">{L["board_empty"]}</p></div>
        <p class="board__foot">{L["board_foot"]}</p>
      </div>
    </aside>
  </div>
</section>

<!-- ЗАЧЕМ -->
<section class="sect sect--tint">
  <div class="wrap">
    <span class="eyebrow">{L["mis_eyebrow"]}</span>
    <h2>{L["mis_h2"]}</h2>
    <p class="lede">{L["mis_lede"]}</p>
    <div class="mission">{mission}</div>
  </div>
</section>

<!-- МОДЕЛЬ ТОРГОВЫХ ПАЛАТ -->
<section class="sect sect--dark">
  <div class="wrap">
    <span class="eyebrow">{L["mod_eyebrow"]}</span>
    <h2>{L["mod_h2"]}</h2>
    <p class="lede" style="max-width:68ch">{L["mod_lede"]}</p>
    <ol class="principles">{principles}</ol>
  </div>
</section>

<!-- ФОРМАТЫ -->
<section class="sect">
  <div class="wrap">
    <span class="eyebrow">{L["fmt_eyebrow"]}</span>
    <h2>{L["fmt_h2"]}</h2>
    <div class="fmts">
      {fmts}
    </div>
  </div>
</section>

<!-- РАСПИСАНИЕ -->
<section class="sect sect--dark" id="calendar">
  <div class="wrap">
    <span class="eyebrow">{L["cal_eyebrow"]}</span>
    <h2>{L["cal_h2"]}</h2>
    <p class="lede">{L["cal_lede"]}</p>
    <div class="schedule" id="meetups">
      <p class="mute">{L["cal_noscript"]}</p>
    </div>
    <ul class="rules">{rules}</ul>
    <div class="waitlist">
      <p>{L["wait_text"]}</p>
      <button type="button" class="btn btn--line" data-lead="pk_join">{L["wait_btn"]}</button>
    </div>
  </div>
</section>

<!-- ДЛЯ КОГО -->
<section class="sect sect--tint">
  <div class="wrap">
    <span class="eyebrow">{L["who_eyebrow"]}</span>
    <h2>{L["who_h2"]}</h2>
    <div class="who">{who}</div>
  </div>
</section>

<!-- ИГРА -->
<section class="sect">
  <div class="wrap">
    <span class="eyebrow">{L["game_eyebrow"]}</span>
    <h2>{L["game_h2"]}</h2>
    <div class="duo">
      <div class="prose">
        {game_p}
        <ul class="facts">{facts}</ul>
        <p style="margin-top:18px"><a href="{main}"><b>{L["game_more"]}</b></a></p>
      </div>
      <div class="private">
        <h3>{L["priv_h3"]}</h3>
        <p>{L["priv_p"]}</p>
        <button type="button" class="btn" data-lead="pk_team">{L["priv_btn"]}</button>
      </div>
    </div>
  </div>
</section>

<!-- ПАРТНЁРЫ -->
<section class="sect sect--tint">
  <div class="wrap">
    <span class="eyebrow">{L["par_eyebrow"]}</span>
    <h2>{L["par_h2"]}</h2>
    <p class="lede">{L["par_lede"]}</p>
    <div class="partners">{partners}</div>
  </div>
</section>

<!-- КОНТАКТЫ -->
<section class="sect">
  <div class="wrap">
    <span class="eyebrow">{L["org_eyebrow"]}</span>
    <h2>{L["org_h2"]}</h2>
    <p class="lede">{L["org_lede"]}</p>
    <div class="contacts">{contacts}</div>
  </div>
</section>

<!-- ВОПРОСЫ -->
<section class="sect sect--tint">
  <div class="wrap">
    <span class="eyebrow">{L["faq_eyebrow"]}</span>
    <h2>{L["faq_h2"]}</h2>
    <div class="faq">
      {faq}
    </div>
  </div>
</section>

<!-- СЛЕДУЮЩИЙ ШАГ -->
<section class="sect sect--dark final">
  <div class="wrap">
    <span class="eyebrow">{L["fin_eyebrow"]}</span>
    <h2>{L["fin_h2"]}</h2>
    <p class="lede">{L["fin_lede"]}</p>
    <div class="btns" style="margin-top:30px">
      <a class="btn" href="#calendar">{L["btn_meet"]}</a>
      <button type="button" class="btn btn--line" data-lead="pk_talk">{L["fin_talk"]}</button>
    </div>
  </div>
</section>

<div class="street" aria-hidden="true"></div>

<footer class="wrap">
  <div class="foot">
    <span>{L["foot_about"]}</span>
    <span>{L["foot_contact"]}: {a(wa, "WhatsApp")} · {a(TG, "Telegram")} · {a(LINE, "LINE")}</span>
    <span><a href="{main}">{L["foot_game"]}: marketgame.club</a> · <a href="{privacy_url}">{L["foot_privacy"]}</a></span>
  </div>
</footer>

<script>
window.MEETUPS_CONFIG = {J(meet_cfg)};
</script>
<!-- отмены и разовые встречи — в meetups-exceptions.js, одни на все языки -->
<script src="{here}meetups-exceptions.js"></script>
<script src="{here}meetups.js"></script>
<script>
window.FORM_CONFIG = {J(form_cfg)};
</script>
<script src="{up}form.js"></script>
</body>
</html>
'''


for code in LANGS:
    L = T[code]
    assert set(L) == set(T['en']), (code, set(L) ^ set(T['en']))
    for f in ('workshop', 'talk'):
        assert len(L['meet']['topics'][f]) == len(T['en']['meet']['topics'][f]), (code, f)
    # подпись для таблицы: Apps Script режет «Лигу» до 40 знаков
    for v in L['form']['leagues'].values():
        assert len('PHUKET · ' + v) <= 40, (code, v)
    path = os.path.join(ROOT, '' if code == 'en' else code, 'index.html')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(build(code))
    print(os.path.relpath(path, os.path.dirname(ROOT)))
