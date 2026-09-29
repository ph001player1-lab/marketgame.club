"""Сборка языковых версий главной страницы и политики конфиденциальности.

Исходник — английские index.html и privacy.html в корне. Их тексты правятся
прямо в HTML. Этот скрипт:

  1. дописывает в английские страницы то, что общее для всех языков:
     меню выбора языка, теги hreflang, разметку для поисковиков и настройки
     калькулятора, формы и календаря;
  2. собирает из них ru/, vi/, pt/, es/ — заменяя тексты по словарям
     из _tools/i18n/main_<язык>.py и privacy_<язык>.py.

После сборки проверяет, что в переводах не осталось английского текста.

Запуск из корня репозитория:  python3 _tools/build_main.py
"""
import html, importlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, '_tools', 'i18n'))
sys.path.insert(0, os.path.join(ROOT, '_tools'))

SITE = 'https://marketgame.club'
ENDPOINT = ('https://script.google.com/macros/s/AKfycbxE0kMC6oIlYu7r6wyIFLdjhnkD862wcumVuhh9k7uDW4'
            'CD8QnOKINW2HWd_IWopeQE/exec')
LANGS = ['en', 'ru', 'vi', 'pt', 'es']
NAMES = {'en': 'English', 'ru': 'Русский', 'vi': 'Tiếng Việt', 'pt': 'Português', 'es': 'Español'}
IMG = {'en': 'en', 'ru': 'ru', 'vi': 'vi', 'pt': 'en', 'es': 'en'}   # суффикс картинок с текстом

# Штаты по часовым поясам — одни для всех языков (названия штатов не переводим)
STATES = {
 'eastern': [('CT', 'Connecticut'), ('DC', 'District of Columbia'), ('DE', 'Delaware'), ('FL', 'Florida'),
             ('GA', 'Georgia'), ('IN', 'Indiana'), ('KY', 'Kentucky'), ('MA', 'Massachusetts'), ('MD', 'Maryland'),
             ('ME', 'Maine'), ('MI', 'Michigan'), ('NC', 'North Carolina'), ('NH', 'New Hampshire'),
             ('NJ', 'New Jersey'), ('NY', 'New York'), ('OH', 'Ohio'), ('PA', 'Pennsylvania'),
             ('RI', 'Rhode Island'), ('SC', 'South Carolina'), ('VA', 'Virginia'), ('VT', 'Vermont'),
             ('WV', 'West Virginia')],
 'central': [('AL', 'Alabama'), ('AR', 'Arkansas'), ('IA', 'Iowa'), ('IL', 'Illinois'), ('KS', 'Kansas'),
             ('LA', 'Louisiana'), ('MN', 'Minnesota'), ('MO', 'Missouri'), ('MS', 'Mississippi'),
             ('ND', 'North Dakota'), ('NE', 'Nebraska'), ('OK', 'Oklahoma'), ('SD', 'South Dakota'),
             ('TN', 'Tennessee'), ('TX', 'Texas'), ('WI', 'Wisconsin')],
 'mountain': [('AZ', 'Arizona'), ('CO', 'Colorado'), ('ID', 'Idaho'), ('MT', 'Montana'), ('NM', 'New Mexico'),
              ('UT', 'Utah'), ('WY', 'Wyoming')],
 'pacific': [('CA', 'California'), ('NV', 'Nevada'), ('OR', 'Oregon'), ('WA', 'Washington')],
}
GROUPS = {'intl': 'intl', 'eastern': 'et', 'ny': 'et', 'fl': 'et', 'central': 'ct', 'tx': 'ct', 'il': 'ct',
          'mountain': 'mt', 'co': 'mt', 'az': 'mt', 'pacific': 'pt', 'ca': 'pt', 'wa': 'pt'}
ZONE_STREAMS = ('eastern', 'central', 'mountain', 'pacific')
STATE_STREAMS = ('ny', 'fl', 'tx', 'il', 'co', 'az', 'ca', 'wa')
FAQ_IDS = [(126, 127), (128, 129), (130, 131), (132, 133), (134, 135), (136, 137), (138, 139), (140, 141), (142, 143)]
CLOCK_TZ = [('la', 'America/Los_Angeles'), ('den', 'America/Denver'), ('chi', 'America/Chicago'),
            ('nyc', 'America/New_York'), ('lon', 'Europe/London'), ('utc', 'UTC')]


