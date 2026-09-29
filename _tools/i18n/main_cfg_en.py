# Английская главная: настройки калькулятора не трогаем (они в самой странице),
# здесь — подписи для календаря, формы и разметки для поисковиков.
INTL_LOCALE = 'en-US'
BRAND = 'Market Game'
CURRENCY = 'USD'
PRICES = {'l12': 25, 'l24': 100, 'l36': 3000}
PRICE_TXT = {'l12': '$25', 'l24': '$100', 'l36': '$3000'}
LEAGUE_SHORT = {'l12': 'League 12', 'l24': 'League 24', 'l36': 'League 36'}
LEAGUE_FULL = {'l12': 'League 12 · Start', 'l24': 'League 24 · Growth', 'l36': 'League 36 · Elite'}
CITY = {'la': 'Los Angeles', 'den': 'Denver', 'chi': 'Chicago', 'nyc': 'New York', 'lon': 'London', 'utc': 'UTC'}
STREAMS = {
    'intl': 'International',
    'eastern': 'Eastern Time', 'central': 'Central Time', 'mountain': 'Mountain Time', 'pacific': 'Pacific Time',
    'ny': 'New York', 'fl': 'Florida', 'tx': 'Texas', 'il': 'Illinois',
    'co': 'Colorado', 'az': 'Arizona', 'ca': 'California', 'wa': 'Washington',
}
KIND = {'intl': 'Open game · International', 'zone': 'Open game · Time zone', 'state': 'Open game · State'}
FILTERS = {'all': 'All games', 'et': 'Eastern', 'ct': 'Central', 'mt': 'Mountain', 'pt': 'Pacific',
           'intl': 'International'}
SCHED_TEXT = {
    'watch': 'Watch free',
    'duration': '{h} h',
    'yourTime': 'your local time',
    'soonest': 'next up',
    'cta': 'Take a seat',
    'empty': 'No games in this group in the coming weeks. Send a request and a manager will name the nearest dates.',
    'monthCount': 'Games in the next 30 days: {n}',
    'decimal': '.',
    'otherDay': 'a different calendar day in this city',
    'filterLabel': 'Show games by region',
}
FORM_LEAGUE_NONE = 'Not sure yet'
FORM_WATCH = 'Watch a game — free'
FORM_TEXT = {
    'title': 'Join a game',
    'subtitle': 'We reply within a day and tell you about the next games.',
    'name': 'Your name', 'namePh': 'Name',
    'phone': 'Phone', 'phonePh': '+1 555 000 0000',
    'telegram': 'Telegram handle', 'telegramPh': '@username',
    'league': 'What are you interested in',
    'consent': 'I agree to the processing of my personal data —',
    'privacy': 'privacy policy',
    'submit': 'Send request', 'sending': 'Sending…',
    'successTitle': 'Request received',
    'successText': 'We will get back to you within a day. If you do not hear from us, write directly — the contact is in the footer.',
    'close': 'Close',
    'errName': 'Please tell us what to call you.',
    'errContact': 'Leave a phone number or a Telegram handle — otherwise we cannot reply.',
    'errPhone': 'That phone number looks incomplete. Please check it.',
    'errConsent': 'We cannot accept the request without your consent to data processing.',
    'errSend': 'The request could not be sent.',
    'errSendFallback': 'Write directly:',
}
LD = {
    'name': 'Market Game — team business simulation',
    'desc': 'A team business game: 4 to 20 teams compete for one shared market over 12, 24 or 36 game turns in a single session. A model distributes 10,000 customers by price, quality, advertising and capacity. Whoever ends with the most cash wins.',
    'category': 'Business simulation, entrepreneurship training',
    'audience': 'Aspiring and working entrepreneurs, managers, HR and L&D',
    'offer_l12': '12 game turns in a single session, for people who have no business yet. Priced per team of any size.',
    'offer_l24': '24 game turns in a single session, for owners of a running business with up to 10 employees and up to 1,000,000 USD annual revenue. Priced per team of any size.',
    'offer_l36': '36 game turns in a single session, a strategy session for medium and large business. Priced per team of any size.',
}
