/**
 * Ellis Web Bell — Signage Right Column (behaviour)
 * Version: 1.4.0 (app release v6.26.0 — sibling surface, app version unchanged)
 *
 * v1.4.0: birthday cards break AFTER THE COMMA — "Happy Birthday," on one
 *   line, the name on the next — instead of wherever the text happened to
 *   wrap. At 8cqw the live screen showed "Happy Birthday, Suzie" / "Q.!",
 *   splitting a child's name across lines. Cards with an explicit break are
 *   now sized by their LONGEST LINE so that neither line wraps again.
 *   CALIBRATED AGAINST THE REAL SCREEN, not font arithmetic: that same wrap
 *   showed ~21 characters per line at 8cqw, and PER_LINE_STEPS scale from it.
 *
 * v1.3.0: the holiday list grew to 2+ events for every calendar day, several
 *   of which mean nothing without a sentence of context ("Who is Gygax?").
 *   (a) FOUR-COLUMN HOLIDAYS: month/day, name, context (optional), no-Happy
 *       flag (optional). The ticker now wraps each name as "Happy <name>!",
 *       because every entry in the owner's list was written to be said that
 *       way; column D opts a row out for memorials like Patriot Day.
 *   (b) CONTEXT IS ITS OWN CARD, flipped in right after the headline, never a
 *       second line on the same card. The band is 12% of the column: a
 *       headline plus a sentence in that space shrinks both past readability
 *       from across a hallway. One fact per flip, question then answer.
 *   (c) NO-BIRTHDAY DAYS SHOW EVERY EVENT listed for the date (owner's call),
 *       instead of stopping at two. Birthday days are unchanged: with one
 *       birthday the ticker takes ONE event (plus its context card), so that
 *       kid is a third of a three-card loop — owner's call, over repeating
 *       the name to keep it at half.
 *   CONSIDERED AND DROPPED: per-screen event variety via a ?screen=N URL
 *   parameter. It was built, then removed the same round, because the owner's
 *   Yodeck setup is ONE screen sent out to many TVs — there is no per-TV URL
 *   to put a parameter in. Every TV shows the same thing, which he is fine
 *   with. Do not re-propose it without first confirming the setup changed.
 *
 * v1.2.0: (a) TWO fallback lines instead of one, so a day with nothing on it
 *   still FLIPS rather than showing the same sentence to itself forever.
 *   (b) LENGTH-AWARE SIZING. The band was a fixed 8cqw, which fits about a
 *   dozen characters per line in a 25%-of-TV column — fine for "Go Ellis",
 *   not fine for "Happy Early Birthday, Mr. Wilson!" (33 characters), which
 *   is an ordinary output of this feature, not an edge case. Faculty names
 *   carry a title AND a full surname, so the longest strings the ticker
 *   produces are the routine ones. Each line now picks its own size from its
 *   own length, so a short name stays large and a long one shrinks to fit
 *   instead of overflowing the band.
 *
 * v1.1.0: (a) FACULTY BIRTHDAYS from a fourth published CSV, pooled with the
 *   students so they get the same early-wish treatment and count toward the
 *   fill-to-two rule. Separate feed, not stacked into the student one: the
 *   student formula's whole job is stripping year/surname/opt-outs, and
 *   entangling a second list with it makes both harder to reason about.
 *   (b) FIXED: the fill-to-two rule added at most ONE holiday, so a day with
 *   no birthdays showed a single static line with nothing to flip to — the
 *   opposite of the "always a rotation of at least 2" the band exists for.
 *   It now pulls holidays until it HAS two, then the fallback line, and never
 *   takes more than it needs: on a one-birthday day that kid is half the
 *   rotation rather than a quarter of it.
 *   (c) Every sheet load now logs rows-fetched vs rows-parsed to the console.
 *   A row the reader cannot parse is dropped silently, and a TV in a hallway
 *   has no way to report that — so the check has to be visible from a desk.
 *
 * The SINGLE home for the right column's markup and logic, shared by
 * dashboard.html and dashright.html. Companion to right-column.css, which
 * documents the five ways the two duplicated copies had already drifted.
 *
 * Follows the schedule-utils.js pattern exactly: a plain <script> exporting
 * one global, no build step, no modules. The owner has no CLI on his school
 * Mac and deploys through the GitHub web portal, so anything needing a local
 * build is not an option here.
 *
 * LOAD ORDER (in each page's <head>, after firebase-config.js):
 *     <script src="../bell-engine.js"></script>
 *     <script src="schedule-utils.js"></script>
 *     <script src="right-column.js"></script>
 *
 * USAGE:
 *     SignageRightColumn.init({
 *         db: firebase.firestore(),
 *         appId: firebaseConfig.appId,
 *         mount: document.getElementById('rc-mount'),
 *         scheduleConfigOverride: urlConfig || null
 *     });
 *
 * scheduleConfigOverride exists because dashboard.html can take its schedule
 * selection from URL parameters (?s1=…&l1=…) instead of the shared config
 * doc. When it is passed, the sheet URLs still come from the config doc —
 * only the schedule picks are overridden. dashright.html never passes it.
 *
 * WHAT THIS OWNS: the column's markup, the 1s clock tick, the 5min house
 * score fetch, and the ticker. The PAGE still owns Firebase init, auth, and
 * anything outside the column (dashboard's Canva frame and setup panel).
 * Both pages keep their own listener on the config doc for their own reasons;
 * Firestore shares the underlying subscription, so that costs nothing.
 *
 * ---------------------------------------------------------------------------
 * THE TICKER, AND WHY IT IS SHAPED THIS WAY
 *
 * Three published Google Sheet CSVs, configured in dashboard-config.html:
 *   birthdaysSheetCsvUrl  name,monthday   e.g. "Maya R.","03/14"
 *   closuresSheetCsvUrl   start,end,label  end blank = single day
 *   holidaysSheetCsvUrl   monthday,text
 *
 * STUDENT PRIVACY IS THE CONSTRAINT THAT SHAPED THE SCHEMA. The birthday CSV
 * carries NO birth year, NO full last name, and NO student who has opted out
 * — the workbook's published tab is a formula over a private Roster tab that
 * strips all three before the data ever leaves the document. So the opt-out
 * is enforced at the source, not by this file choosing to skip a row, and the
 * public URL never exposes a date of birth. Do not "improve" this by
 * publishing the roster tab directly, and do not add the year to the display.
 * Nothing here is written to Firestore — same rule as every other school
 * project in this codebase.
 *
 * EARLY WISHES. Every kid should get acknowledged, including the ones whose
 * birthday lands on a day the school is shut. On each school day the ticker
 * shows today's birthdays plus a share of the birthdays falling in an
 * upcoming closure, spread across the school days leading up to it:
 *
 *     lead school days = min(ceil(closure length / 2), MAX_LEAD_SCHOOL_DAYS)
 *
 * so a weekend is wished on the Friday, a three-day weekend over two days,
 * Thanksgiving's nine days over the whole preceding week, and summer over the
 * last three weeks of school. Spreading rather than dumping is the point: the
 * alternative puts seventy names on one afternoon.
 *
 * MAX_LEAD_SCHOOL_DAYS = 15 is what makes summer birthdays reachable at all —
 * without a cap they would need ten weeks of lead time and would simply never
 * be wished. It also means graduating 8th graders get their summer wish on
 * the way out. STILL WANTED FROM THE OWNER: enrolment. Items per day is
 * roughly (75/365 * enrolment) / 15 plus that day's own, so ~9 items at 600
 * students (a 45s loop at 5s an item) but ~17 at 1200, where the cap wants
 * raising to 20. The constant is the only thing that needs to change.
 *
 * Names within one closure are dealt out in DATE ORDER across the lead days
 * in balanced chunks, so the kid whose birthday falls first in the break is
 * wished on the first lead day. Everything is a pure function of (the sheets,
 * the date), with no randomness and nothing persisted — which is what lets
 * dashboard.html and dashright.html land on the same names at the same
 * moment. Two TVs disagreeing would read as a bug.
 *
 * FILLING TO TWO. A school day with fewer than two birthdays pulls in that
 * date's wacky holiday so there is always a rotation. With neither, it falls
 * back to a configurable line so the band never sits empty — an empty band at
 * the top of the column reads as broken.
 */