def load(name):
    return importlib.import_module(name)


def js(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2)


# --- общие части страницы --------------------------------------------------------

def url_of(lang, page=''):
    return f'{SITE}/' + ('' if lang == 'en' else lang + '/') + page


def picker(lang, page=''):
    """Меню выбора языка. page — '' для главной, 'privacy.html' для политики."""
    up = '' if lang == 'en' else '../'
    items = []
    for c in LANGS:
        href = up + ('' if c == 'en' else c + '/') + page
        href = href or './'
        cur = ' aria-current="page"' if c == lang else ''
        items.append(f'<li><a href="{href}" hreflang="{c}" lang="{c}" data-pick="{c}"{cur}>'
                     f'{NAMES[c]} <small>{c.upper()}</small></a></li>')
    return ('<details class="langpick">\n'
            f'        <summary aria-label="{html.escape(NAMES[lang])}">{lang.upper()}</summary>\n'
            '        <ul>' + ''.join(items) + '</ul>\n'
            '      </details>')


def hreflang(page=''):
    out = [f'<link rel="alternate" hreflang="{c}" href="{url_of(c, page)}">' for c in LANGS]
    out.append(f'<link rel="alternate" hreflang="x-default" href="{url_of("en", page)}">')
    return '\n'.join(out)


def set_head(s, lang, page=''):
    """Язык, адреса, hreflang и подключение lang.js."""
    up = '' if lang == 'en' else '../'
    s = re.sub(r'<html lang="[a-z]+"', f'<html lang="{lang}"', s, count=1)
    s = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url_of(lang, page)}">', s, count=1)
    s = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url_of(lang, page)}">', s, count=1)
    # старые hreflang и lang.js убираем — вставляем заново
    s = re.sub(r'\n<link rel="alternate" hreflang="[^"]+" href="[^"]*">', '', s)
    s = re.sub(r'\n<script src="(\.\./)?lang\.js"[^>]*></script>', '', s)
    root = ' data-root data-langs="' + ' '.join(LANGS[1:]) + '"' if (lang == 'en' and page == '') else ''
    block = '\n' + hreflang(page) + f'\n<script src="{up}lang.js"{root}></script>'
    s = re.sub(r'(<link rel="canonical" href="[^"]*">)', lambda m: m.group(1) + block, s, count=1)
    return s


def set_picker(s, lang, page=''):
    s = re.sub(r'\n\s*<details class="langpick">.*?</details>', '', s, flags=re.S)
    return s.replace('<div class="bar__right">', '<div class="bar__right">\n      ' + picker(lang, page), 1)


def replace_block(s, start, new):
    """Заменяет «window.X = {...};» или «<script type=ld+json>…</script>» целиком."""
    if start.startswith('window.'):
        pat = re.escape(start) + r' = \{.*?\n\};'
        new_s, n = re.subn(pat, lambda m: f'{start} = {new};', s, count=1, flags=re.S)
    else:
        pat = r'<script type="application/ld\+json">.*?</script>'
        new_s, n = re.subn(pat, lambda m: '<script type="application/ld+json">\n' + new + '\n</script>', s,
                          count=1, flags=re.S)
    assert n == 1, f'не найден блок {start}'
    return new_s


# --- настройки календаря, формы, разметки ----------------------------------------

def schedule_cfg(lang, M, RU):
    return {
        'locale': M.INTL_LOCALE, 'hour12': lang == 'en', 'limit': 8,
        'clocks': [{'label': M.CITY[k], 'tz': tz} for k, tz in CLOCK_TZ],
        'seo': {'name': M.BRAND, 'organizer': M.BRAND, 'url': url_of(lang),
                'currency': M.CURRENCY, 'prices': M.PRICES},
        'leagues': M.LEAGUE_SHORT,
        'streams': M.STREAMS,
        'kinds': {s: (M.KIND['intl'] if s == 'intl' else M.KIND['zone'] if s in ZONE_STREAMS else M.KIND['state'])
                  for s in GROUPS},
        'states': {z: {'short': ', '.join(c for c, _ in v), 'full': ', '.join(n for _, n in v)}
                   for z, v in STATES.items()},
        'groups': GROUPS,
        'filters': [{'id': k, 'label': M.FILTERS[k]} for k in ('all', 'et', 'ct', 'mt', 'pt', 'intl')],
        'text': M.SCHED_TEXT,
        'manager': {'locale': 'ru-RU', 'leagues': RU.LEAGUE_SHORT, 'streams': RU.STREAMS},
    }


