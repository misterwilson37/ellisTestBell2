/**
 * Unit tests for signage/right-column.js — the pure parts of the shared
 * signage right column, which is to say the birthday ticker's calendar math.
 *     cd build && npm test
 *
 * The rendering, the Firestore listener and the score fetch are not covered
 * here (they need a DOM and a network); the scheduling rules are, because
 * they are the part that is easy to get subtly wrong and impossible to notice
 * until some kid's birthday is silently skipped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const RC = require('../signage/right-column.js');
const I = RC._internals;

/** Local midnight, avoiding any UTC parsing surprises. */
function d(y, m, day) { return new Date(y, m - 1, day); }

function setData({ birthdays = [], closures = [], holidays = [], fallback, faculty = [],
                   fallback2 } = {}) {
    I.setData(birthdays, closures, holidays, fallback, faculty, fallback2);
}

// How the closure sheet is actually filled in: Jake enters the WEEKDAYS the
// school is shut, Mon 23 -> Fri 27 Nov 2026, and nothing else. Run detection
// glues on the weekends either side, giving Sat 21 -> Sun 29 — nine days,
// exactly the owner's example, without him having to think about weekends.
//
// This is the whole reason runs are computed rather than read: an earlier
// version of this fixture listed Wed 25 -> Sun 29 and produced TWO runs (a
// bare weekend, then a five-day break) with the Mon/Tue in between still
// school days. Both are legitimate closures; which one you get depends
// entirely on what the sheet says, so the sheet has to say what he means.
const THANKSGIVING = { start: d(2026, 11, 23), end: d(2026, 11, 27), label: 'Thanksgiving' };

test('parseCsv: quoted fields containing commas stay one field', () => {
    const rows = I.parseCsv('name,monthday\n"Smith, Jr., Devon W.",03/14\nMaya R.,04/02\n');
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[1], ['Smith, Jr., Devon W.', '03/14']);
    assert.deepEqual(rows[2], ['Maya R.', '04/02']);
});

test('parseCsv: doubled quotes unescape, blank lines drop', () => {
    const rows = I.parseCsv('a,b\n"She said ""hi""",02/01\n\n');
    assert.deepEqual(rows[1], ['She said "hi"', '02/01']);
    assert.equal(rows.length, 2);
});

test('parseSheetDate: accepts both shapes Sheets exports, rejects junk', () => {
    assert.equal(I.parseSheetDate('2026-11-25').getTime(), d(2026, 11, 25).getTime());
    assert.equal(I.parseSheetDate('11/25/2026').getTime(), d(2026, 11, 25).getTime());
    assert.equal(I.parseSheetDate('next Tuesday'), null);
    assert.equal(I.parseSheetDate(''), null);
});

test('normalizeMonthDay: pads to MM/DD and rejects anything else', () => {
    assert.equal(I.normalizeMonthDay('3/14'), '03/14');
    assert.equal(I.normalizeMonthDay('03/14'), '03/14');
    assert.equal(I.normalizeMonthDay('3-14'), '03/14');
    assert.equal(I.normalizeMonthDay('03/14/2013'), null);
});

test('isSchoolDay: weekends off, closure ranges off, ordinary weekdays on', () => {
    setData({ closures: [THANKSGIVING] });
    assert.equal(I.isSchoolDay(d(2026, 11, 20)), true);   // Fri, last day in
    assert.equal(I.isSchoolDay(d(2026, 11, 26)), false);  // inside the range
    assert.equal(I.isSchoolDay(d(2026, 11, 21)), false);  // Saturday
    assert.equal(I.isSchoolDay(d(2026, 11, 30)), true);   // Monday back
});

test('closure runs: a holiday touching a weekend is ONE run, not two', () => {
    // MLK 2027 falls Monday 18 Jan, so Sat 16 -> Mon 18 is a single 3-day run.
    setData({ closures: [{ start: d(2027, 1, 18), end: d(2027, 1, 18), label: 'MLK' }] });
    const runs = I.upcomingClosureRuns(d(2027, 1, 14));   // Thursday
    assert.equal(runs[0].days.length, 3);
    assert.equal(runs[0].start.getTime(), d(2027, 1, 16).getTime());
    assert.equal(runs[0].end.getTime(), d(2027, 1, 18).getTime());
});