(function (global) {
    'use strict';

    // --- Tunables -----------------------------------------------------------

    var MAX_LEAD_SCHOOL_DAYS = 15;   // see header: the summer-birthday cap
    var MIN_TICKER_ITEMS = 2;        // below this, pull in a wacky holiday
    var ROTATE_MS = 5000;            // owner's number
    var CLOSURE_SEARCH_DAYS = 45;    // far enough ahead to find any run start
    var MAX_CLOSURE_RUN_DAYS = 365;  // guard: never walk a run forever
    var SHEET_REFRESH_MS = 60 * 60 * 1000;
    var SCORES_REFRESH_MS = 5 * 60 * 1000;

    var HOUSE_ORDER = ['accomodore', 'callidus', 'princeps', 'vevaios'];
    var HOUSE_LABELS = {
        accomodore: 'Accomodore',
        callidus: 'Callidus',
        princeps: 'Princeps',
        vevaios: 'Vevaios'
    };

    // Two of them, so a day with no birthdays and no holiday still has
    // something to flip to. "One School" came out at the owner's request — it
    // is not part of what anyone at Ellis actually says.
    var DEFAULT_FALLBACK_TEXT = 'Ellis — 4 Houses, 1 Home';
    var DEFAULT_FALLBACK_TEXT_2 = 'Have a delightful day!';

    /**
     * Font size by line length, in cqw against the column. The band holds
     * roughly three wrapped lines, and a fixed size either wastes the space on
     * short lines or overflows on long ones. Breakpoints, not a smooth curve:
     * a continuous fit would make every flip a slightly different size, which
     * reads as jitter on a wall.
     */
    //
    // Sizing arithmetic these were derived from, for whoever tunes them next:
    // at 8cqw in a 25%-of-TV column the glyphs run ~0.52em wide, so a line
    // holds ~22 characters and the 12% band holds not quite three of them.
    // Hence ~44 characters is the comfortable two-line ceiling at 8cqw. THESE
    // ARE ESTIMATES, NOT MEASUREMENTS — the real check is a long faculty name
    // on the actual frame.
    var FIT_STEPS = [
        { max: 20, size: '9.5cqw' },   // "Go Ellis", "Happy Birthday, A.!"
        { max: 34, size: '8cqw' },     // "Happy Early Birthday, Mr. Wilson!" (33)
        { max: 50, size: '6.5cqw' },   // "Happy Early Birthday, Ms. Vandermeulen!" (39)
        { max: Infinity, size: '5.25cqw' }
    ];

    /**
     * v1.4.0: for cards with an explicit line break, the goal is different —
     * each line must fit on ONE line, so size by the longest line. Calibrated
     * from the live screen: at 8cqw, "Happy Birthday, Suzie" (21 characters)
     * fit on a line and the "Q.!" after it did not. The other steps scale from
     * that in proportion to font size, rounded down to leave a margin.
     */
    var PER_LINE_STEPS = [
        { max: 17, size: '9.5cqw' },   // "Happy Birthday,"  "Ms. Vandermeulen!"
        { max: 20, size: '8cqw' },
        { max: 25, size: '6.5cqw' },   // "Happy Early Birthday,"
        { max: Infinity, size: '5.25cqw' }
    ];

    function fitSizeFor(text) {
        text = text || '';
        if (text.indexOf('\n') !== -1) {
            var longest = text.split('\n').reduce(function (m, line) {
                return Math.max(m, line.length);
            }, 0);
            for (var p = 0; p < PER_LINE_STEPS.length; p++) {
                if (longest <= PER_LINE_STEPS[p].max) return PER_LINE_STEPS[p].size;
            }
        }
        var length = text.length;
        for (var i = 0; i < FIT_STEPS.length; i++) {
            if (length <= FIT_STEPS[i].max) return FIT_STEPS[i].size;
        }
        return FIT_STEPS[FIT_STEPS.length - 1].size;
    }

    // --- Module state -------------------------------------------------------

    var db = null;
    var appId = null;
    var root = null;
    var scheduleConfigOverride = null;

    var schedules = {};
    var scheduleConfig = { s1: null, s2: null, s3: null, l1: '', l2: '', l3: '' };

    var currentHousesUrl = null;
    var housesFetchTimer = null;

    var sheetUrls = { birthdays: null, faculty: null, closures: null, holidays: null };
    var birthdays = [];        // students: [{ name, monthday }]
    var facultyBirthdays = []; // faculty, same shape, same pool
    var closures = [];    // [{ start: Date, end: Date, label }]
    var holidays = [];    // [{ monthday, text }]
    var fallbackText = DEFAULT_FALLBACK_TEXT;
    var fallbackText2 = DEFAULT_FALLBACK_TEXT_2;


    var tickerItems = [];
    var tickerItemsDateKey = null;
    var shownIndex = -1;
    var shownText = null;

    // --- Small helpers ------------------------------------------------------

    function pad2(n) { return String(n).padStart(2, '0'); }

    function dateKey(d) {
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    function monthDayKey(d) {
        return pad2(d.getMonth() + 1) + '/' + pad2(d.getDate());
    }

    function addDays(d, n) {
        var out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        out.setDate(out.getDate() + n);
        return out;
    }

    function startOfDay(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    /**
     * Accepts the two shapes a Google Sheet actually exports depending on the
     * cell's format: 2026-11-25 and 11/25/2026. Anything else returns null and
     * is skipped rather than throwing — a typo in one closure row must not
     * take the whole sign down.
     */
    function parseSheetDate(raw) {
        var s = (raw || '').trim();
        if (!s) return null;
        var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        var us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (us) return new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]));
        return null;
    }

    /** Normalises "3/14", "03/14", "3-14" to "03/14". */
    function normalizeMonthDay(raw) {
        var s = (raw || '').trim();
        var m = s.match(/^(\d{1,2})[/-](\d{1,2})$/);
        if (!m) return null;
        return pad2(Number(m[1])) + '/' + pad2(Number(m[2]));
    }

    /**
     * A real CSV parse, quoted fields and all. The house-score fetcher splits
     * on bare commas, which is fine for four integers and NOT fine for names:
     * one "Smith, Jr." would shift every column on that row. Google quotes any
     * field containing a comma, so handling quotes is all that is required.
     */
    function parseCsv(text) {
        var rows = [];
        var row = [];
        var field = '';
        var inQuotes = false;
        var i = 0;
        while (i < text.length) {
            var c = text[i];
            if (inQuotes) {
                if (c === '"') {
                    if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                    inQuotes = false; i++; continue;
                }
                field += c; i++; continue;
            }
            if (c === '"') { inQuotes = true; i++; continue; }
            if (c === ',') { row.push(field); field = ''; i++; continue; }
            if (c === '\r') { i++; continue; }
            if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
            field += c; i++;
        }
        row.push(field);
        rows.push(row);
        return rows.filter(function (r) {
            return r.some(function (cell) { return cell.trim() !== ''; });
        });
    }

    /** Drops a header row if the first cell doesn't look like data. */
    function stripHeader(rows, looksLikeData) {
        if (rows.length && !looksLikeData(rows[0])) return rows.slice(1);
        return rows;
    }

    async function fetchCsv(url) {
        var response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return parseCsv(await response.text());
    }

    // --- School calendar ----------------------------------------------------

    function isClosureDay(d) {
        var t = startOfDay(d).getTime();
        for (var i = 0; i < closures.length; i++) {
            if (t >= closures[i].start.getTime() && t <= closures[i].end.getTime()) return true;
        }
        return false;
    }

    function isSchoolDay(d) {
        var dow = d.getDay();
        if (dow === 0 || dow === 6) return false;
        return !isClosureDay(d);
    }

    /**
     * Every maximal run of consecutive non-school days starting after `from`,
     * within the search horizon. A run is what gets a lead window — the unit
     * is the closure as experienced, so a Monday holiday attached to a weekend
     * is ONE three-day run, not a weekend plus a day.
     */
    function upcomingClosureRuns(from) {
        var runs = [];
        var cursor = addDays(from, 1);
        var scanned = 0;
        while (scanned < CLOSURE_SEARCH_DAYS) {
            if (!isSchoolDay(cursor)) {
                var run = { start: cursor, days: [] };
                var walk = cursor;
                var guard = 0;
                while (!isSchoolDay(walk) && guard < MAX_CLOSURE_RUN_DAYS) {
                    run.days.push(walk);
                    walk = addDays(walk, 1);
                    guard++;
                }
                run.end = run.days[run.days.length - 1];
                runs.push(run);
                scanned += (walk - cursor) / 86400000;
                cursor = walk;
                continue;
            }
            cursor = addDays(cursor, 1);
            scanned++;
        }
        return runs;
    }

    /** The last `count` school days strictly before `before`, chronological. */
    function leadSchoolDaysBefore(before, count) {
        var out = [];
        var cursor = addDays(before, -1);
        var guard = 0;
        while (out.length < count && guard < 400) {
            if (isSchoolDay(cursor)) out.unshift(cursor);
            cursor = addDays(cursor, -1);
            guard++;
        }
        return out;
    }

    /**
     * Splits `items` into `k` contiguous chunks as evenly as possible, the
     * first (n % k) chunks taking one extra. Contiguous rather than
     * round-robin so date order survives: chunk 0 holds the earliest
     * birthdays in the closure and lands on the earliest lead day.
     */
    function balancedChunks(items, k) {
        var chunks = [];
        var base = Math.floor(items.length / k);
        var extra = items.length % k;
        var at = 0;
        for (var i = 0; i < k; i++) {
            var size = base + (i < extra ? 1 : 0);
            chunks.push(items.slice(at, at + size));
            at += size;
        }
        return chunks;
    }

    /**
     * Students and faculty are one pool from here down: same greeting, same
     * early-wish spreading, same contribution to the fill-to-two rule. Students
     * first so the order is stable and predictable.
     */
    function birthdaysOn(monthday) {
        return birthdays.concat(facultyBirthdays).filter(function (b) {
            return b.monthday === monthday;
        });
    }

    // --- Ticker content -----------------------------------------------------

    /**
     * Deterministic seed for the event pick, from the date alone: every TV
     * running this page lands on the same events in the same order.
     */
    function seedFor(today) {
        var key = dateKey(today);
        var seed = 0;
        for (var c = 0; c < key.length; c++) seed = (seed * 31 + key.charCodeAt(c)) % 100000;
        return seed;
    }

    /**
     * "Bill Finger's Birthday" -> "Happy Bill Finger's Birthday!". Every name in
     * the owner's list was written to take "Happy" in front. Rows flagged in
     * column D (memorials — Patriot Day) are shown exactly as written. Also
     * tolerates a name that already carries its own "Happy" or "!", so a row
     * typed the long way round does not come out "Happy Happy …!!".
     */
    function headlineFor(event) {
        if (event.noHappy) return event.name;
        var name = event.name.replace(/!+\s*$/, '');
        if (/^happy\b/i.test(name)) return name + '!';
        return 'Happy ' + name + '!';
    }

    /** An event's cards: the headline, then its context if it has one. */
    function cardsFor(event) {
        var cards = [headlineFor(event)];
        if (event.context) cards.push(event.context);
        return cards;
    }

    function buildTickerItems(now) {
        var items = [];
        var today = startOfDay(now);

        birthdaysOn(monthDayKey(today)).forEach(function (b) {
            items.push('Happy Birthday,\n' + b.name + '!');
        });

        if (isSchoolDay(today)) {
            upcomingClosureRuns(today).forEach(function (run) {
                var leadCount = Math.min(
                    Math.ceil(run.days.length / 2),
                    MAX_LEAD_SCHOOL_DAYS
                );
                var leadDays = leadSchoolDaysBefore(run.start, leadCount);
                var todayKey = dateKey(today);
                var index = -1;
                for (var i = 0; i < leadDays.length; i++) {
                    if (dateKey(leadDays[i]) === todayKey) { index = i; break; }
                }
                if (index === -1) return;

                // Names in the order their birthdays fall inside the closure.
                var names = [];
                run.days.forEach(function (day) {
                    birthdaysOn(monthDayKey(day)).forEach(function (b) { names.push(b.name); });
                });
                if (!names.length) return;

                balancedChunks(names, leadDays.length)[index].forEach(function (name) {
                    items.push('Happy Early Birthday,\n' + name + '!');
                });
            });
        }

        // v1.3.0 event rules, by how many birthdays the day already has:
        //   2+  -> no events; the kids fill the loop
        //   1   -> ONE event (plus its context card): that kid is a third of a
        //          three-card loop, which the owner chose over repeating the name
        //   0   -> EVERY event listed for the date
        // Order and, on one-birthday days, WHICH event, are seeded by the date:
        // fixed all day, and identical on every TV.
        var birthdayCount = items.length;
        if (birthdayCount < MIN_TICKER_ITEMS) {
            var matches = holidays.filter(function (h) { return h.monthday === monthDayKey(today); });
            if (matches.length) {
                var offset = seedFor(today) % matches.length;
                var wanted = birthdayCount === 0 ? matches.length : 1;
                for (var k = 0; k < wanted; k++) {
                    cardsFor(matches[(offset + k) % matches.length]).forEach(function (card) {
                        items.push(card);
                    });
                }
            }
        }

        // Alternate the two fallbacks so the band flips between two different
        // sentences rather than showing one to itself. If only one is set, the
        // old behaviour (repeat it) is what is left.
        var fallbacks = fallbackText2 && fallbackText2 !== fallbackText
            ? [fallbackText, fallbackText2]
            : [fallbackText];
        var f = 0;
        while (items.length < MIN_TICKER_ITEMS) {
            items.push(fallbacks[f % fallbacks.length]);
            f++;
        }
        return items;
    }

    function refreshTickerItems(now) {
        var key = dateKey(now);
        if (key === tickerItemsDateKey) return;
        tickerItems = buildTickerItems(now);
        tickerItemsDateKey = key;
        shownIndex = -1;
    }

    /** Forces a rebuild after any sheet loads or the date rolls over. */
    function invalidateTickerItems() {
        tickerItemsDateKey = null;
    }

    // --- Ticker rendering (the split-flap) ----------------------------------

    function setFlapText(role, text) {
        var el = root.querySelector('[data-flap="' + role + '"]');
        if (!el) return;
        el.textContent = text;
        // Per-span, not per-band: mid-flip the outgoing and incoming halves
        // hold different strings and may want different sizes.
        el.style.fontSize = fitSizeFor(text);
    }

    function showTickerText(text, animate) {
        var flap = root.querySelector('.rc-flap');
        if (!flap || text === shownText) return;

        if (!animate || shownText === null) {
            shownText = text;
            setFlapText('top-next', text);
            setFlapText('bottom-current', text);
            setFlapText('front-current', text);
            setFlapText('back-next', text);
            return;
        }

        // Front flap shows what is leaving, back flap what is arriving.
        setFlapText('front-current', shownText);
        setFlapText('bottom-current', shownText);
        setFlapText('top-next', text);
        setFlapText('back-next', text);

        flap.classList.remove('rc-flipping');
        void flap.offsetWidth;            // restart the transition
        flap.classList.add('rc-flipping');

        shownText = text;
        setTimeout(function () {
            flap.classList.remove('rc-flipping');
            setFlapText('bottom-current', text);
            setFlapText('front-current', text);
        }, 520);
    }

    function updateTicker(now) {
        refreshTickerItems(now);
        if (!tickerItems.length) return;
        // Wall-clock derived, so every page showing this column flips to the
        // same item at the same instant.
        var index = Math.floor(now.getTime() / ROTATE_MS) % tickerItems.length;
        if (index === shownIndex) return;
        var first = shownIndex === -1;
        shownIndex = index;
        showTickerText(tickerItems[index], !first);
    }

    // --- House scores -------------------------------------------------------

    function applyHousesSheetUrl(url) {
        var normalized = (url || '').trim();
        if (normalized === currentHousesUrl) return;
        currentHousesUrl = normalized;
        if (housesFetchTimer) { clearInterval(housesFetchTimer); housesFetchTimer = null; }
        if (!normalized) return;
        fetchHouseScores();
        housesFetchTimer = setInterval(fetchHouseScores, SCORES_REFRESH_MS);
    }

    /**
     * Row 1 headers, row 2 scores, columns A-D in HOUSE_ORDER. Auto-ranks by
     * score descending using CSS `order`, so the DOM stays put and only the
     * visual order moves. Blank or unparseable scores sort to the bottom.
     */
    async function fetchHouseScores() {
        if (!currentHousesUrl) return;
        try {
            var rows = await fetchCsv(currentHousesUrl);
            if (rows.length < 2) {
                console.warn('[rc/scores] CSV has fewer than 2 rows; expected header + scores');
                return;
            }
            var scores = rows[1].map(function (s) { return s.trim(); });
            var ranked = HOUSE_ORDER.map(function (house, i) {
                var raw = scores[i];
                var parsed = (raw !== undefined && raw !== '') ? parseInt(raw, 10) : NaN;
                return { house: house, raw: raw, numeric: isNaN(parsed) ? null : parsed };
            });
            ranked.sort(function (a, b) {
                if (a.numeric === null && b.numeric === null) return 0;
                if (a.numeric === null) return 1;
                if (b.numeric === null) return -1;
                return b.numeric - a.numeric;
            });
            ranked.forEach(function (entry, rank) {
                var card = root.querySelector('.house-' + entry.house);
                if (card) card.style.order = rank;
                var scoreEl = root.querySelector('#score-' + entry.house);
                if (scoreEl && entry.raw !== undefined && entry.raw !== '') {
                    scoreEl.textContent = entry.numeric !== null
                        ? entry.numeric.toLocaleString()
                        : entry.raw;
                }
            });
        } catch (err) {
            console.warn('[rc/scores] fetch failed (will retry next interval):', err);
        }
    }

    // --- Ticker sheets ------------------------------------------------------

    /**
     * v1.1.0: says out loud how many rows came back and how many survived
     * parsing. An unparseable row is dropped silently — a date typed as
     * "9/4" with no year, a tab that was never actually published — and a TV
     * in a hallway cannot report that. This is the line to look for from a
     * desk: "10 rows, 10 parsed" is healthy, anything DROPPED is not.
     */
    function logLoad(label, fetched, kept) {
        var dropped = fetched - kept;
        if (dropped > 0) {
            console.warn('[rc/ticker] ' + label + ': ' + fetched + ' rows, ' + kept +
                ' parsed, ' + dropped + ' DROPPED — check the date format (YYYY-MM-DD) ' +
                'and that every row has all its columns');
        } else {
            console.info('[rc/ticker] ' + label + ': ' + fetched + ' rows, ' + kept + ' parsed');
        }
    }

    /** Shared by the student and faculty feeds — identical shape. */
    async function loadBirthdayFeed(url, label) {
        if (!url) return [];
        try {
            var rows = stripHeader(await fetchCsv(url), function (r) {
                return normalizeMonthDay(r[1]) !== null;
            });
            var parsed = rows.map(function (r) {
                return { name: (r[0] || '').trim(), monthday: normalizeMonthDay(r[1]) };
            }).filter(function (b) { return b.name && b.monthday; });
            logLoad(label, rows.length, parsed.length);
            return parsed;
        } catch (err) {
            console.warn('[rc/ticker] ' + label + ' fetch failed:', err);
            return null;   // null = leave whatever we had; [] = deliberately empty
        }
    }

    async function loadBirthdays(url) {
        if (!url) { birthdays = []; invalidateTickerItems(); return; }
        var loaded = await loadBirthdayFeed(url, 'student birthdays');
        if (loaded) birthdays = loaded;
        invalidateTickerItems();
    }

    async function loadFacultyBirthdays(url) {
        if (!url) { facultyBirthdays = []; invalidateTickerItems(); return; }
        var loaded = await loadBirthdayFeed(url, 'faculty birthdays');
        if (loaded) facultyBirthdays = loaded;
        invalidateTickerItems();
    }

    async function loadClosures(url) {
        if (!url) { closures = []; invalidateTickerItems(); return; }
        try {
            var rows = stripHeader(await fetchCsv(url), function (r) {
                return parseSheetDate(r[0]) !== null;
            });
            closures = rows.map(function (r) {
                var start = parseSheetDate(r[0]);
                if (!start) return null;
                var end = parseSheetDate(r[1]) || start;   // blank end = single day
                if (end.getTime() < start.getTime()) end = start;
                return { start: start, end: end, label: (r[2] || '').trim() };
            }).filter(Boolean);
            logLoad('closures', rows.length, closures.length);
        } catch (err) {
            console.warn('[rc/ticker] closures sheet fetch failed:', err);
        }
        invalidateTickerItems();
    }

    async function loadHolidays(url) {
        if (!url) { holidays = []; invalidateTickerItems(); return; }
        try {
            var rows = stripHeader(await fetchCsv(url), function (r) {
                return normalizeMonthDay(r[0]) !== null;
            });
            // v1.3.0: month/day, name, context (optional), no-Happy (optional —
            // anything at all in column D means "show the name as written").
            holidays = rows.map(function (r) {
                return {
                    monthday: normalizeMonthDay(r[0]),
                    name: (r[1] || '').trim(),
                    context: (r[2] || '').trim(),
                    noHappy: (r[3] || '').trim() !== ''
                };
            }).filter(function (h) { return h.monthday && h.name; });
            logLoad('holidays', rows.length, holidays.length);
        } catch (err) {
            console.warn('[rc/ticker] holidays sheet fetch failed:', err);
        }
        invalidateTickerItems();
    }

    function applyTickerUrls(data) {
        var next = {
            birthdays: (data.birthdaysSheetCsvUrl || '').trim(),
            faculty: (data.facultyBirthdaysSheetCsvUrl || '').trim(),
            closures: (data.closuresSheetCsvUrl || '').trim(),
            holidays: (data.holidaysSheetCsvUrl || '').trim()
        };
        if (next.birthdays !== sheetUrls.birthdays) { sheetUrls.birthdays = next.birthdays; loadBirthdays(next.birthdays); }
        if (next.faculty !== sheetUrls.faculty) { sheetUrls.faculty = next.faculty; loadFacultyBirthdays(next.faculty); }
        if (next.closures !== sheetUrls.closures) { sheetUrls.closures = next.closures; loadClosures(next.closures); }
        if (next.holidays !== sheetUrls.holidays) { sheetUrls.holidays = next.holidays; loadHolidays(next.holidays); }

        var nextFallback = (data.tickerFallbackText || '').trim() || DEFAULT_FALLBACK_TEXT;
        if (nextFallback !== fallbackText) { fallbackText = nextFallback; invalidateTickerItems(); }

        var nextFallback2 = (data.tickerFallbackText2 || '').trim() || DEFAULT_FALLBACK_TEXT_2;
        if (nextFallback2 !== fallbackText2) { fallbackText2 = nextFallback2; invalidateTickerItems(); }
    }

    // --- Clock --------------------------------------------------------------

    function updateClock(now) {
        var hours = now.getHours();
        var ampm = hours >= 12 ? 'pm' : 'am';
        var displayHours = hours % 12 || 12;
        var clockEl = root.querySelector('#main-clock');
        if (clockEl) {
            clockEl.textContent = displayHours + ':' + pad2(now.getMinutes()) +
                ':' + pad2(now.getSeconds()) + ' ' + ampm;
        }

        var columns = root.querySelectorAll('.schedule-column');
        var ids = [scheduleConfig.s1, scheduleConfig.s2, scheduleConfig.s3];
        var labels = [scheduleConfig.l1, scheduleConfig.l2, scheduleConfig.l3];

        ids.forEach(function (scheduleId, index) {
            if (!scheduleId || !schedules[scheduleId] || !columns[index]) return;
            var schedule = schedules[scheduleId];
            var status = global.SignageScheduleUtils.getScheduleStatus(schedule);
            var periodEl = columns[index].querySelector('.column-period');
            columns[index].querySelector('.column-label').textContent =
                labels[index] || schedule.name || '';
            periodEl.textContent = status.period;
            columns[index].querySelector('.column-countdown').textContent = status.countdown;
            periodEl.classList.toggle('active', status.active);
        });
    }

    function loadSchedules(config) {
        [config.s1, config.s2, config.s3].filter(Boolean).forEach(function (id) {
            db.collection('artifacts').doc(appId)
                .collection('public').doc('data')
                .collection('schedules').doc(id)
                .onSnapshot(function (snapshot) {
                    if (!snapshot.exists) return;
                    // Shared record: resolves relative bells and applies today's
                    // emergency shift at read time.
                    schedules[id] = global.SignageScheduleUtils.makeScheduleRecord(snapshot.data());
                    tick();
                });
        });
    }

    // --- Markup -------------------------------------------------------------

    function buildMarkup() {
        var houseCards = HOUSE_ORDER.map(function (house) {
            return '' +
                '<div class="house-card house-' + house + '" data-house="' + house + '">' +
                    '<img class="house-crest" src="' + house + '.png" alt="' + HOUSE_LABELS[house] + ' crest">' +
                    '<div class="house-info">' +
                        '<div class="house-name">' + HOUSE_LABELS[house] + '</div>' +
                        '<div class="house-score" id="score-' + house + '">—</div>' +
                    '</div>' +
                '</div>';
        }).join('');

        var scheduleCells = '';
        for (var i = 0; i < 3; i++) {
            scheduleCells +=
                '<div class="schedule-column">' +
                    '<div class="column-label">--</div>' +
                    '<div class="column-period">--</div>' +
                    '<div class="column-countdown"></div>' +
                '</div>';
        }

        return '' +
            '<div class="rc-column">' +
                '<div class="rc-ticker">' +
                    '<div class="rc-flap">' +
                        '<div class="rc-flap-half rc-flap-top"><span data-flap="top-next"></span></div>' +
                        '<div class="rc-flap-half rc-flap-bottom"><span data-flap="bottom-current"></span></div>' +
                        '<div class="rc-flap-half rc-flap-top rc-flap-front"><span data-flap="front-current"></span></div>' +
                        '<div class="rc-flap-half rc-flap-bottom rc-flap-back"><span data-flap="back-next"></span></div>' +
                    '</div>' +
                '</div>' +
                '<div class="houses-area" id="houses-area">' + houseCards + '</div>' +
                '<div class="clock-area">' +
                    '<div id="main-clock">--:--:-- --</div>' +
                    '<div id="schedule-columns">' + scheduleCells + '</div>' +
                '</div>' +
            '</div>';
    }

    // --- Tick ---------------------------------------------------------------

    function tick() {
        var now = new Date();
        updateClock(now);
        updateTicker(now);
    }

    // --- Init ---------------------------------------------------------------

    function init(options) {
        if (!global.SignageScheduleUtils) {
            throw new Error('schedule-utils.js must load before right-column.js');
        }
        db = options.db;
        appId = options.appId;
        root = options.mount;
        scheduleConfigOverride = options.scheduleConfigOverride || null;

        if (!root) throw new Error('right-column.js: no mount element given');

        root.innerHTML = buildMarkup();

        if (scheduleConfigOverride) {
            scheduleConfig = scheduleConfigOverride;
            loadSchedules(scheduleConfig);
        }

        db.collection('artifacts').doc(appId)
            .collection('public').doc('data')
            .collection('config').doc('dashboard')
            .onSnapshot(function (doc) {
                if (!doc.exists) {
                    console.warn('[rc] dashboard config doc does not exist');
                    return;
                }
                var data = doc.data() || {};
                if (!scheduleConfigOverride) {
                    scheduleConfig = {
                        s1: data.s1 || null, s2: data.s2 || null, s3: data.s3 || null,
                        l1: data.l1 || '', l2: data.l2 || '', l3: data.l3 || ''
                    };
                    loadSchedules(scheduleConfig);
                }
                applyHousesSheetUrl(data.housesSheetCsvUrl || '');
                applyTickerUrls(data);
                tick();
            }, function (err) {
                console.error('[rc] config listener error:', err);
            });

        setInterval(tick, 1000);
        // The ticker flips on its own cadence, not the clock's: at 5s a card a
        // 1s tick would be up to a second late every time.
        setInterval(function () { updateTicker(new Date()); }, 250);
        tick();
    }

    var SignageRightColumn = {
        VERSION: '1.4.0',
        init: init,
        // Exposed for the Node tests in tests/right-column.test.mjs — these are
        // the pure parts, and they are where the real logic lives.
        _internals: {
            parseCsv: parseCsv,
            parseSheetDate: parseSheetDate,
            normalizeMonthDay: normalizeMonthDay,
            balancedChunks: balancedChunks,
            leadSchoolDaysBefore: leadSchoolDaysBefore,
            upcomingClosureRuns: upcomingClosureRuns,
            buildTickerItems: buildTickerItems,
            isSchoolDay: isSchoolDay,
            fitSizeFor: fitSizeFor,
            headlineFor: headlineFor,
            setData: function (b, c, h, f, fac, f2) {
                // Test fixtures may use the pre-1.3.0 {monthday, text} shape;
                // normalise so they read as a name with no context.
                h = (h || []).map(function (e) {
                    return {
                        monthday: e.monthday,
                        name: e.name || e.text,
                        context: e.context || '',
                        noHappy: !!e.noHappy
                    };
                });
                birthdays = b || [];
                facultyBirthdays = fac || [];
                fallbackText2 = f2 || DEFAULT_FALLBACK_TEXT_2;
                closures = c || [];
                holidays = h || [];
                if (f) fallbackText = f;
                invalidateTickerItems();
            }
        }
    };

    global.SignageRightColumn = SignageRightColumn;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SignageRightColumn;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