def form_cfg(lang, M, RU):
    labels = {'': M.FORM_LEAGUE_NONE}
    mgr = {'': RU.FORM_LEAGUE_NONE}
    for k in ('l12', 'l24', 'l36'):
        labels[k] = f'{M.LEAGUE_FULL[k]} — {M.PRICE_TXT[k]}'
        mgr[k] = f'{RU.LEAGUE_FULL[k]} — {M.PRICE_TXT[k]}'     # цена — та, что видел посетитель
    return {
        'endpoint': ENDPOINT, 'lang': lang, 'privacyUrl': 'privacy.html',
        'fallback': {'url': 'https://t.me/nickbv', 'label': '@nickbv'},
        'leagues': labels, 'managerLeagues': mgr, 'text': M.FORM_TEXT,
    }


def ld_json(lang, M, T_en, T):
    """Разметка Organization + Product + FAQPage на языке страницы."""
    faq = []
    for q, a in FAQ_IDS:
        faq.append({'@type': 'Question', 'name': plain(T[q]),
                    'acceptedAnswer': {'@type': 'Answer', 'text': plain(T[a])}})
    offers = []
    for k in ('l12', 'l24', 'l36'):
        offers.append({'@type': 'Offer', 'name': M.LEAGUE_FULL[k], 'description': M.LD['offer_' + k],
                       'price': str(M.PRICES[k]), 'priceCurrency': M.CURRENCY,
                       'availability': 'https://schema.org/InStock', 'url': url_of(lang) + '#leagues'})
    data = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'Organization', '@id': f'{SITE}/#org', 'name': 'Market Game', 'url': f'{SITE}/',
         'logo': f'{SITE}/og-en.jpg'},
        {'@type': 'Product', '@id': url_of(lang) + '#game', 'name': M.LD['name'], 'description': M.LD['desc'],
         'brand': {'@id': f'{SITE}/#org'}, 'image': f'{SITE}/og-{lang}.jpg', 'inLanguage': lang,
         'category': M.LD['category'], 'audience': {'@type': 'Audience', 'audienceType': M.LD['audience']},
         'offers': offers},
        {'@type': 'FAQPage', '@id': url_of(lang) + '#faq', 'inLanguage': lang, 'mainEntity': faq},
    ]}
    return json.dumps(data, ensure_ascii=False, indent=2)


def plain(fragment):
    return html.unescape(re.sub(r'<[^>]+>', '', fragment)).strip()


# --- перевод текстов ----------------------------------------------------------------

def translate(s, SEG, T, where):
    """Замена по словарю: только целые тексты элементов (между > и <) и атрибутов."""
    missing = [i for i in SEG if i not in T]
    assert not missing, f'{where}: нет перевода для {missing}'
    for i in sorted(SEG, key=lambda i: -len(SEG[i])):
        en, tr = SEG[i], T[i]
        n = s.count('>' + en + '<') + s.count('"' + en + '"')
        assert n, f'{where}: в английской странице не найден текст №{i}: {en[:60]!r}'
        s = s.replace('>' + en + '<', '>' + tr + '<')
        # в атрибутах (alt, content) — без разметки и с экранированными кавычками
        s = s.replace('"' + en + '"', '"' + html.escape(plain(tr), quote=True) + '"')
    return s


