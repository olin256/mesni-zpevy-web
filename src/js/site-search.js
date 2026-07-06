document.addEventListener('DOMContentLoaded', () => {
    let occurrencesPromise = null;

    function getOccurrences() {
        if (!occurrencesPromise) {
            occurrencesPromise = fetch('assets/data/occurrences.json', { cache: 'no-cache' })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error('Occurrences could not be loaded.');
                    }
                    return response.json();
                });
        }
        return occurrencesPromise;
    }

    function goToFulltext(query) {
        window.location.href = `hledani.html?q=${encodeURIComponent(query)}`;
    }

    function currentSlug() {
        const filename = window.location.pathname.split('/').pop() || '';
        return filename.replace(/\.html$/i, '') || 'index';
    }

    function normalizeText(text) {
        return String(text || '')
            .toLocaleLowerCase('cs-CZ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^0-9a-z]+/g, ' ')
            .trim();
    }

    function pageSlug(link) {
        const href = link && link.href;
        if (!href) return null;
        return href.split('#')[0].split('?')[0].replace(/\.html$/i, '');
    }

    function dayData(calendar, date) {
        return calendar.GetFeastsForDay(
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate()
        ).Data;
    }

    function addContextLinks(context, data, date, weight, requireSundayLink) {
        const helper = window.MZLiturgicalDayLinks;
        if (!helper) return;

        helper.findLinks(data, date, requireSundayLink).forEach((link) => {
            const slug = pageSlug(link);
            if (!slug) return;
            const previous = context.linkScores.get(slug) || 0;
            context.linkScores.set(slug, Math.max(previous, weight));
            context.linkTitles.set(slug, link.title || '');
        });
    }

    function liturgicalContext() {
        const helper = window.MZLiturgicalDayLinks;
        const api = window.CzechLiturgicalCalendar;
        const context = {
            linkScores: new Map(),
            linkTitles: new Map(),
            season: null,
            sundayCycle: null,
            titleNorms: [],
        };

        if (!helper || !api) return context;

        const calendar = api.createCzechCalendar();
        const today = helper.currentDate();
        const dates = [
            { date: helper.previousSunday(today), weight: 180, requireSundayLink: true },
            { date: today, weight: 500, requireSundayLink: false },
            { date: helper.nextSunday(today), weight: 160, requireSundayLink: true },
        ];

        dates.forEach((item) => {
            const data = dayData(calendar, item.date);
            if (item.date.getTime() === today.getTime()) {
                context.season = data.Season;
                context.sundayCycle = data.SundayCycle;
            }
            addContextLinks(context, data, item.date, item.weight, item.requireSundayLink);
            (data.FeastsInDay || []).forEach((feast) => {
                if (feast.Title) context.titleNorms.push(normalizeText(feast.Title));
            });
        });

        return context;
    }

    function sectionSeasonScore(section, context) {
        const season = context.season;
        if (season === 'advent' && section === 'advent') return 45;
        if (season === 'christmas' && section === 'vanoce') return 45;
        if (season === 'lent' && section === 'pust') return 45;
        if (season === 'triduum' && section === 'sv_tyden_triduum') return 45;
        if (season === 'easter' && section === 'velikonoce') return 45;
        if (season === 'ordinary' && section === 'mezidobi') return 35;
        if (season === 'ordinary' && section === 'slavnosti_pane') return 20;
        return 0;
    }

    function titleScore(occurrence, context) {
        const title = normalizeText(occurrence.title);
        if (!title) return 0;

        return context.titleNorms.some((contextTitle) => (
            contextTitle && (
                title.includes(contextTitle) ||
                contextTitle.includes(title)
            )
        )) ? 80 : 0;
    }

    function cycleScore(occurrence, context) {
        const cycle = context.sundayCycle;
        if (!cycle) return 0;
        return String(occurrence.slug || '').endsWith(`_${cycle}`) ? 25 : 0;
    }

    function sortPageCandidates(candidates) {
        const context = liturgicalContext();
        const slug = currentSlug();

        return candidates
            .map((occurrence, index) => {
                let score = 0;
                if (occurrence.slug === slug) score += 1000;
                score += context.linkScores.get(occurrence.slug) || 0;
                score += sectionSeasonScore(occurrence.section, context);
                score += titleScore(occurrence, context);
                score += cycleScore(occurrence, context);

                return { occurrence, index, score };
            })
            .sort((a, b) => (
                b.score - a.score ||
                Number(a.occurrence.page) - Number(b.occurrence.page) ||
                a.index - b.index
            ))
            .map((item) => item.occurrence);
    }

    async function goToPage(page) {
        try {
            const occurrences = await getOccurrences();
            const pageNumber = Number.parseInt(page, 10);
            const candidates = occurrences.filter((occurrence) => (
                Number(occurrence.page) === pageNumber
            ));
            const best = sortPageCandidates(candidates)[0];

            if (best) {
                window.location.href = `${best.slug}.html#pg${encodeURIComponent(best.anchor)}`;
                return;
            }
        } catch (error) {
            console.error(error);
        }

        window.location.href = `sken.html?pg=${encodeURIComponent(page)}`;
    }

    document.querySelectorAll('.site-search-form').forEach((form) => {
        form.addEventListener('submit', (event) => {
            const input = form.querySelector('input[name="q"]');
            if (!input) return;

            const query = input.value.trim();
            if (!query) return;

            event.preventDefault();

            if (/^\d+$/.test(query)) {
                goToPage(query);
                return;
            }

            goToFulltext(query);
        });
    });
});
