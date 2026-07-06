/*

* Czech Liturgical Calendar
*
* JavaScript reimplementation/port derived from calendarium-romanum
* by Jakub Pavlík and contributors.
*
* calendarium-romanum is dual-licensed under MIT or GNU LGPL-3.0.
* This JavaScript implementation is distributed under the MIT License.
*
* Calendar data: czech-cs.txt, "Český národní kalendář",
* derived from calendarium-romanum/data/czech-cs.txt.

*/

(function(root){
'use strict';


const MS_PER_DAY = 86_400_000;
const WEEK = 7;

const WEEKDAY = [
  'Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'
];

const COLOUR = {
  green: 'zelená',
  violet: 'fialová',
  white: 'bílá',
  red: 'červená',
};

const SEASON = {
  ADVENT: { id: 'advent', colour: 'violet', title: 'Doba adventní' },
  CHRISTMAS: { id: 'christmas', colour: 'white', title: 'Doba vánoční' },
  LENT: { id: 'lent', colour: 'violet', title: 'Doba postní' },
  TRIDUUM: { id: 'triduum', colour: null, title: 'Velikonoční triduum' },
  EASTER: { id: 'easter', colour: 'white', title: 'Doba velikonoční' },
  ORDINARY: { id: 'ordinary', colour: 'green', title: 'Liturgické mezidobí' },
};

const RANK = {
  TRIDUUM:             { num: 1.1, code: '1_1', short: 'triduum', title: 'Velikonoční triduum' },
  PRIMARY:             { num: 1.2, code: '1_2', short: 'primární den', title: 'Primární liturgické dny' },
  SOLEMNITY_GENERAL:   { num: 1.3, code: '1_3', short: 'slavnost', title: 'Slavnosti zapsané ve všeobecném kalendáři' },
  SOLEMNITY_PROPER:    { num: 1.4, code: '1_4', short: 'slavnost', title: 'Vlastní slavnosti' },
  FEAST_LORD_GENERAL:  { num: 2.5, code: '2_5', short: 'svátek', title: 'Svátky Páně zapsané ve všeobecném kalendáři' },
  SUNDAY_UNPRIVILEGED: { num: 2.6, code: '2_6', short: 'neděle', title: 'Neprivilegované neděle' },
  FEAST_GENERAL:       { num: 2.7, code: '2_7', short: 'svátek', title: 'Svátky svatých zapsané ve všeobecném kalendáři' },
  FEAST_PROPER:        { num: 2.8, code: '2_8', short: 'svátek', title: 'Vlastní svátky' },
  FERIAL_PRIVILEGED:   { num: 2.9, code: '2_9', short: 'ferie', title: 'Privilegované ferie' },
  MEMORIAL_GENERAL:    { num: 3.10, code: '3_10', short: 'památka', title: 'Závazné památky všeobecného kalendáře' },
  MEMORIAL_PROPER:     { num: 3.11, code: '3_11', short: 'památka', title: 'Vlastní závazné památky' },
  MEMORIAL_OPTIONAL:   { num: 3.12, code: '3_12', short: 'nezávazná památka', title: 'Nezávazné památky' },
  FERIAL:              { num: 3.13, code: '3_13', short: 'ferie', title: 'Ferie' },
  COMMEMORATION:       { num: 4.0, code: '4_0', short: 'připomínka', title: 'Připomínky' },
};

function rankByNum(num) {
  const found = Object.values(RANK).find((r) => Math.abs(r.num - num) < 0.0001);
  if (!found) throw new Error(`Unsupported rank number ${num}`);
  return found;
}

function rankHigher(a, b) { return a.num < b.num; }
function rankAtLeast(a, b) { return a.num <= b.num; }
function isSolemnity(rank) { return Math.floor(rank.num) === 1; }
function isFeast(rank) { return Math.floor(rank.num) === 2; }
function isMemorial(rank) { return Math.floor(rank.num) === 3 && rank.num <= 3.12; }
function isOptionalMemorial(rank) { return rank === RANK.MEMORIAL_OPTIONAL; }

function dateUtc(year, month, day) { return new Date(Date.UTC(year, month - 1, day)); }
function cloneDate(d) { return new Date(d.getTime()); }
function addDays(d, days) { return new Date(d.getTime() + days * MS_PER_DAY); }
function diffDays(a, b) { return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY); }
function y(d) { return d.getUTCFullYear(); }
function m(d) { return d.getUTCMonth() + 1; }
function dom(d) { return d.getUTCDate(); }
function wday(d) { return d.getUTCDay(); }
function iso(d) { return d.toISOString().slice(0, 10); }
function sameDate(a, b) { return a.getTime() === b.getTime(); }
function dateLess(a, b) { return a.getTime() < b.getTime(); }
function dateLessEq(a, b) { return a.getTime() <= b.getTime(); }
function inRangeInclusive(d, start, end) { return dateLessEq(start, d) && dateLessEq(d, end); }
function ordinal(n) { return `${n}.`; }

function weekdayBefore(weekday, date) {
  const wd = wday(date);
  if (wd === weekday) return addDays(date, -WEEK);
  if (weekday < wd) return addDays(date, -(wd - weekday));
  return addDays(date, -(wd + WEEK - weekday));
}
function weekdayAfter(weekday, date) {
  const wd = wday(date);
  if (wd === weekday) return addDays(date, WEEK);
  if (weekday > wd) return addDays(date, weekday - wd);
  return addDays(date, WEEK - wd + weekday);
}
const sundayBefore = (date) => weekdayBefore(0, date);
const sundayAfter = (date) => weekdayAfter(0, date);
const octaveOf = (date) => addDays(date, WEEK);

function easterSunday(civilYear) {
  // Gregorian computus used by calendarium-romanum's Temporale::Dates.
  const goldenNumber = (civilYear % 19) + 1;
  let dominicalNumber = (civilYear + Math.floor(civilYear / 4) - Math.floor(civilYear / 100) + Math.floor(civilYear / 400)) % 7;
  const solarCorrection = Math.floor((civilYear - 1600) / 100) - Math.floor((civilYear - 1600) / 400);
  const lunarCorrection = Math.floor(Math.floor((civilYear - 1400) / 100) * 8 / 25);
  let paschalFullMoon = (3 - 11 * goldenNumber + solarCorrection - lunarCorrection) % 30;
  while (dominicalNumber <= 0) dominicalNumber += 7;
  while (paschalFullMoon <= 0) paschalFullMoon += 30;
  if (paschalFullMoon === 29 || (paschalFullMoon === 28 && goldenNumber > 11)) paschalFullMoon -= 1;
  let difference = (4 - paschalFullMoon - dominicalNumber) % 7;
  if (difference < 0) difference += 7;
  const dayEaster = paschalFullMoon + difference + 1;
  return dayEaster < 11 ? dateUtc(civilYear, 3, dayEaster + 21) : dateUtc(civilYear, 4, dayEaster - 10);
}

class Celebration {
  constructor({ title, rank, colour = 'white', symbol = null, date = null, cycle = null, sunday = false, source = null }) {
    this.title = title;
    this.rank = rank;
    this.colour = colour;
    this.symbol = symbol;
    this.date = date;
    this.cycle = cycle;
    this.sunday = sunday;
    this.source = source;
  }
  change(patch) {
    return new Celebration({
      title: this.title,
      rank: this.rank,
      colour: this.colour,
      symbol: this.symbol,
      date: this.date ? cloneDate(this.date) : null,
      cycle: this.cycle,
      sunday: this.sunday,
      source: this.source,
      ...patch,
    });
  }
  toApiObject(index = 0) {
    return {
      Id: this.symbol || `generated_${index}`,
      Title: this.title,
      Colour: this.colour,
      ColourName: COLOUR[this.colour] || this.colour,
      Rank: this.rank.short,
      RankTitle: this.rank.title,
      RankNum: this.rank.num,
      Symbol: this.symbol,
      Cycle: this.cycle,
      Sunday: !!this.sunday,
      Source: this.source,
    };
  }
}

class TemporaleDates {
  static firstAdventSunday(liturgicalYear) {
    return addDays(sundayBefore(dateUtc(liturgicalYear, 12, 25)), -3 * WEEK);
  }
  static nativity(liturgicalYear) { return dateUtc(liturgicalYear, 12, 25); }
  static holyFamily(liturgicalYear) {
    const xmas = this.nativity(liturgicalYear);
    return wday(xmas) === 0 ? dateUtc(liturgicalYear, 12, 30) : sundayAfter(xmas);
  }
  static motherOfGod(liturgicalYear) { return octaveOf(this.nativity(liturgicalYear)); }
  static epiphany(liturgicalYear, { sunday = false } = {}) {
    if (sunday) return sundayAfter(dateUtc(liturgicalYear + 1, 1, 1));
    return dateUtc(liturgicalYear + 1, 1, 6);
  }
  static baptismOfLord(liturgicalYear, { epiphanyOnSunday = false } = {}) {
    const e = this.epiphany(liturgicalYear, { sunday: epiphanyOnSunday });
    return dom(e) > 6 ? addDays(e, 1) : sundayAfter(e);
  }
  static easterSunday(liturgicalYear) { return easterSunday(liturgicalYear + 1); }
  static ashWednesday(liturgicalYear) { return addDays(this.easterSunday(liturgicalYear), -(6 * WEEK + 4)); }
  static palmSunday(liturgicalYear) { return addDays(this.easterSunday(liturgicalYear), -WEEK); }
  static goodFriday(liturgicalYear) { return addDays(this.easterSunday(liturgicalYear), -2); }
  static holySaturday(liturgicalYear) { return addDays(this.easterSunday(liturgicalYear), -1); }
  static ascension(liturgicalYear, { sunday = false } = {}) {
    return sunday ? addDays(this.easterSunday(liturgicalYear), 6 * WEEK) : addDays(this.pentecost(liturgicalYear), -10);
  }
  static pentecost(liturgicalYear) { return addDays(this.easterSunday(liturgicalYear), 7 * WEEK); }
  static holyTrinity(liturgicalYear) { return octaveOf(this.pentecost(liturgicalYear)); }
  static corpusChristi(liturgicalYear, { sunday = false } = {}) {
    return sunday ? addDays(this.holyTrinity(liturgicalYear), WEEK) : addDays(this.holyTrinity(liturgicalYear), 4);
  }
  static sacredHeart(liturgicalYear) { return addDays(this.corpusChristi(liturgicalYear), 8); }
  static motherOfChurch(liturgicalYear) { return addDays(this.pentecost(liturgicalYear), 1); }
  static immaculateHeart(liturgicalYear) { return addDays(this.pentecost(liturgicalYear), 20); }
  static christKing(liturgicalYear) { return addDays(this.firstAdventSunday(liturgicalYear + 1), -WEEK); }
  static christEternalPriest(liturgicalYear) { return addDays(this.pentecost(liturgicalYear), 4); }
}

const TEMPORALE_TITLES = {
  nativity: 'Narození Páně',
  holy_family: 'Svaté rodiny Ježíše, Marie a Josefa',
  mother_of_god: 'Oktáv Narození Páně. Matky Boží, Panny Marie',
  epiphany: 'Zjevení Páně',
  baptism_of_lord: 'Křtu Páně',
  ash_wednesday: 'Popeleční středa',
  palm_sunday: 'Květná neděle',
  good_friday: 'Velký pátek',
  holy_saturday: 'Bílá sobota',
  easter_sunday: 'Zmrtvýchvstání Páně',
  ascension: 'Nanebevstoupení Páně',
  pentecost: 'Seslání Ducha svatého',
  holy_trinity: 'Nejsvětější Trojice',
  corpus_christi: 'Těla a krve Páně',
  sacred_heart: 'Nejsvětějšího Srdce Ježíšova',
  mother_of_church: 'Panny Marie, Matky církve',
  immaculate_heart: 'Neposkvrněného Srdce Panny Marie',
  christ_king: 'Ježíše Krista krále',
  saturday_memorial_bvm: 'Sobotní památka Panny Marie',
  christ_eternal_priest: 'Ježíše Krista, nejvyššího a věčného kněze',
};

function tempCelebration(symbol, rank, colour = 'white', sunday = false) {
  return new Celebration({
    title: TEMPORALE_TITLES[symbol],
    rank,
    colour,
    symbol,
    cycle: 'temporale',
    sunday,
    source: 'temporale',
  });
}

class Temporale {
  constructor(liturgicalYear, options = {}) {
    this.year = liturgicalYear;
    this.transferToSunday = new Set(options.transferToSunday || []);
    this.solemnities = new Map();
    this.feasts = new Map();
    this.memorials = new Map();
    this.prepare();
  }

  static liturgicalYear(date) {
    const civilYear = y(date);
    return dateLess(date, TemporaleDates.firstAdventSunday(civilYear)) ? civilYear - 1 : civilYear;
  }

  static lectionaryYear(date) {
    // calendarium-romanum internally names the year by the Advent that starts it.
    // The public lectionary/liturgical cycle is usually named by the following civil year:
    // Advent 2025 through Christ the King 2026 => lectionary/liturgical year 2026, cycle A, weekday cycle 2.
    return Temporale.liturgicalYear(date) + 1;
  }

  static sundayCycleForYear(year) {
    const mod = year % 3;
    return mod === 1 ? 'A' : mod === 2 ? 'B' : 'C';
  }

  static sundayCycle(date) {
    return Temporale.sundayCycleForYear(Temporale.lectionaryYear(date));
  }

  static weekdayCycleForYear(year) {
    return year % 2 === 0 ? 2 : 1;
  }

  static weekdayCycle(date) {
    return Temporale.weekdayCycleForYear(Temporale.lectionaryYear(date));
  }

  startDate() { return TemporaleDates.firstAdventSunday(this.year); }
  endDate() { return addDays(TemporaleDates.firstAdventSunday(this.year + 1), -1); }
  inYear(date) { return inRangeInclusive(date, this.startDate(), this.endDate()); }

  dateMethod(symbol) {
    const map = {
      nativity: (year) => TemporaleDates.nativity(year),
      holy_family: (year) => TemporaleDates.holyFamily(year),
      mother_of_god: (year) => TemporaleDates.motherOfGod(year),
      epiphany: (year) => TemporaleDates.epiphany(year, { sunday: this.transferToSunday.has('epiphany') }),
      baptism_of_lord: (year) => TemporaleDates.baptismOfLord(year, { epiphanyOnSunday: this.transferToSunday.has('epiphany') }),
      ash_wednesday: (year) => TemporaleDates.ashWednesday(year),
      good_friday: (year) => TemporaleDates.goodFriday(year),
      holy_saturday: (year) => TemporaleDates.holySaturday(year),
      palm_sunday: (year) => TemporaleDates.palmSunday(year),
      easter_sunday: (year) => TemporaleDates.easterSunday(year),
      ascension: (year) => TemporaleDates.ascension(year, { sunday: this.transferToSunday.has('ascension') }),
      pentecost: (year) => TemporaleDates.pentecost(year),
      holy_trinity: (year) => TemporaleDates.holyTrinity(year),
      corpus_christi: (year) => TemporaleDates.corpusChristi(year, { sunday: this.transferToSunday.has('corpus_christi') }),
      sacred_heart: (year) => TemporaleDates.sacredHeart(year),
      mother_of_church: (year) => TemporaleDates.motherOfChurch(year),
      immaculate_heart: (year) => TemporaleDates.immaculateHeart(year),
      christ_king: (year) => TemporaleDates.christKing(year),
      christ_eternal_priest: (year) => TemporaleDates.christEternalPriest(year),
    };
    return map[symbol](this.year);
  }

  addPrepared(date, celebration) {
    const collection = isFeast(celebration.rank) ? this.feasts : isMemorial(celebration.rank) ? this.memorials : this.solemnities;
    collection.set(iso(date), celebration);
  }

  prepare() {
    const defs = [
      ['nativity', RANK.PRIMARY, 'white'],
      ['holy_family', RANK.FEAST_LORD_GENERAL, 'white'],
      ['mother_of_god', RANK.SOLEMNITY_GENERAL, 'white'],
      ['epiphany', RANK.PRIMARY, 'white'],
      ['baptism_of_lord', RANK.FEAST_LORD_GENERAL, 'white'],
      ['ash_wednesday', RANK.PRIMARY, 'violet'],
      ['good_friday', RANK.TRIDUUM, 'red'],
      ['holy_saturday', RANK.TRIDUUM, 'violet'],
      ['palm_sunday', RANK.PRIMARY, 'red', true],
      ['easter_sunday', RANK.TRIDUUM, 'white'],
      ['ascension', RANK.PRIMARY, 'white'],
      ['pentecost', RANK.PRIMARY, 'red'],
      ['holy_trinity', RANK.SOLEMNITY_GENERAL, 'white'],
      ['corpus_christi', RANK.SOLEMNITY_GENERAL, 'white'],
      ['mother_of_church', RANK.MEMORIAL_GENERAL, 'white'],
      ['sacred_heart', RANK.SOLEMNITY_GENERAL, 'white'],
      ['christ_king', RANK.SOLEMNITY_GENERAL, 'white'],
      ['immaculate_heart', RANK.MEMORIAL_GENERAL, 'white'],
      // Czech calendar in Church Calendar API enables this extension.
      ['christ_eternal_priest', RANK.FEAST_PROPER, 'white'],
    ];
    for (const [symbol, rank, colour, sunday = false] of defs) {
      this.addPrepared(this.dateMethod(symbol), tempCelebration(symbol, rank, colour, sunday));
    }
  }

  season(date) {
    if (dateLessEq(this.startDate(), date) && dateLess(date, TemporaleDates.nativity(this.year))) return SEASON.ADVENT;
    if (dateLessEq(TemporaleDates.nativity(this.year), date) && dateLessEq(date, this.dateMethod('baptism_of_lord'))) return SEASON.CHRISTMAS;
    if (dateLessEq(this.dateMethod('ash_wednesday'), date) && dateLess(date, this.dateMethod('good_friday'))) return SEASON.LENT;
    if (dateLessEq(this.dateMethod('good_friday'), date) && dateLessEq(date, this.dateMethod('easter_sunday'))) return SEASON.TRIDUUM;
    if (dateLess(this.dateMethod('easter_sunday'), date) && dateLessEq(date, this.dateMethod('pentecost'))) return SEASON.EASTER;
    return SEASON.ORDINARY;
  }

  seasonBeginning(season) {
    switch (season) {
      case SEASON.ADVENT: return this.startDate();
      case SEASON.CHRISTMAS: return TemporaleDates.nativity(this.year);
      case SEASON.LENT: return this.dateMethod('ash_wednesday');
      case SEASON.TRIDUUM: return this.dateMethod('good_friday');
      case SEASON.EASTER: return addDays(this.dateMethod('easter_sunday'), 1);
      case SEASON.ORDINARY: return addDays(this.dateMethod('baptism_of_lord'), 1);
      default: throw new Error(`Unsupported season ${season && season.id}`);
    }
  }

  seasonWeek(season, date) {
    const beginning = this.seasonBeginning(season);
    const week1Beginning = wday(beginning) === 0 ? beginning : sundayAfter(beginning);
    let week = Math.floor(diffDays(date, week1Beginning) / WEEK) + 1;
    if (season === SEASON.ORDINARY || season === SEASON.EASTER) week += 1;
    if (season === SEASON.ORDINARY && dateLess(this.dateMethod('pentecost'), date)) {
      const weeksAfterDate = Math.floor(diffDays(TemporaleDates.firstAdventSunday(this.year + 1), date) / WEEK);
      week = 34 - weeksAfterDate;
      if (wday(date) === 0) week += 1;
    }
    return week;
  }

  get(date) {
    const key = iso(date);
    return this.solemnities.get(key) || this.feasts.get(key) || this.sunday(date) || this.memorials.get(key) || this.ferial(date);
  }

  sunday(date) {
    if (wday(date) !== 0) return null;
    const s = this.season(date);
    const week = this.seasonWeek(s, date);
    let rank = RANK.SUNDAY_UNPRIVILEGED;
    if ([SEASON.ADVENT, SEASON.LENT, SEASON.EASTER].includes(s)) rank = RANK.PRIMARY;
    let title;
    if (s === SEASON.ORDINARY) title = `${ordinal(week)} neděle v mezidobí`;
    else if (s === SEASON.ADVENT) title = `${ordinal(week)} neděle adventní`;
    else if (s === SEASON.CHRISTMAS) title = `${ordinal(week)} neděle po Narození Páně`;
    else if (s === SEASON.LENT) title = `${ordinal(week)} neděle postní`;
    else if (s === SEASON.EASTER) title = `${ordinal(week)} neděle velikonoční`;
    else title = 'Neděle';
    return new Celebration({ title, rank, colour: s.colour || 'white', cycle: 'temporale', sunday: true, source: 'temporale' });
  }

  ferial(date) {
    const s = this.season(date);
    const week = this.seasonWeek(s, date);
    let rank = RANK.FERIAL;
    let title = null;
    const weekday = WEEKDAY[wday(date)];
    if (s === SEASON.ADVENT && dateLessEq(dateUtc(this.year, 12, 17), date)) {
      rank = RANK.FERIAL_PRIVILEGED;
      title = `${ordinal(dom(date))} prosince`;
    } else if (s === SEASON.CHRISTMAS) {
      if (dateLess(date, this.dateMethod('mother_of_god'))) {
        rank = RANK.FERIAL_PRIVILEGED;
        title = `${ordinal(dom(date) - dom(TemporaleDates.nativity(this.year)) + 1)} den v oktávu Narození Páně`;
      } else if (dateLess(this.dateMethod('epiphany'), date)) {
        title = `${weekday} po Zjevení Páně`;
      }
    } else if (s === SEASON.LENT) {
      if (week === 0) title = `${weekday} po Popeleční středě`;
      else if (dateLess(this.dateMethod('palm_sunday'), date)) {
        rank = RANK.PRIMARY;
        title = `${weekday} Svatého týdne`;
      }
      if (!rankHigher(rank, RANK.FERIAL_PRIVILEGED)) rank = RANK.FERIAL_PRIVILEGED;
    } else if (s === SEASON.EASTER && week === 1) {
      rank = RANK.PRIMARY;
      title = `${weekday} v oktávu velikonočním`;
    }

    if (!title) {
      if (s === SEASON.ORDINARY) title = `${weekday} ${ordinal(week)} týdne v mezidobí`;
      else if (s === SEASON.ADVENT) title = `${weekday} po ${ordinal(week)} neděli adventní`;
      else if (s === SEASON.CHRISTMAS) title = `${weekday} po oktávu Narození Páně`;
      else if (s === SEASON.LENT) title = `${weekday} po ${ordinal(week)} neděli postní`;
      else if (s === SEASON.EASTER) title = `${weekday} po ${ordinal(week)} neděli velikonoční`;
      else title = weekday;
    }
    return new Celebration({ title, rank, colour: s.colour || 'white', cycle: 'temporale', source: 'temporale' });
  }
}

class Sanctorale {
  constructor(entries) {
    this.byMonthDay = new Map();
    for (const entry of entries) this.add(entry);
  }
  add(entry) {
    const key = `${entry.month}/${entry.day}`;
    if (!this.byMonthDay.has(key)) this.byMonthDay.set(key, []);
    this.byMonthDay.get(key).push(new Celebration({
      title: entry.title,
      rank: entry.rank,
      colour: entry.colour,
      symbol: entry.id,
      cycle: 'sanctorale',
      source: 'sanctorale',
    }));
    this.byMonthDay.get(key).sort((a, b) => a.rank.num - b.rank.num);
  }
  get(date) {
    return (this.byMonthDay.get(`${m(date)}/${dom(date)}`) || []).map((c) => c.change({ date }));
  }
  solemnityDatesForLiturgicalYear(liturgicalYear, temporale) {
    const out = [];
    for (const [md, celebrations] of this.byMonthDay.entries()) {
      if (!celebrations.length || !isSolemnity(celebrations[0].rank)) continue;
      const [month, day] = md.split('/').map(Number);
      const dNext = dateUtc(liturgicalYear + 1, month, day);
      const dPrev = dateUtc(liturgicalYear, month, day);
      if (temporale.inYear(dNext)) out.push(dNext);
      else if (temporale.inYear(dPrev)) out.push(dPrev);
    }
    return out.sort((a, b) => a - b);
  }
}

function parseSanctorale(txt) {
  const entries = [];
  let month = null;
  let inFrontMatter = false;
  const lines = txt.replace(/\r/g, '').split('\n');
  for (const originalLine of lines) {
    let line = originalLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    if (line === '---') { inFrontMatter = !inFrontMatter; continue; }
    if (inFrontMatter) continue;
    const monthMatch = line.match(/^=\s*(\d{1,2})\s*$/);
    if (monthMatch) { month = Number(monthMatch[1]); continue; }
    const [leftRaw, ...titleParts] = line.split(':');
    if (!titleParts.length) continue;
    const left = leftRaw.trim();
    const title = titleParts.join(':').trim();
    const tokens = left.split(/\s+/);
    let dayToken = tokens.shift();
    let entryMonth = month;
    let day;
    if (dayToken.includes('/')) {
      const md = dayToken.split('/').map(Number);
      entryMonth = md[0]; day = md[1];
    } else {
      day = Number(dayToken);
    }
    if (!entryMonth || !day) throw new Error(`Invalid sanctorale line: ${originalLine}`);
    let rank = RANK.MEMORIAL_OPTIONAL;
    let colour = 'white';
    let id = null;
    for (const token of tokens) {
      if (/^[RWGV]$/.test(token)) {
        colour = ({ R: 'red', W: 'white', G: 'green', V: 'violet' })[token];
      } else if (/^\d+(?:\.\d+)?$/.test(token)) {
        rank = rankByNum(Number(token));
      } else if (/^[mfs](?:\d+(?:\.\d+)?|[a-z])?$/.test(token)) {
        rank = parseRankCode(token);
      } else {
        id = token;
      }
    }
    entries.push({ month: entryMonth, day, rank, colour, id, title });
  }
  return entries;
}

function parseRankCode(code) {
  if (code === 'm') return RANK.MEMORIAL_GENERAL;
  if (code === 'f') return RANK.FEAST_GENERAL;
  if (code === 's') return RANK.SOLEMNITY_GENERAL;
  if (code === 'mp') return RANK.MEMORIAL_PROPER;
  if (code === 'fp') return RANK.FEAST_PROPER;
  if (code === 'sp') return RANK.SOLEMNITY_PROPER;
  if (code === 'fl') return RANK.FEAST_LORD_GENERAL;
  const numeric = code.match(/^[mfs](\d+(?:\.\d+)?)$/);
  if (numeric) return rankByNum(Number(numeric[1]));
  throw new Error(`Unsupported rank code '${code}'`);
}

// Calendar data source: czech-cs.txt, "Český národní kalendář",
// derived from calendarium-romanum/data/czech-cs.txt.
const CZECH_SANCTORALE_ENTRIES = [
  { month: 1, day: 2, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "basil_gregory", title: "Sv. Basila Velikého a Řehoře Naziánského, biskupů a učitelů církve" },
  { month: 1, day: 3, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "name_jesus", title: "Nejsvětějšího Jména Ježíš" },
  { month: 1, day: 7, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "raymond", title: "Sv. Rajmunda z Peñafortu, kněze" },
  { month: 1, day: 13, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "hilary", title: "Sv. Hilaria, biskupa a učitele církve" },
  { month: 1, day: 17, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "anthony_of_egypt", title: "Sv. Antonína, opata" },
  { month: 1, day: 18, rank: rankByNum(3.11), colour: "white", id: "bvm_unity", title: "Panny Marie, Matky jednoty křesťanů" },
  { month: 1, day: 20, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "fabian", title: "Sv. Fabiána, papeže a mučedníka" },
  { month: 1, day: 20, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "sebastian", title: "Sv. Šebestiána, mučedníka" },
  { month: 1, day: 21, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "agnes", title: "Sv. Anežky Římské, panny a mučednice" },
  { month: 1, day: 22, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "vincent_deacon", title: "Sv. Vincence, jáhna a mučedníka" },
  { month: 1, day: 24, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "francis_de_sales", title: "Sv. Františka Saleského, biskupa a učitele církve" },
  { month: 1, day: 25, rank: RANK.FEAST_GENERAL, colour: "white", id: "paul_conversion", title: "Obrácení svatého Pavla, apoštola" },
  { month: 1, day: 26, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "timothy_titus", title: "Sv. Timoteje a Tita, biskupů" },
  { month: 1, day: 27, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "merici", title: "Sv. Anděly Mericiové, panny" },
  { month: 1, day: 28, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "aquinas", title: "Sv. Tomáše Akvinského, kněze a učitele církve" },
  { month: 1, day: 31, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "bosco", title: "Sv. Jana Boska, kněze" },
  { month: 2, day: 2, rank: rankByNum(2.5), colour: "white", id: "presentation_of_lord", title: "Uvedení Páně do chrámu" },
  { month: 2, day: 3, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "blase", title: "Sv. Blažeje, biskupa a mučedníka" },
  { month: 2, day: 3, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "ansgar", title: "Sv. Ansgara, biskupa" },
  { month: 2, day: 5, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "agatha", title: "Sv. Agáty, panny a mučednice" },
  { month: 2, day: 6, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "paul_miki", title: "Sv. Pavla Mikiho a druhů, mučedníků" },
  { month: 2, day: 8, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "jerome_emiliani", title: "Sv. Jeronýma Emilianiho" },
  { month: 2, day: 8, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "josephine_bakhita", title: "Sv. Josefiny Bakhity, panny" },
  { month: 2, day: 10, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "scholastica", title: "Sv. Scholastiky, panny" },
  { month: 2, day: 11, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "bvm_lourdes", title: "Panny Marie Lurdské" },
  { month: 2, day: 17, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "servite_founders", title: "Sv. Alexia a druhů, řeholníků" },
  { month: 2, day: 21, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "peter_damian", title: "Sv. Petra Damianiho, biskupa a učitele církve" },
  { month: 2, day: 22, rank: RANK.FEAST_GENERAL, colour: "white", id: "chair_of_peter", title: "Stolce svatého Petra, apoštola" },
  { month: 2, day: 23, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "polycarp", title: "Sv. Polykarpa, biskupa a mučedníka" },
  { month: 2, day: 27, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "gregory_of_narek", title: "Sv. Řehoře z Nareku, opata a učitele církve" },
  { month: 3, day: 4, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "casimir", title: "Sv. Kazimíra" },
  { month: 3, day: 7, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "perpetua_felicity", title: "Sv. Perpetuy a Felicity, mučednic" },
  { month: 3, day: 8, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "john_of_god", title: "Sv. Jana z Boha, řeholníka" },
  { month: 3, day: 9, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "frances_of_rome", title: "Sv. Františky Římské, řeholnice" },
  { month: 3, day: 10, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "ogilvie", title: "Sv. Jana Ogilvie, kněze a mučedníka" },
  { month: 3, day: 17, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "patrick", title: "Sv. Patrika, biskupa" },
  { month: 3, day: 18, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "cyril_of_jerusalem", title: "Sv. Cyrila Jeruzalémského, biskupa a učitele církve" },
  { month: 3, day: 19, rank: RANK.SOLEMNITY_GENERAL, colour: "white", id: "joseph", title: "Sv. Josefa, Snoubence Panny Marie" },
  { month: 3, day: 23, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "turibius", title: "Sv. Turibia z Mongroveja, biskupa" },
  { month: 3, day: 25, rank: RANK.SOLEMNITY_GENERAL, colour: "white", id: "annunciation", title: "Zvěstování Páně" },
  { month: 4, day: 2, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "francis_of_paola", title: "Sv. Františka z Pauly, poustevníka" },
  { month: 4, day: 4, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "isidore", title: "Sv. Izidora, biskupa a učitele církve" },
  { month: 4, day: 5, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "vincent_ferrer", title: "Sv. Vincence Ferrerského, kněze" },
  { month: 4, day: 7, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "de_la_salle", title: "Sv. Jana Křtitele de la Salle, kněze" },
  { month: 4, day: 11, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "stanislaus", title: "Sv. Stanislava, biskupa a mučedníka" },
  { month: 4, day: 13, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "martin_i", title: "Sv. Martina I., papeže a mučedníka" },
  { month: 4, day: 21, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "anselm", title: "Sv. Anselma, biskupa a učitele církve" },
  { month: 4, day: 23, rank: rankByNum(2.8), colour: "red", id: "adalbert", title: "Sv. Vojtěcha, biskupa a mučedníka, hlavního patrona pražské arcidiecéze" },
  { month: 4, day: 24, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "george", title: "Sv. Jiří, mučedníka" },
  { month: 4, day: 24, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "fidelis", title: "Sv. Fidela ze Sigmaringy, kněze a mučedníka" },
  { month: 4, day: 25, rank: RANK.FEAST_GENERAL, colour: "red", id: "mark", title: "Sv. Marka, evangelisty" },
  { month: 4, day: 28, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "peter_chanel", title: "Sv. Petra Chanela, kněze a mučedníka" },
  { month: 4, day: 28, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "de_montfort", title: "Sv. Ludvíka Marie Grigniona z Montfortu, kněze" },
  { month: 4, day: 29, rank: RANK.FEAST_GENERAL, colour: "white", id: "catherine_of_siena", title: "Sv. Kateřiny Sienské, panny a učitelky církve, patronky Evropy" },
  { month: 4, day: 30, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "sigismund", title: "Sv. Zikmunda, mučedníka" },
  { month: 4, day: 30, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "pius_v", title: "Sv. Pia V., papeže" },
  { month: 5, day: 1, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "joseph_worker", title: "Sv. Josefa, dělníka" },
  { month: 5, day: 2, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "athanasius", title: "Sv. Atanáše, biskupa a učitele církve" },
  { month: 5, day: 3, rank: RANK.FEAST_GENERAL, colour: "red", id: "philip_james", title: "Sv. Filipa a Jakuba, apoštolů" },
  { month: 5, day: 6, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "sarkander", title: "Sv. Jana Sarkandra, kněze a mučedníka" },
  { month: 5, day: 8, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "bvm_mediatrix", title: "Panny Marie, Prostřednice všech milostí" },
  { month: 5, day: 10, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "john_de_avila", title: "Sv. Jana z Avily, kněze a učitele církve" },
  { month: 5, day: 12, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "nereus_achilleus", title: "Sv. Nerea a Achillea, mučedníků" },
  { month: 5, day: 12, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "pancras", title: "Sv. Pankráce, mučedníka" },
  { month: 5, day: 13, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "bvm_fatima", title: "Panny Marie Fatimské" },
  { month: 5, day: 14, rank: RANK.FEAST_GENERAL, colour: "red", id: "matthias", title: "Sv. Matěje, apoštola" },
  { month: 5, day: 16, rank: rankByNum(2.8), colour: "red", id: "john_nepomuk", title: "Sv. Jana Nepomuckého, kněze a mučedníka, hlavního patrona Čech" },
  { month: 5, day: 18, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "john_i", title: "Sv. Jana I., papeže a mučedníka" },
  { month: 5, day: 20, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "hofbauer", title: "Sv. Klementa Marie Hofbauera, kněze" },
  { month: 5, day: 20, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "bernardine", title: "Sv. Bernardina Sienského, kněze" },
  { month: 5, day: 21, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "magallanes", title: "Sv. Kryštofa Magallanese, kněze, a druhů, mučedníků" },
  { month: 5, day: 22, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "rita", title: "Sv. Rity z Cascie, řeholnice" },
  { month: 5, day: 25, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "bede_venerable", title: "Sv. Bedy Ctihodného, kněze a učitele církve" },
  { month: 5, day: 25, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "gregory_vii", title: "Sv. Řehoře VII., papeže" },
  { month: 5, day: 25, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "de_pazzi", title: "Sv. Marie Magdalény de' Pazzi, panny" },
  { month: 5, day: 26, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "neri", title: "Sv. Filipa Neriho, kněze" },
  { month: 5, day: 27, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "augustine_of_canterbury", title: "Sv. Augustina z Canterbury, biskupa" },
  { month: 5, day: 29, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "paul_vi", title: "Sv. Pavla VI., papeže" },
  { month: 5, day: 30, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "zdislava", title: "Sv. Zdislavy" },
  { month: 5, day: 31, rank: RANK.FEAST_GENERAL, colour: "white", id: "visitation", title: "Navštívení Panny Marie" },
  { month: 6, day: 1, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "justin", title: "Sv. Justina, mučedníka" },
  { month: 6, day: 2, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "marcellinus_peter", title: "Sv. Marcelina a Petra, mučedníků" },
  { month: 6, day: 3, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "ugandan_martyrs", title: "Sv. Karla Lwangy a druhů, mučedníků" },
  { month: 6, day: 5, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "boniface", title: "Sv. Bonifáce, biskupa a mučedníka" },
  { month: 6, day: 6, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "norbert", title: "Sv. Norberta, biskupa" },
  { month: 6, day: 9, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "ephrem", title: "Sv. Efréma Syrského, jáhna a učitele církve" },
  { month: 6, day: 11, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "barnabas", title: "Sv. Barnabáše, apoštola" },
  { month: 6, day: 13, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "anthony_of_padua", title: "Sv. Antonína z Padovy, kněze a učitele církve" },
  { month: 6, day: 15, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "vitus", title: "Sv. Víta, mučedníka" },
  { month: 6, day: 19, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "neumann", title: "Sv. Jana Nepomuckého Neumanna, biskupa" },
  { month: 6, day: 19, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "romuald", title: "Sv. Romualda, opata" },
  { month: 6, day: 21, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "aloysius", title: "Sv. Aloise Gonzagy, řeholníka" },
  { month: 6, day: 22, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "paulinus", title: "Sv. Paulína Nolánského, biskupa" },
  { month: 6, day: 22, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "fisher_more", title: "Sv. Jana Fishera, biskupa a Tomáše Mora, mučedníků" },
  { month: 6, day: 24, rank: RANK.SOLEMNITY_GENERAL, colour: "white", id: "baptist_birth", title: "Narození svatého Jana Křtitele" },
  { month: 6, day: 27, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "cyril_of_alexandria", title: "Sv. Cyrila Alexandrijského, biskupa a učitele církve" },
  { month: 6, day: 28, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "irenaeus", title: "Sv. Ireneje, biskupa a mučedníka" },
  { month: 6, day: 29, rank: RANK.SOLEMNITY_GENERAL, colour: "red", id: "peter_paul", title: "Sv. Petra a Pavla, apoštolů, hlavních patronů brněnské diecéze" },
  { month: 6, day: 30, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "first_martyrs_of_rome", title: "Svatých prvomučedníků římských" },
  { month: 7, day: 3, rank: RANK.FEAST_GENERAL, colour: "red", id: "thomas_apostle", title: "Sv. Tomáše, apoštola" },
  { month: 7, day: 4, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "procopius", title: "Sv. Prokopa, opata" },
  { month: 7, day: 4, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "elizabeth_of_portugal", title: "Sv. Alžběty Portugalské" },
  { month: 7, day: 5, rank: rankByNum(1.4), colour: "white", id: "cyril_methodius", title: "Sv. Cyrila, mnicha, a Metoděje, biskupa, patronů Evropy, hlavních patronů Moravy" },
  { month: 7, day: 6, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "goretti", title: "Sv. Marie Gorettiové, panny a mučednice" },
  { month: 7, day: 9, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "chinese_martyrs", title: "Sv. Augustina Žao Ronga, kněze, a druhů, mučedníků" },
  { month: 7, day: 11, rank: RANK.FEAST_GENERAL, colour: "white", id: "benedict", title: "Sv. Benedikta, opata, patrona Evropy" },
  { month: 7, day: 13, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "henry", title: "Sv. Jindřicha" },
  { month: 7, day: 14, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "hroznata", title: "Bl. Hroznaty, mučedníka" },
  { month: 7, day: 14, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "camillus_de_lellis", title: "Sv. Kamila de Lellis, kněze" },
  { month: 7, day: 15, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "bonaventure", title: "Sv. Bonaventury, biskupa a učitele církve" },
  { month: 7, day: 16, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "bvm_mount_carmel", title: "Panny Marie Karmelské" },
  { month: 7, day: 17, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "ceslaus_hyacinth", title: "Bl. Česlava a sv. Hyacinta, kněží" },
  { month: 7, day: 20, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "apollinaris", title: "Sv. Apolináře, biskupa a mučedníka" },
  { month: 7, day: 21, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "lawrence_of_brindisi", title: "Sv. Vavřince z Brindisi, kněze a učitele církve" },
  { month: 7, day: 22, rank: RANK.FEAST_GENERAL, colour: "white", id: "mary_magdalene", title: "Sv. Marie Magdalény" },
  { month: 7, day: 23, rank: RANK.FEAST_GENERAL, colour: "white", id: "birgitta", title: "Sv. Brigity, řeholnice, patronky Evropy" },
  { month: 7, day: 24, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "sharbel", title: "Sv. Šarbela Makhlufa, kněze" },
  { month: 7, day: 25, rank: RANK.FEAST_GENERAL, colour: "red", id: "james", title: "Sv. Jakuba, apoštola" },
  { month: 7, day: 26, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "joachim_anne", title: "Sv. Jáchyma a Anny, rodičů Panny Marie" },
  { month: 7, day: 27, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "gorazd", title: "Sv. Gorazda a druhů" },
  { month: 7, day: 29, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "martha_mary_lazarus", title: "Sv. Marty, Marie a Lazara" },
  { month: 7, day: 30, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "peter_chrysologus", title: "Sv. Petra Chryzologa, biskupa a učitele církve" },
  { month: 7, day: 31, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "ignatius_of_loyola", title: "Sv. Ignáce z Loyoly, kněze" },
  { month: 8, day: 1, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "alphonsus", title: "Sv. Alfonsa Marie z Liguori, biskupa a učitele církve" },
  { month: 8, day: 2, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "eusebius", title: "Sv. Eusebia z Vercelli, biskupa" },
  { month: 8, day: 2, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "eymard", title: "Sv. Petra Juliána Eymarda, kněze" },
  { month: 8, day: 4, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "vianney", title: "Sv. Jana Marie Vianneye, kněze" },
  { month: 8, day: 5, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "mary_major", title: "Posvěcení římské baziliky Panny Marie" },
  { month: 8, day: 6, rank: rankByNum(2.5), colour: "white", id: "transfiguration", title: "Proměnění Páně" },
  { month: 8, day: 7, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "sixtus_ii", title: "Sv. Sixta II., papeže, a druhů, mučedníků" },
  { month: 8, day: 7, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "cajetan", title: "Sv. Kajetána, kněze" },
  { month: 8, day: 8, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "dominic", title: "Sv. Dominika, kněze" },
  { month: 8, day: 9, rank: RANK.FEAST_GENERAL, colour: "red", id: "stein", title: "Sv. Terezie Benedikty od Kříže, panny a mučednice, patronky Evropy" },
  { month: 8, day: 10, rank: RANK.FEAST_GENERAL, colour: "red", id: "lawrence", title: "Sv. Vavřince, mučedníka" },
  { month: 8, day: 11, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "clare", title: "Sv. Kláry, panny" },
  { month: 8, day: 12, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "de_chantal", title: "Sv. Jany Františky de Chantal, řeholnice" },
  { month: 8, day: 13, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "pontian_hippolytus", title: "Sv. Ponciána, papeže, a Hippolyta, kněze, mučedníků" },
  { month: 8, day: 14, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "kolbe", title: "Sv. Maxmiliána Marie Kolbeho, kněze a mučedníka" },
  { month: 8, day: 15, rank: RANK.SOLEMNITY_GENERAL, colour: "white", id: "assumption", title: "Nanebevzetí Panny Marie" },
  { month: 8, day: 16, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "stephen_hungary", title: "Sv. Štěpána Uherského" },
  { month: 8, day: 19, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "eudes", title: "Sv. Jana Eudese, kněze" },
  { month: 8, day: 20, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "bernard", title: "Sv. Bernarda, opata a učitele církve" },
  { month: 8, day: 21, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "pius_x", title: "Sv. Pia X., papeže" },
  { month: 8, day: 22, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "bvm_queenship", title: "Panny Marie Královny" },
  { month: 8, day: 23, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "rose_lima", title: "Sv. Růženy z Limy, panny" },
  { month: 8, day: 24, rank: RANK.FEAST_GENERAL, colour: "red", id: "bartholomew", title: "Sv. Bartoloměje, apoštola" },
  { month: 8, day: 25, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "five_camaldolese", title: "Sv. Benedikta, Jana, Matouše, Izáka a Kristina, mučedníků" },
  { month: 8, day: 25, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "louis", title: "Sv. Ludvíka" },
  { month: 8, day: 25, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "joseph_calasanz", title: "Sv. Josefa Kalasanského, kněze" },
  { month: 8, day: 27, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "monica", title: "Sv. Moniky" },
  { month: 8, day: 28, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "augustine", title: "Sv. Augustina, biskupa a učitele církve" },
  { month: 8, day: 29, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "baptist_beheading", title: "Umučení sv. Jana Křtitele" },
  { month: 9, day: 3, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "gregory_great", title: "Sv. Řehoře Velikého, papeže a učitele církve" },
  { month: 9, day: 5, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "teresa_calcutta", title: "Sv. Terezie z Kalkaty, panny" },
  { month: 9, day: 7, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "grodecky", title: "Sv. Melichara Grodeckého, kněze a mučedníka" },
  { month: 9, day: 8, rank: RANK.FEAST_GENERAL, colour: "white", id: "bvm_birth", title: "Narození Panny Marie" },
  { month: 9, day: 9, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "claver", title: "Sv. Petra Klavera, kněze" },
  { month: 9, day: 10, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "spinola", title: "Bl. Karla Spinoly, kněze a mučedníka" },
  { month: 9, day: 12, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "bvm_name", title: "Jména Panny Marie" },
  { month: 9, day: 13, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "john_chrysostom", title: "Sv. Jana Zlatoústého, biskupa a učitele církve" },
  { month: 9, day: 14, rank: rankByNum(2.5), colour: "red", id: "cross", title: "Povýšení svatého kříže" },
  { month: 9, day: 15, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "bvm_sorrows", title: "Panny Marie Bolestné" },
  { month: 9, day: 16, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "ludmila", title: "Sv. Ludmily, mučednice" },
  { month: 9, day: 17, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "cornelius_cyprian", title: "Sv. Kornélia, papeže, a Cypriána, biskupa, mučedníků" },
  { month: 9, day: 17, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "bellarmine", title: "Sv. Roberta Bellarmina, biskupa a učitele církve" },
  { month: 9, day: 17, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "hildegard", title: "Sv. Hildegardy z Bingen, panny a učitelky církve" },
  { month: 9, day: 19, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "januarius", title: "Sv. Januária, biskupa a mučedníka" },
  { month: 9, day: 20, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "korean_martyrs", title: "Sv. Ondřeje Kim Tae-gỏna, kněze, Pavla Chõng Ha-sanga a druhů, mučedníků" },
  { month: 9, day: 21, rank: RANK.FEAST_GENERAL, colour: "red", id: "matthew", title: "Sv. Matouše, apoštola a evangelisty" },
  { month: 9, day: 23, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "padre_pio", title: "Sv. Pia z Pietrelciny, kněze" },
  { month: 9, day: 26, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "cosmas_damian", title: "Sv. Kosmy a Damiána, mučedníků" },
  { month: 9, day: 27, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "vincent_de_paul", title: "Sv. Vincence z Paula, kněze" },
  { month: 9, day: 28, rank: rankByNum(1.4), colour: "red", id: "wenceslaus", title: "Sv. Václava, mučedníka, hlavního patrona českého národa" },
  { month: 9, day: 29, rank: RANK.FEAST_GENERAL, colour: "white", id: "archangels", title: "Sv. Michaela, Gabriela a Rafaela, archandělů" },
  { month: 9, day: 30, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "jerome", title: "Sv. Jeronýma, kněze a učitele církve" },
  { month: 10, day: 1, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "therese_lisieux", title: "Sv. Terezie od Dítěte Ježíše, panny a učitelky církve" },
  { month: 10, day: 2, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "guardian_angels", title: "Svatých andělů strážných" },
  { month: 10, day: 4, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "francis_assisi", title: "Sv. Františka z Assisi" },
  { month: 10, day: 5, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "faustina_kowalska", title: "Sv. Faustiny Kowalské, panny" },
  { month: 10, day: 6, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "bruno", title: "Sv. Bruna, kněze" },
  { month: 10, day: 7, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "bvm_rosary", title: "Panny Marie Růžencové" },
  { month: 10, day: 9, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "denis", title: "Sv. Dionýsia, biskupa, a druhů, mučedníků" },
  { month: 10, day: 9, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "leonardi", title: "Sv. Jana Leonardiho, kněze" },
  { month: 10, day: 9, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "newman", title: "Sv. Johna Henryho Newmana, kněze a učitele církve" },
  { month: 10, day: 11, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "john_xxiii", title: "Sv. Jana XXIII., papeže" },
  { month: 10, day: 12, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "radim", title: "Sv. Radima, biskupa" },
  { month: 10, day: 14, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "callistus_i", title: "Sv. Kalista I., papeže a mučedníka" },
  { month: 10, day: 15, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "teresa_avila", title: "Sv. Terezie od Ježíše, panny a učitelky církve" },
  { month: 10, day: 16, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "hedwig", title: "Sv. Hedviky, řeholnice" },
  { month: 10, day: 16, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "alacoque", title: "Sv. Markéty Marie Alacoque, panny" },
  { month: 10, day: 17, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "ignatius_of_antioch", title: "Sv. Ignáce Antiochijského, biskupa a mučedníka" },
  { month: 10, day: 18, rank: RANK.FEAST_GENERAL, colour: "red", id: "luke", title: "Sv. Lukáše, evangelisty" },
  { month: 10, day: 19, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "brebeuf_jogues", title: "Sv. Jana de Brébeuf a Izáka Joguese, kněží, a druhů, mučedníků" },
  { month: 10, day: 19, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "paul_of_cross", title: "Sv. Pavla od Kříže, kněze" },
  { month: 10, day: 21, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "karl_of_austria", title: "Bl. Karla Rakouského" },
  { month: 10, day: 22, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "john_paul_ii", title: "Sv. Jana Pavla II., papeže" },
  { month: 10, day: 23, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "john_capistrano", title: "Sv. Jana Kapistránského, kněze" },
  { month: 10, day: 24, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "claret", title: "Sv. Antonína Marie Klareta, biskupa" },
  { month: 10, day: 28, rank: RANK.FEAST_GENERAL, colour: "red", id: "simon_jude", title: "Sv. Šimona a Judy, apoštolů" },
  { month: 10, day: 31, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "wolfgang", title: "Sv. Wolfganga, biskupa" },
  { month: 11, day: 1, rank: RANK.SOLEMNITY_GENERAL, colour: "white", id: "all_saints", title: "Všech svatých" },
  { month: 11, day: 2, rank: RANK.SOLEMNITY_GENERAL, colour: "violet", id: "all_souls", title: "Vzpomínka na všechny věrné zemřelé" },
  { month: 11, day: 3, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "de_porres", title: "Sv. Martina de Porres, řeholníka" },
  { month: 11, day: 4, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "borromeo", title: "Sv. Karla Boromejského, biskupa" },
  { month: 11, day: 9, rank: rankByNum(2.5), colour: "white", id: "lateran_basilica", title: "Posvěcení lateránské baziliky" },
  { month: 11, day: 10, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "leo_great", title: "Sv. Lva Velikého, papeže a učitele církve" },
  { month: 11, day: 11, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "martin", title: "Sv. Martina, biskupa" },
  { month: 11, day: 12, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "josaphat", title: "Sv. Josafata, biskupa a mučedníka" },
  { month: 11, day: 13, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "agnes_of_bohemia", title: "Sv. Anežky České, panny" },
  { month: 11, day: 15, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "albert", title: "Sv. Alberta Velikého, biskupa a učitele církve" },
  { month: 11, day: 16, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "margaret_of_scotland", title: "Sv. Markéty Skotské" },
  { month: 11, day: 16, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "gertrude", title: "Sv. Gertrudy, panny" },
  { month: 11, day: 17, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "elizabeth_of_hungary", title: "Sv. Alžběty Uherské, řeholnice" },
  { month: 11, day: 18, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "peter_paul_basilicas", title: "Posvěcení římských bazilik svatých apoštolů Petra a Pavla" },
  { month: 11, day: 21, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "bvm_presentation", title: "Zasvěcení Panny Marie v Jeruzalémě" },
  { month: 11, day: 22, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "cecilia", title: "Sv. Cecílie, panny a mučednice" },
  { month: 11, day: 23, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "clement_i", title: "Sv. Klementa I., papeže a mučedníka" },
  { month: 11, day: 23, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "columban", title: "Sv. Kolumbána, opata" },
  { month: 11, day: 24, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "vietnamese_martyrs", title: "Sv. Ondřeje Dũng Lạca, kněze, a druhů, mučedníků" },
  { month: 11, day: 25, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "catherine_of_alexandria", title: "Sv. Kateřiny Alexandrijské, panny a mučednice" },
  { month: 11, day: 30, rank: RANK.FEAST_GENERAL, colour: "red", id: "andrew", title: "Sv. Ondřeje, apoštola" },
  { month: 12, day: 1, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "campion", title: "Sv. Edmunda Kampiána, kněze a mučedníka" },
  { month: 12, day: 3, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "francis_xavier", title: "Sv. Františka Xaverského, kněze" },
  { month: 12, day: 4, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "john_damascene", title: "Sv. Jana Damašského, kněze a učitele církve" },
  { month: 12, day: 6, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "nicholas", title: "Sv. Mikuláše, biskupa" },
  { month: 12, day: 7, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "ambrose", title: "Sv. Ambrože, biskupa a učitele církve" },
  { month: 12, day: 8, rank: RANK.SOLEMNITY_GENERAL, colour: "white", id: "bvm_immaculate", title: "Panny Marie, počaté bez poskvrny prvotního hříchu" },
  { month: 12, day: 9, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "juan_diego", title: "Sv. Jana Didaka Cuauhtlatoatzina" },
  { month: 12, day: 10, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "bvm_loreto", title: "Panny Marie Loretánské" },
  { month: 12, day: 11, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "damasus_i", title: "Sv. Damasa I. papeže" },
  { month: 12, day: 12, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "bvm_guadalupe", title: "Panny Marie Guadalupské" },
  { month: 12, day: 13, rank: RANK.MEMORIAL_GENERAL, colour: "red", id: "lucy", title: "Sv. Lucie, panny a mučednice" },
  { month: 12, day: 14, rank: RANK.MEMORIAL_GENERAL, colour: "white", id: "john_of_cross", title: "Sv. Jana od Kříže, kněze a učitele církve" },
  { month: 12, day: 21, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "canisius", title: "Sv. Petra Kanisia, kněze a učitele církve" },
  { month: 12, day: 23, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "john_of_kanty", title: "Sv. Jana Kentského, kněze" },
  { month: 12, day: 26, rank: RANK.FEAST_GENERAL, colour: "red", id: "stephen", title: "Sv. Štěpána, prvomučedníka" },
  { month: 12, day: 27, rank: RANK.FEAST_GENERAL, colour: "white", id: "john_evangelist", title: "Sv. Jana, apoštola a evangelisty" },
  { month: 12, day: 28, rank: RANK.FEAST_GENERAL, colour: "red", id: "innocents", title: "Svatých Mláďátek, mučedníků" },
  { month: 12, day: 29, rank: RANK.MEMORIAL_OPTIONAL, colour: "red", id: "becket", title: "Sv. Tomáše Becketa, biskupa a mučedníka" },
  { month: 12, day: 31, rank: RANK.MEMORIAL_OPTIONAL, colour: "white", id: "sylvester_i", title: "Sv. Silvestra I. papeže" },
];

class Transfers {
  constructor(temporale, sanctorale) {
    this.temporale = temporale;
    this.sanctorale = sanctorale;
    this.transferred = new Map();
  }
  call() {
    const dates = this.sanctorale.solemnityDatesForLiturgicalYear(this.temporale.year, this.temporale);
    for (const date of dates) {
      const tc = this.temporale.get(date);
      if (!isSolemnity(tc.rank)) continue;
      const sc = this.sanctorale.get(date)[0];
      if (!sc || !isSolemnity(sc.rank)) continue;
      const loser = rankHigher(sc.rank, tc.rank) ? tc : sc;
      const winner = loser === sc ? tc : sc;
      let transferTo;
      if (loser.symbol === 'annunciation' && inRangeInclusive(date, this.temporale.dateMethod('palm_sunday'), this.temporale.dateMethod('easter_sunday'))) {
        const mondayEaster2 = addDays(this.temporale.dateMethod('easter_sunday'), 8);
        transferTo = this.validDestination(mondayEaster2) ? mondayEaster2 : this.freeDayClosestTo(mondayEaster2);
      } else {
        transferTo = this.freeDayClosestTo(date);
      }
      this.transferred.set(iso(transferTo), loser.change({ date: transferTo }));
      if (winner.rank !== RANK.PRIMARY) this.transferred.set(iso(date), winner.change({ date }));
    }
    return this.transferred;
  }
  validDestination(date) {
    if (this.transferred.has(iso(date))) return false;
    if (rankAtLeast(this.temporale.get(date).rank, RANK.FEAST_PROPER)) return false;
    const sc = this.sanctorale.get(date);
    if (sc.length > 0 && rankAtLeast(sc[0].rank, RANK.FEAST_PROPER)) return false;
    return true;
  }
  freeDayClosestTo(date) {
    for (let i = 1; i <= 100; i++) {
      const after = addDays(date, i);
      if (this.validDestination(after)) return after;
      const before = addDays(date, -i);
      if (this.validDestination(before)) return before;
    }
    throw new Error('Could not find a transfer destination');
  }
}

function normalizeSanctoraleEntries(sanctoraleData) {
  if (Array.isArray(sanctoraleData)) return sanctoraleData;
  if (typeof sanctoraleData === 'string' && sanctoraleData.trim()) return parseSanctorale(sanctoraleData);
  throw new Error('Pass sanctorale data as an array of entries or a czech-cs.txt string.');
}

class CzechCalendar {
  constructor(sanctoraleData = CZECH_SANCTORALE_ENTRIES, options = {}) {
    this.sanctorale = new Sanctorale(normalizeSanctoraleEntries(sanctoraleData));
    this.transferToSunday = options.transferToSunday || [];
    this.cache = new Map();
  }
  calendarForDate(date) {
    const liturgicalYear = Temporale.liturgicalYear(date);
    if (!this.cache.has(liturgicalYear)) {
      const temporale = new Temporale(liturgicalYear, { transferToSunday: this.transferToSunday });
      const transferred = new Transfers(temporale, this.sanctorale).call();
      this.cache.set(liturgicalYear, { temporale, transferred });
    }
    return this.cache.get(liturgicalYear);
  }
  celebrationsFor(date) {
    const { temporale, transferred } = this.calendarForDate(date);
    const transferredCelebration = transferred.get(iso(date));
    if (transferredCelebration) return [transferredCelebration];

    const t = temporale.get(date);
    let st = this.sanctorale.get(date);

    if (wday(date) === 6 && temporale.season(date) === SEASON.ORDINARY &&
        (st.length === 0 || st[0].rank === RANK.MEMORIAL_OPTIONAL) &&
        !rankHigher(t.rank, RANK.MEMORIAL_OPTIONAL)) {
      st = st.concat([tempCelebration('saturday_memorial_bvm', RANK.MEMORIAL_OPTIONAL, 'white')]);
    }

    if (st.length > 0) {
      if (rankHigher(st[0].rank, t.rank)) {
        if (st[0].rank === RANK.MEMORIAL_OPTIONAL) return [t, ...st];
        return st;
      }
      if (t.rank === RANK.FERIAL_PRIVILEGED && isMemorial(st[0].rank)) {
        return [t, ...st.map((c) => c.change({ rank: RANK.COMMEMORATION, colour: t.colour }))];
      }
      if (t.symbol === 'immaculate_heart' && [RANK.MEMORIAL_GENERAL, RANK.MEMORIAL_PROPER].includes(st[0].rank)) {
        const optionalMemorials = [t, ...st].map((c) => c.change({ rank: RANK.MEMORIAL_OPTIONAL }));
        return [temporale.ferial(date), ...optionalMemorials];
      }
    }
    return [t];
  }
  day(year, month, day) {
    const date = dateUtc(year, month, day);
    const { temporale } = this.calendarForDate(date);
    const season = temporale.season(date);
    const seasonWeek = temporale.seasonWeek(season, date);
    const lectionaryYear = Temporale.lectionaryYear(date);
    const sundayCycle = Temporale.sundayCycle(date);
    const weekdayCycle = Temporale.weekdayCycle(date);
    const celebrations = this.celebrationsFor(date);
    return {
      date: iso(date),
      weekday: WEEKDAY[wday(date)],
      season: season.id,
      seasonTitle: season.title,
      seasonWeek,
      lectionaryYear,
      liturgicalYear: lectionaryYear,
      liturgicalCycle: sundayCycle,
      sundayCycle,
      weekdayCycle,
      ferialCycle: weekdayCycle,
      celebrations: celebrations.map((c, i) => c.toApiObject(i)),
    };
  }
  GetFeastsForDay(Year, Month, Day) {
    const d = this.day(Year, Month, Day);
    return {
      Success: true,
      Data: {
        Date: d.date,
        Weekday: d.weekday,
        Season: d.season,
        SeasonTitle: d.seasonTitle,
        SeasonWeek: d.seasonWeek,
        LiturgicalYear: d.liturgicalYear,
        LectionaryYear: d.lectionaryYear,
        LiturgicalCycle: d.liturgicalCycle,
        SundayCycle: d.sundayCycle,
        FerialCycle: d.ferialCycle,
        WeekdayCycle: d.weekdayCycle,
        FeastsInDay: d.celebrations,
      },
    };
  }
}

function createCzechCalendar(sanctoraleData = CZECH_SANCTORALE_ENTRIES, options = {}) {
  return new CzechCalendar(sanctoraleData, options);
}



root.CzechLiturgicalCalendar = {
  createCzechCalendar,
  CZECH_SANCTORALE_ENTRIES,
  CzechCalendar, parseSanctorale, Temporale, TemporaleDates, RANK, SEASON
};

})(typeof window !== 'undefined' ? window : globalThis);