def fix_paths(s, lang):
    """Страница лежит на уровень глубже: пути к общим файлам — через ../"""
    def repl(m):
        attr, val = m.group(1), m.group(2)
        if re.match(r'(https?:|mailto:|tel:|#|\.\./|data:)', val) or val == 'privacy.html':
            return m.group(0)
        if val == 'phuket/':
            return f'{attr}="../phuket/{lang}/"'
        if val == './':
            return f'{attr}="./"'
        return f'{attr}="../{val}"'
    s = re.sub(r'\b(href|src)="([^"]*)"', repl, s)
    suf = IMG[lang]
    s = re.sub(r'(\.\./[a-z-]+)-en\.jpg', lambda m: f'{m.group(1)}-{suf}.jpg', s)
    s = s.replace('../og-en.jpg', f'../og-{lang}.jpg')
    s = s.replace(f'{SITE}/og-en.jpg"', f'{SITE}/og-{lang}.jpg"')
    return s


def leftovers(s, SEG):
    """Английские тексты, которые остались непереведёнными."""
    body = re.sub(r'<script\b.*?</script>', '', s, flags=re.S)
    en_texts = {plain(v) for v in SEG.values()}
    found = []
    for m in re.finditer(r'>([^<>]+)<', body):
        t = html.unescape(m.group(1)).strip()
        if t and t in en_texts and len(t) > 3:
            found.append(t)
    return found


# --- сборка --------------------------------------------------------------------------

def build_index():
    EN = load('main_en'); RU = load('main_ru')
    src_path = os.path.join(ROOT, 'index.html')
    en = open(src_path, encoding='utf-8').read()

    en = set_head(en, 'en'); en = set_picker(en, 'en')
    M_en = load('main_cfg_en')
    en = replace_block(en, 'ld+json', ld_json('en', M_en, EN.SEG, EN.SEG))
    en = replace_block(en, 'window.FORM_CONFIG', js(form_cfg('en', M_en, RU)))
    en = replace_block(en, 'window.SCHEDULE_CONFIG', js(schedule_cfg('en', M_en, RU)))
    if 'schedule-exceptions.js' not in en:
        en = en.replace('<script src="schedule.js"></script>',
                        '<script src="schedule-exceptions.js"></script>\n<script src="schedule.js"></script>')
    open(src_path, 'w', encoding='utf-8').write(en)

    for lang in LANGS[1:]:
        M = load(f'main_{lang}')
        s = translate(en, EN.SEG, M.T, f'main_{lang}')
        for a, b in M.RAW:
            assert a in s, f'main_{lang}: не найден фрагмент {a[:60]!r}'
            s = s.replace(a, b)
        s = set_head(s, lang); s = set_picker(s, lang)
        s = re.sub(r'<meta property="og:locale" content="[^"]*">', f'<meta property="og:locale" content="{M.OG_LOCALE}">', s)
        s = replace_block(s, 'ld+json', ld_json(lang, M, EN.SEG, M.T))
        s = replace_block(s, 'window.SIM_CONFIG', M.SIM)
        s = replace_block(s, 'window.FORM_CONFIG', js(form_cfg(lang, M, RU)))
        s = replace_block(s, 'window.SCHEDULE_CONFIG', js(schedule_cfg(lang, M, RU)))
        s = fix_paths(s, lang)
        left = leftovers(s, EN.SEG)
        assert not left, f'{lang}: остался английский текст: {left[:5]}'
        os.makedirs(os.path.join(ROOT, lang), exist_ok=True)
        open(os.path.join(ROOT, lang, 'index.html'), 'w', encoding='utf-8').write(s)
        print(f'{lang}/index.html')


def build_privacy():
    P_EN = load('privacy_en')
    src_path = os.path.join(ROOT, 'privacy.html')
    en = open(src_path, encoding='utf-8').read()
    en = set_head(en, 'en', 'privacy.html'); en = set_picker(en, 'en', 'privacy.html')
    open(src_path, 'w', encoding='utf-8').write(en)
    for lang in LANGS[1:]:
        P = load(f'privacy_{lang}')
        s = translate(en, P_EN.SEG, P.T, f'privacy_{lang}')
        s = set_head(s, lang, 'privacy.html'); s = set_picker(s, lang, 'privacy.html')
        s = fix_paths(s, lang)
        left = leftovers(s, P_EN.SEG)
        assert not left, f'privacy {lang}: остался английский текст: {left[:5]}'
        open(os.path.join(ROOT, lang, 'privacy.html'), 'w', encoding='utf-8').write(s)
        print(f'{lang}/privacy.html')


if __name__ == '__main__':
    build_index()
    build_privacy()