test('closure runs: a blank end date means a single day', () => {
    setData({ closures: [{ start: d(2027, 3, 3), end: d(2027, 3, 3), label: 'PD day' }] });
    const runs = I.upcomingClosureRuns(d(2027, 3, 1));    // Monday
    assert.equal(runs[0].days.length, 1);                  // Wed only
    assert.equal(runs[0].start.getTime(), d(2027, 3, 3).getTime());
});

test('lead window: an ordinary weekend is wished on the Friday alone', () => {
    setData({});
    const lead = I.leadSchoolDaysBefore(d(2026, 9, 19), 1);  // Sat 19 Sep 2026
    assert.equal(lead.length, 1);
    assert.equal(lead[0].getTime(), d(2026, 9, 18).getTime());
});

test("lead window: Thanksgiving's nine days spread over the whole preceding week", () => {
    setData({ closures: [THANKSGIVING] });
    // ceil(9 / 2) = 5 lead school days -> Mon 16 through Fri 20 Nov.
    const lead = I.leadSchoolDaysBefore(d(2026, 11, 21), 5);
    assert.equal(lead.length, 5);
    assert.equal(lead[0].getTime(), d(2026, 11, 16).getTime());
    assert.equal(lead[4].getTime(), d(2026, 11, 20).getTime());
});

test('lead window: skips days the school is already shut', () => {
    setData({ closures: [{ start: d(2027, 2, 15), end: d(2027, 2, 16), label: 'Break' }] });
    // Walking back from Wed 17 Feb: Tue 16 and Mon 15 are closed, so the two
    // lead days are the Thursday and Friday before.
    const lead = I.leadSchoolDaysBefore(d(2027, 2, 17), 2);
    assert.deepEqual(lead.map(x => x.getDate()), [11, 12]);
});

