"""Выписывает из английской страницы все тексты, которые надо переводить.

Кусок текста — это содержимое элемента целиком (<p>, <h2>, <li>, <summary>…),
вместе со вложенными <b>, <span>, <br>: так перевод может менять порядок слов.
Плюс атрибуты alt, title, aria-label и мета-теги.
Скрипты (<script>) не трогаются: настройки калькулятора, формы и календаря
на каждом языке собираются целиком из словаря — см. build_main.py."""
import re, sys

BLOCK = r'(p|h1|h2|h3|li|summary|span|a|button|label|figcaption|title|output)'
SEG_RE = re.compile(r'<' + BLOCK + r'(\s[^>]*)?>(.*?)</\1>', re.S)
ATTR_RE = re.compile(r'\b(alt|title|aria-label|content)="([^"]*)"')

def strip_scripts(html):
    return re.sub(r'<script\b.*?</script>', '', html, flags=re.S)

def has_words(s):
    t = re.sub(r'<[^>]+>|&[a-z#0-9]+;', ' ', s)
    return re.search(r'[A-Za-z]{2,}', t) is not None

def segments(html):
    html = strip_scripts(html)
    out = []
    for m in SEG_RE.finditer(html):
        inner = m.group(3).strip()
        if '\n' in inner or not has_words(inner): continue
        # элемент, внутри которого другой блочный элемент, не берём — возьмём вложенные
        if re.search(r'<(p|h1|h2|h3|li|div|ul|article|section)\b', inner): continue
        out.append(inner)
    for m in ATTR_RE.finditer(html):
        name, val = m.groups()
        if name == 'content' and not re.search(r'\s', val): continue   # адреса, коды
        if has_words(val): out.append(val)
    seen, uniq = set(), []
    for s in out:
        if s not in seen: seen.add(s); uniq.append(s)
    return uniq

if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    for i, s in enumerate(segments(src), 1):
        print(f'{i:03d}\t{s}')
