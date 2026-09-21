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
    assert.ok(items.includes('Happy Birthday, Maya R.!'));
});

test('a weekend birthday is wished early on the Friday', () => {
    setData({ birthdays: [{ name: 'Devon W.', monthday: '09/19' }] });  // Saturday
    const friday = I.buildTickerItems(d(2026, 9, 18));
    assert.ok(friday.includes('Happy Early Birthday, Devon W.!'));
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

    const order = week.flat().map(x => x.replace('Happy Early Birthday, ', '').replace('!', ''));
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
    assert.equal(items[0], 'Happy Birthday, Solo S.!');
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

test('ticker sizing never grows as lines get longer, and has a floor', () => {
    const size = (s) => parseFloat(I.fitSizeFor(s));
    // Monotonic across the whole range: a longer line must never come back
    // larger, whatever the breakpoints are tuned to.
    let previous = Infinity;
    for (let n = 1; n <= 200; n++) {
        const current = size('x'.repeat(n));
        assert.ok(current <= previous, `size grew at length ${n}`);
        previous = current;
    }
    assert.ok(size('Go Ellis') > size('Happy Early Birthday, Ms. Vandermeulen!'));
    assert.equal(I.fitSizeFor('x'.repeat(400)), '5.25cqw');   // floor, never 0
});

test('the longest routine outputs of this feature all get a real size', () => {
    // Faculty entries are the long ones: a title AND a full surname. If any of
    // these came back at the largest step, it would overflow the band.
    const longest = [
        'Happy Early Birthday, Ms. Vandermeulen!',
        'Happy Birthday, Mr. Featherstonehaugh!',
        'Ellis — 4 Houses, 1 Home',
    ];
    for (const line of longest) {
        assert.notEqual(I.fitSizeFor(line), '9.5cqw');
    }
});

test('faculty are wished exactly like students', () => {
    setData({ faculty: [{ name: 'Mr. Wilson', monthday: '09/17' }] });
    assert.ok(I.buildTickerItems(d(2026, 9, 17)).includes('Happy Birthday, Mr. Wilson!'));
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
        'Happy Birthday, Maya R.!',
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