test('balancedChunks: date order survives and sizes differ by at most one', () => {
    const chunks = I.balancedChunks(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3);
    assert.deepEqual(chunks, [['a', 'b', 'c'], ['d', 'e'], ['f', 'g']]);
    assert.deepEqual(chunks.flat(), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
});

test('balancedChunks: fewer names than lead days leaves later days empty', () => {
    assert.deepEqual(I.balancedChunks(['a', 'b'], 5), [['a'], ['b'], [], [], []]);
});

test("today's birthday is wished today, plainly", () => {
    setData({ birthdays: [{ name: 'Maya R.', monthday: '09/17' }] });
    const items = I.buildTickerItems(d(2026, 9, 17));      // a Thursday
    assert.ok(items.includes('Happy Birthday,\nMaya R.!'));
});

test('a weekend birthday is wished early on the Friday', () => {
    setData({ birthdays: [{ name: 'Devon W.', monthday: '09/19' }] });  // Saturday
    const friday = I.buildTickerItems(d(2026, 9, 18));
    assert.ok(friday.includes('Happy Early Birthday,\nDevon W.!'));
    // …and not on the Thursday, which is outside the one-day lead window.
    const thursday = I.buildTickerItems(d(2026, 9, 17));
    assert.ok(!thursday.some(x => x.includes('Devon W.')));
});

test('Thanksgiving birthdays spread across the week, in date order, no duplicates', () => {
    setData({
        closures: [THANKSGIVING],
        birthdays: [
            { name: 'A.', monthday: '11/21' }, { name: 'B.', monthday: '11/22' },
            { name: 'C.', monthday: '11/23' }, { name: 'D.', monthday: '11/25' },
            { name: 'E.', monthday: '11/27' }, { name: 'F.', monthday: '11/29' },
        ]
    });
    const week = [16, 17, 18, 19, 20].map(day =>
        I.buildTickerItems(d(2026, 11, day)).filter(x => x.startsWith('Happy Early')));

    // Six names over five lead days: the first day takes two, the rest one each.
    assert.deepEqual(week.map(x => x.length), [2, 1, 1, 1, 1]);

    const order = week.flat().map(x => x.replace('Happy Early Birthday,\n', '').replace('!', ''));
    assert.deepEqual(order, ['A.', 'B.', 'C.', 'D.', 'E.', 'F.']);
    assert.equal(new Set(order).size, 6);
});

test('the same date always produces the same items — two TVs cannot disagree', () => {
    setData({ closures: [THANKSGIVING], birthdays: [
        { name: 'A.', monthday: '11/25' }, { name: 'B.', monthday: '11/27' },
    ]});
    assert.deepEqual(I.buildTickerItems(d(2026, 11, 18)), I.buildTickerItems(d(2026, 11, 18)));
});

test('a wacky holiday fills in when there are fewer than two birthdays', () => {
    setData({
        birthdays: [{ name: 'Solo S.', monthday: '06/04' }],
        holidays: [{ monthday: '06/04', text: 'National Cheese Day' }]
    });
    const items = I.buildTickerItems(d(2026, 6, 4));       // Thursday
    assert.equal(items.length, 2);
    assert.ok(items.includes('Happy National Cheese Day!'));   // v1.3.0 wrapper
});

test('two birthdays is already a rotation, so no holiday is pulled in', () => {
    setData({
        birthdays: [{ name: 'A.', monthday: '06/04' }, { name: 'B.', monthday: '06/04' }],
        holidays: [{ monthday: '06/04', text: 'National Cheese Day' }]
    });
    assert.ok(!I.buildTickerItems(d(2026, 6, 4)).includes('National Cheese Day'));
});

test('several holidays on one date: the same ones every time, in the same order', () => {
    // v1.1.0 changed how MANY are taken (see the fill-to-two tests below); what
    // this test is really pinning is that the pick is deterministic, because
    // two TVs showing this column must never disagree.
    setData({ holidays: [
        { monthday: '06/04', text: 'One' },
        { monthday: '06/04', text: 'Two' },
        { monthday: '06/04', text: 'Three' },
    ]});
    const first = I.buildTickerItems(d(2026, 6, 4));
    assert.deepEqual(I.buildTickerItems(d(2026, 6, 4)), first);
    assert.deepEqual(I.buildTickerItems(d(2026, 6, 4)), first);
});

test('the band never sits empty: nothing at all falls back to a configured line', () => {
    // v1.1.0: fills to TWO, not one — a single static line has nothing to flip
    // to, which is the opposite of what the band is for. See the fill-to-two
    // tests at the end of this file.
    setData({ fallback: 'Go Ellis', fallback2: 'Go Ellis' });
    const items = I.buildTickerItems(d(2026, 6, 4));
    assert.ok(items.length >= 1);
    assert.ok(items.every(x => x === 'Go Ellis'));
});

test('no early wishes are computed on a day the school is shut', () => {
    setData({ closures: [THANKSGIVING], birthdays: [{ name: 'A.', monthday: '11/27' }] });
    const items = I.buildTickerItems(d(2026, 11, 26));     // inside the closure
    assert.ok(!items.some(x => x.startsWith('Happy Early')));
});

test('summer is capped at the lead limit rather than needing ten weeks of runway', () => {
    setData({ closures: [{ start: d(2027, 5, 22), end: d(2027, 8, 5), label: 'Summer' }] });
    // The run is ~75 days; ceil(75/2) is far past the cap, so the window is
    // exactly MAX_LEAD_SCHOOL_DAYS = 15 school days, i.e. three school weeks.
    const lead = I.leadSchoolDaysBefore(d(2027, 5, 22), 15);
    assert.equal(lead.length, 15);
    assert.equal(lead[14].getTime(), d(2027, 5, 21).getTime());   // last day of school
    assert.equal(lead[0].getTime(), d(2027, 5, 3).getTime());     // three weeks earlier
});

test('a July birthday is reachable at all — the point of the cap', () => {
    setData({
        closures: [{ start: d(2027, 5, 22), end: d(2027, 8, 5), label: 'Summer' }],
        birthdays: [{ name: 'July J.', monthday: '07/04' }]
    });
    const anyDay = [3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21]
        .map(day => I.buildTickerItems(d(2027, 5, day)))
        .flat()
        .filter(x => x.includes('July J.'));
    assert.equal(anyDay.length, 1);
});

test('a malformed closure row is skipped, not fatal', () => {
    setData({ closures: [THANKSGIVING] });
    assert.doesNotThrow(() => I.buildTickerItems(d(2026, 11, 18)));
});

// --- v1.1.0: fill-to-two and the faculty pool -------------------------------

test('no birthdays and two holidays listed: BOTH are shown, so the band rotates', () => {
    setData({ holidays: [
        { monthday: '06/04', text: 'One' },
        { monthday: '06/04', text: 'Two' },
    ]});
    const items = I.buildTickerItems(d(2026, 6, 4));
    assert.equal(items.length, 2);
    assert.deepEqual([...items].sort(), ['Happy One!', 'Happy Two!']);
});

test('no birthdays and three events listed: ALL THREE are shown (v1.3.0)', () => {
    // Changed deliberately in v1.3.0, owner's call: with nobody's birthday to
    // protect, a day shows every event it has rather than stopping at two.
    setData({ holidays: [
        { monthday: '06/04', text: 'One' },
        { monthday: '06/04', text: 'Two' },
        { monthday: '06/04', text: 'Three' },
    ]});
    const items = I.buildTickerItems(d(2026, 6, 4));
    assert.equal(items.length, 3);
    assert.equal(new Set(items).size, 3);          // each once, no repeats
});

test('one birthday takes half the rotation, not a quarter of it', () => {
    setData({
        birthdays: [{ name: 'Solo S.', monthday: '06/04' }],
        holidays: [
            { monthday: '06/04', text: 'One' },
            { monthday: '06/04', text: 'Two' },
            { monthday: '06/04', text: 'Three' },
        ]
    });
    const items = I.buildTickerItems(d(2026, 6, 4));
    assert.equal(items.length, 2);
    assert.equal(items[0], 'Happy Birthday,\nSolo S.!');
});

test('nothing at all: the band flips between the TWO fallbacks, not one twice', () => {
    setData({ fallback: 'Ellis — 4 Houses, 1 Home', fallback2: 'Have a delightful day!' });
    assert.deepEqual(I.buildTickerItems(d(2026, 6, 4)),
        ['Ellis — 4 Houses, 1 Home', 'Have a delightful day!']);
});

test('only one fallback set: it repeats, as before', () => {
    setData({ fallback: 'Go Ellis', fallback2: 'Go Ellis' });
    const items = I.buildTickerItems(d(2026, 6, 4));
    assert.equal(items.length, 2);
    assert.ok(items.every(x => x === 'Go Ellis'));
});

test('one holiday and no birthdays: fallback line 1 takes the second slot', () => {
    setData({ holidays: [{ monthday: '06/04', text: 'Only One' }],
              fallback: 'Line One', fallback2: 'Line Two' });
    assert.deepEqual(I.buildTickerItems(d(2026, 6, 4)), ['Happy Only One!', 'Line One']);
});



test('faculty are wished exactly like students', () => {
    setData({ faculty: [{ name: 'Mr. Wilson', monthday: '09/17' }] });
    assert.ok(I.buildTickerItems(d(2026, 9, 17)).includes('Happy Birthday,\nMr. Wilson!'));
});

test('faculty count toward the fill-to-two rule, so no holiday is pulled in', () => {
    setData({
        birthdays: [{ name: 'Maya R.', monthday: '09/17' }],
        faculty: [{ name: 'Ms. Diaz', monthday: '09/17' }],
        holidays: [{ monthday: '09/17', text: 'Wacky Day' }]
    });
    const items = I.buildTickerItems(d(2026, 9, 17));
    assert.equal(items.length, 2);
    assert.ok(!items.includes('Wacky Day'));
});

test('a faculty birthday over a break gets the same early wish as a student', () => {
    setData({ closures: [THANKSGIVING], faculty: [{ name: 'Dr. Reed', monthday: '11/26' }] });
    const week = [16, 17, 18, 19, 20]
        .map(day => I.buildTickerItems(d(2026, 11, day)))
        .flat()
        .filter(x => x.includes('Dr. Reed'));
    assert.equal(week.length, 1);
    assert.ok(week[0].startsWith('Happy Early Birthday'));
});

// --- v1.3.0: context cards, the Happy wrapper, per-screen variety -----------

const FINGER = { monthday: '02/08', name: "Bill Finger's Birthday",
                 context: 'He created all of the recognizable aspects of Batman.' };
const GYGAX  = { monthday: '07/27', name: "Gary Gygax's Birthday",
                 context: 'He co-created Dungeons & Dragons.' };
const PATRIOT = { monthday: '09/11', name: 'Patriot Day', noHappy: true };

test('the wrapper: "Happy <name>!", and memorials opt out', () => {
    assert.equal(I.headlineFor({ name: 'National Donut Day' }), 'Happy National Donut Day!');
    assert.equal(I.headlineFor({ name: 'Patriot Day', noHappy: true }), 'Patriot Day');
});

test('the wrapper never doubles up on a row typed the long way round', () => {
    assert.equal(I.headlineFor({ name: 'Happy Pi Day!' }), 'Happy Pi Day!');
    assert.equal(I.headlineFor({ name: 'Talk Like a Pirate Day!!' }), 'Happy Talk Like a Pirate Day!');
});

test('context is its own card, directly after its headline', () => {
    setData({ holidays: [FINGER] });
    const items = I.buildTickerItems(d(2027, 2, 8));       // a Monday
    const at = items.indexOf("Happy Bill Finger's Birthday!");
    assert.ok(at >= 0);
    assert.equal(items[at + 1], 'He created all of the recognizable aspects of Batman.');
});

test('one birthday + an event with context: three cards, the kid appears once', () => {
    setData({ birthdays: [{ name: 'Maya R.', monthday: '02/08' }], holidays: [FINGER] });
    const items = I.buildTickerItems(d(2027, 2, 8));
    assert.deepEqual(items, [
        'Happy Birthday,\nMaya R.!',
        "Happy Bill Finger's Birthday!",
        'He created all of the recognizable aspects of Batman.',
    ]);
});

test('one birthday takes exactly ONE event even when several are listed', () => {
    setData({
        birthdays: [{ name: 'Maya R.', monthday: '02/08' }],
        holidays: [FINGER, { monthday: '02/08', name: 'Boy Scouts Day' },
                   { monthday: '02/08', name: 'Kite Flying Day' }]
    });
    const items = I.buildTickerItems(d(2027, 2, 8));
    const headlines = items.filter(x => x.startsWith('Happy') && !x.includes('Maya'));
    assert.equal(headlines.length, 1);
});

test('two birthdays: no events at all, context included', () => {
    setData({
        birthdays: [{ name: 'A.', monthday: '02/08' }, { name: 'B.', monthday: '02/08' }],
        holidays: [FINGER]
    });
    const items = I.buildTickerItems(d(2027, 2, 8));
    assert.equal(items.length, 2);
    assert.ok(!items.some(x => x.includes('Batman')));
});

test('no birthdays: every event AND every context card, each pair kept together', () => {
    setData({ holidays: [FINGER, { monthday: '02/08', name: 'Kite Flying Day' }] });
    const items = I.buildTickerItems(d(2027, 2, 8));
    assert.equal(items.length, 3);                     // 2 headlines + 1 context
    const at = items.indexOf("Happy Bill Finger's Birthday!");
    assert.equal(items[at + 1], 'He created all of the recognizable aspects of Batman.');
});

test('a memorial is shown exactly as written', () => {
    setData({ holidays: [PATRIOT] });
    assert.ok(I.buildTickerItems(d(2026, 9, 11)).includes('Patriot Day'));
});

test('the event pick is seeded by the date alone, unchanged since v1.2.0', () => {
    // Every TV runs the same page, so every TV must land on the same event.
    const events = ['A', 'B', 'C', 'D', 'E'].map(n => ({ monthday: '02/08', name: n }));
    setData({ birthdays: [{ name: 'Kid K.', monthday: '02/08' }], holidays: events });
    const key = '2027-02-08';
    let seed = 0;
    for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
    const expected = 'Happy ' + events[seed % events.length].name + '!';
    assert.ok(I.buildTickerItems(d(2027, 2, 8)).includes(expected));
    assert.deepEqual(I.buildTickerItems(d(2027, 2, 8)), I.buildTickerItems(d(2027, 2, 8)));
});

// --- v1.4.0: the break after the comma --------------------------------------

test('birthday cards break after the comma, name on its own line', () => {
    setData({ birthdays: [{ name: 'Suzie Q.', monthday: '09/17' }] });
    assert.ok(I.buildTickerItems(d(2026, 9, 17)).includes('Happy Birthday,\nSuzie Q.!'));
});

test('early wishes break after the comma too', () => {
    setData({ birthdays: [{ name: 'Devon W.', monthday: '09/19' }] });
    assert.ok(I.buildTickerItems(d(2026, 9, 18)).includes('Happy Early Birthday,\nDevon W.!'));
});



test('holidays and context never get the forced break', () => {
    setData({ holidays: [{ monthday: '02/08', name: "Bill Finger's Birthday",
                           context: 'He created all of the recognizable aspects of Batman.' }] });
    const items = I.buildTickerItems(d(2027, 2, 8));
    assert.ok(items.every(x => !x.includes('\n')));
});

// --- v1.4.1: the sheets re-fetch without a page reload ----------------------

import { readFileSync } from 'node:fs';

const tick = () => new Promise(r => setTimeout(r, 0));

function stubFetch(handler) {
    const calls = [];
    globalThis.fetch = async (url) => { calls.push(url); return handler(url, calls.length); };
    return calls;
}

test('init() actually SCHEDULES the hourly re-fetch — the v1.4.0 bug', () => {
    // The constant existed for four versions with nothing using it. Pin the
    // wiring itself, not just the constant, so it cannot go quiet again.
    const src = readFileSync(new URL('../signage/right-column.js', import.meta.url), 'utf8');
    assert.match(src, /setInterval\(refreshTickerSheets,\s*SHEET_REFRESH_MS\)/);
    assert.equal(I.SHEET_REFRESH_MS, 60 * 60 * 1000);
});

test('a re-fetch hits all four configured sheets again', async () => {
    const calls = stubFetch(() => ({ ok: true, text: async () => 'h1,h2\n' }));
    I.applyTickerUrls({
        birthdaysSheetCsvUrl: 'https://t/refetch-b', facultyBirthdaysSheetCsvUrl: 'https://t/refetch-f',
        closuresSheetCsvUrl: 'https://t/refetch-c', holidaysSheetCsvUrl: 'https://t/refetch-h',
    });
    await tick(); await tick();
    assert.equal(calls.length, 4);
    I.refreshTickerSheets();
    await tick(); await tick();
    assert.equal(calls.length, 8);
    for (const u of ['b', 'f', 'c', 'h']) {
        assert.equal(calls.filter(c => c === 'https://t/refetch-' + u).length, 2);
    }
});

test('an opt-out made in the sheet reaches the TV on the next re-fetch', async () => {
    // First load: two kids. Then one family opts out and the published feed
    // drops that row. After a re-fetch, and with NO reload, the name is gone.
    let roster = 'name,monthday\nMaya R.,09/17\nDevon W.,09/17\n';
    stubFetch(() => ({ ok: true, text: async () => roster }));
    I.setData([], [], [], 'F1', [], 'F2');
    I.applyTickerUrls({ birthdaysSheetCsvUrl: 'https://t/optout' });
    await tick(); await tick();
    assert.ok(I.buildTickerItems(d(2026, 9, 17)).some(x => x.includes('Devon W.')));

    roster = 'name,monthday\nMaya R.,09/17\n';
    I.refreshTickerSheets();
    await tick(); await tick();
    const after = I.buildTickerItems(d(2026, 9, 17));
    assert.ok(!after.some(x => x.includes('Devon W.')), 'opted-out name still on screen');
    assert.ok(after.some(x => x.includes('Maya R.')));
});

test('a failed re-fetch keeps the last good data instead of blanking the band', async () => {
    let fail = false;
    stubFetch(() => {
        if (fail) throw new Error('network down');
        return { ok: true, text: async () => 'name,monthday\nKeep K.,09/17\n' };
    });
    I.applyTickerUrls({ birthdaysSheetCsvUrl: 'https://t/keep' });
    await tick(); await tick();
    fail = true;
    I.refreshTickerSheets();
    await tick(); await tick();
    assert.ok(I.buildTickerItems(d(2026, 9, 17)).some(x => x.includes('Keep K.')));
});

// --- v1.5.0: minimum events, and the ?date= preview -------------------------

const EVENTS3 = ['Alpha', 'Beta', 'Gamma'].map(n => ({ monthday: '09/21', name: n }));
const KIDS2 = [{ name: 'A.', monthday: '09/21' }, { name: 'B.', monthday: '09/21' }];
const eventsIn = (items) => items.filter(x => /^Happy (Alpha|Beta|Gamma)!$/.test(x)).length;

function withMin(min, opts) {
    setData(opts);
    I.setMinEvents(min);
    const items = I.buildTickerItems(d(2026, 9, 21));
    I.setMinEvents('');                        // never leak into other tests
    return items;
}

test('default (absent) floor is exactly the old birthday-first rule', () => {
    assert.equal(eventsIn(withMin('', { birthdays: KIDS2, holidays: EVENTS3 })), 0);
    assert.equal(eventsIn(withMin('0', { birthdays: KIDS2, holidays: EVENTS3 })), 0);
});

test("two birthdays + 'At least 1' shows one event — today's actual screen", () => {
    assert.equal(eventsIn(withMin('1', { birthdays: KIDS2, holidays: EVENTS3 })), 1);
});

test("'At least 2' and 'All' on a two-birthday day", () => {
    assert.equal(eventsIn(withMin('2', { birthdays: KIDS2, holidays: EVENTS3 })), 2);
    assert.equal(eventsIn(withMin('all', { birthdays: KIDS2, holidays: EVENTS3 })), 3);
});

test('the floor never exceeds what the date actually has', () => {
    assert.equal(eventsIn(withMin('3', { birthdays: KIDS2, holidays: EVENTS3.slice(0, 1) })), 1);
});

test('a floor is never a CAP: no-birthday days still show every event', () => {
    assert.equal(eventsIn(withMin('1', { holidays: EVENTS3 })), 3);
});

test('birthdays always come first, whatever the floor', () => {
    const items = withMin('all', { birthdays: KIDS2, holidays: EVENTS3 });
    assert.ok(items[0].includes('A.') && items[1].includes('B.'));
});

test('parseMinEvents: sane values only, junk means default', () => {
    assert.equal(I.parseMinEvents('all'), 'all');
    assert.equal(I.parseMinEvents('ALL'), 'all');
    assert.equal(I.parseMinEvents('2'), 2);
    for (const junk of ['', null, undefined, 'lots', '-1', '0']) {
        assert.equal(I.parseMinEvents(junk), 0);
    }
});

test('parsePreviewDate: a real date only', () => {
    assert.equal(I.parsePreviewDate('?date=2026-11-18').getTime(), d(2026, 11, 18).getTime());
    assert.equal(I.parsePreviewDate('?tv&date=2026-11-18').getTime(), d(2026, 11, 18).getTime());
    assert.equal(I.parsePreviewDate(''), null);                  // every real TV
    assert.equal(I.parsePreviewDate('?date=11/18/2026'), null);
    assert.equal(I.parsePreviewDate('?date=2026-02-31'), null);  // no silent rollover
});

// --- v1.6.0: the card layout engine -----------------------------------------
// A fake font where every character is 55 units wide at REF 100 and metrics
// are Urbanist-like, so the geometry is exact and the tests are deterministic.

const TOOLS = { width: I.FALLBACK_WIDTH, metrics: I.FALLBACK_METRICS };
const GEOM = { avail: 900, halfH: 100, fill: 80 };
const plan = (text, geom = GEOM) => I.planCard(text, geom, TOOLS);
const inkHeight = (p) => (p.k - 1) * p.lh + (TOOLS.metrics.asc + TOOLS.metrics.desc) * p.px / 100;

test('every card is split into exactly two halves: the hinge never cuts a line', () => {
    for (const text of ["Happy New Year's Day!", 'Go Ellis', 'Happy Birthday,\nSuzie Q.!',
        'Asimov wrote nearly 500 books and invented the Three Laws of Robotics.']) {
        const p = plan(text);
        assert.equal(p.lines.length, 2 * p.k, text);
    }
});

test("the owner's example: New Year's Day splits at the balanced break", () => {
    assert.deepEqual(plan("Happy New Year's Day!").lines, ['Happy New', "Year's Day!"]);
});

test('a birthday keeps its break after the comma, whatever the balance', () => {
    assert.deepEqual(plan('Happy Birthday,\nSuzie Q.!').lines, ['Happy Birthday,', 'Suzie Q.!']);
    assert.equal(plan('Happy Birthday,\nSuzie Q.!').k, 1);
});

test('splitBalanced really minimises the widest line (checked by brute force)', () => {
    const words = 'Run Up the Flagpole & See If Anyone Salutes Day'.split(' ');
    const w = (s) => s.length;
    const got = Math.max(...I.splitBalanced(words, 2, w).map(w));
    let best = Infinity;
    for (let j = 1; j < words.length; j++) {
        best = Math.min(best, Math.max(w(words.slice(0, j).join(' ')), w(words.slice(j).join(' '))));
    }
    assert.equal(got, best);
});

test('splitBalanced never loses or reorders a word', () => {
    const words = 'Mary Shelley published Frankenstein in 1818 anonymously at age 20'.split(' ');
    for (const n of [2, 4]) {
        assert.deepEqual(I.splitBalanced(words, n, (s) => s.length).join(' ').split(' '), words);
    }
});

test('a single word goes in the top half and the bottom is left empty', () => {
    assert.deepEqual(plan('Hanukkah').lines, ['Hanukkah', '']);
});

test('the text always fits: width, and 80% of the half height', () => {
    for (const text of ["Happy New Year's Day!", 'Happy Run Up the Flagpole & See If Anyone Salutes Day!',
        'Asimov wrote nearly 500 books and invented the Three Laws of Robotics.',
        'Happy Early Birthday,\nMr. Featherstonehaugh!']) {
        const p = plan(text);
        const widest = Math.max(...p.lines.map(I.FALLBACK_WIDTH)) * p.px / 100;
        assert.ok(widest <= GEOM.avail + 0.01, 'too wide: ' + text);
        assert.ok(inkHeight(p) <= GEOM.fill + 0.01, 'too tall: ' + text);
    }
});

test('short cards all land at the same size, because height caps them', () => {
    assert.equal(plan("Happy New Year's Day!").px, plan('Happy Pi Day!').px);
    assert.equal(plan('Happy Birthday,\nSuzie Q.!').px, plan('Go Ellis').px);
});

test('long text shrinks, but only as far as it must', () => {
    const shortPx = plan("Happy New Year's Day!").px;
    const longPx = plan('Asimov wrote nearly 500 books and invented the Three Laws of Robotics.').px;
    assert.ok(longPx < shortPx);
});

test('two lines per half is chosen only when it gives larger text', () => {
    // A tall, narrow tile makes four short lines beat two long ones.
    const tall = { avail: 400, halfH: 400, fill: 320 };
    const p = plan('Asimov wrote nearly 500 books and invented the Three Laws of Robotics.', tall);
    assert.equal(p.k, 2);
    // ...and on the real, wide, short band it stays one line per half.
    assert.equal(plan('Asimov wrote nearly 500 books and invented the Three Laws of Robotics.').k, 1);
});

test('the nudge is the same for one or two lines per half', () => {
    const one = plan("Happy New Year's Day!");
    const scale = one.px / 100, M = TOOLS.metrics;
    assert.equal(one.nudge.toFixed(6), ((M.fd - M.fa + M.asc - M.desc) / 2 * scale).toFixed(6));
});

test('names do not hop: every birthday name line gets the same nudge', () => {
    const a = plan('Happy Birthday,\nSuzie Q.!'), b = plan('Happy Birthday,\nMaya R.!');
    assert.equal(a.nudge, b.nudge);
    assert.equal(a.px, b.px);
});

test('empty text does not crash the layout', () => {
    assert.doesNotThrow(() => plan(''));
});
