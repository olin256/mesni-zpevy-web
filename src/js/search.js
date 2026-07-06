(() => {
    'use strict';

    const VISIBLE_LIMIT = 25;
    const MAX_SNIPPETS = 2;
    const MIN_SUBSTRING_LENGTH = 3;
    const FUZZY_CUTOFF = 0.84;

    const state = {
        songs: [],
        vocabulary: [],
        links: {},
        loaded: false,
        lastResults: [],
    };

    const els = {};

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        els.form = document.getElementById('songSearchForm');
        els.input = document.getElementById('songSearchInput');
        els.status = document.getElementById('searchStatus');
        els.table = document.getElementById('songSearchResults');
        els.tbody = els.table ? els.table.querySelector('tbody') : null;
        els.actions = document.getElementById('searchActions');
        els.showAll = document.getElementById('searchShowAll');

        if (!els.form || !els.input || !els.status || !els.table || !els.tbody) {
            return;
        }

        els.form.addEventListener('submit', event => {
            event.preventDefault();
            const query = els.input.value.trim();
            const url = new URL(window.location.href);
            if (query) {
                url.searchParams.set('q', query);
            } else {
                url.searchParams.delete('q');
            }
            history.pushState(null, '', url);
            runSearch(query);
        });

        window.addEventListener('popstate', () => {
            const query = new URLSearchParams(window.location.search).get('q') || '';
            els.input.value = query;
            runSearch(query);
        });

        if (els.showAll) {
            els.showAll.addEventListener('click', showAllResults);
        }

        try {
            await loadData();
            state.loaded = true;
            const query = new URLSearchParams(window.location.search).get('q') || '';
            els.input.value = query;
            runSearch(query);
            if (!query) {
                els.input.focus();
            }
        } catch (error) {
            console.error(error);
            els.status.textContent = 'Vyhledávací index se nepodařilo načíst.';
        }
    }

    async function loadData() {
        const script = document.currentScript || document.querySelector('script[data-index]');
        const indexUrl = script?.dataset.index || 'assets/data/search_index.json';
        const linksUrl = script?.dataset.links || 'assets/data/occurrences.json';

        const [indexResponse, linksResponse] = await Promise.all([
            fetch(indexUrl, { cache: 'no-cache' }),
            fetch(linksUrl, { cache: 'no-cache' }),
        ]);

        if (!indexResponse.ok) {
            throw new Error(`Nelze načíst ${indexUrl}`);
        }
        if (!linksResponse.ok) {
            throw new Error(`Nelze načíst ${linksUrl}`);
        }

        const index = await indexResponse.json();
        state.songs = Array.isArray(index.songs) ? index.songs : [];
        state.vocabulary = Array.isArray(index.vocabulary) ? index.vocabulary : buildVocabulary(state.songs);
        state.links = groupLinksBySong(await linksResponse.json());
    }

    function groupLinksBySong(rawLinks) {
        if (!Array.isArray(rawLinks)) return rawLinks || {};

        return rawLinks.reduce((out, occurrence) => {
            if (!occurrence || occurrence.song == null) return out;
            const songId = String(occurrence.song);
            if (!out[songId]) out[songId] = [];
            out[songId].push({
                slug: occurrence.slug,
                anchor: occurrence.anchor,
                stanzas: occurrence.stanzas,
                title: occurrence.title,
            });
            return out;
        }, {});
    }

    function runSearch(query) {
        if (!state.loaded) return;

        query = query.trim();
        els.tbody.innerHTML = '';
        els.table.hidden = true;
        setActions(false);

        if (!query) {
            els.status.textContent = 'Zadejte dotaz.';
            return;
        }

        const parsed = parseQuery(query);
        if (!parsed.terms.length && !parsed.phrases.length) {
            els.status.textContent = 'Zadejte dotaz.';
            return;
        }

        let results = searchDirect(parsed);
        const hasDirectResults = results.length > 0;

        if (!hasDirectResults && !parsed.hasStrictPhrase) {
            results = searchFuzzy(parsed);
        }

        state.lastResults = results;
        renderResults(results, hasDirectResults ? 'direct' : 'fuzzy');
    }

    function parseQuery(query) {
        const quoted = [];
        const withoutQuotes = query.replace(/"([^"]+)"/g, (_match, phrase) => {
            const trimmed = phrase.trim();
            if (trimmed) quoted.push(trimmed);
            return ' ';
        });

        const allForTerms = `${withoutQuotes} ${quoted.join(' ')}`;
        const terms = tokenize(allForTerms);
        const phrases = [];

        for (const phrase of quoted) {
            const normalized = normalizeText(phrase);
            if (normalized) phrases.push([normalized, true]);
        }

        const unquotedPhrase = normalizeText(withoutQuotes);
        if (unquotedPhrase.split(/\s+/).filter(Boolean).length >= 2) {
            phrases.push([unquotedPhrase, false]);
        }

        return {
            raw: query,
            norm: normalizeText(query),
            terms,
            phrases,
            hasStrictPhrase: phrases.some(([, strict]) => strict),
        };
    }

    function searchDirect(parsed) {
        const results = [];

        for (const song of state.songs) {
            if (!passesStrictPhrases(song, parsed)) continue;

            const scored = scoreSong(song, parsed, parsed.terms, false);
            if (scored.score <= 0) continue;

            const snippets = bestSnippetsAndStanzas(song, parsed, parsed.terms, false);
            results.push(makeResult(song, scored.score, snippets, false));
        }

        results.sort(compareResults);
        return results;
    }

    function searchFuzzy(parsed) {
        const expansions = expandFuzzyTerms(parsed.terms);
        const expandedTerms = unique(Object.values(expansions).flat());
        const results = [];

        for (const song of state.songs) {
            const fuzzyPairs = fuzzyHitsForSong(song, expansions);
            if (!fuzzyPairs.length) continue;

            const snippetTerms = unique(parsed.terms.concat(fuzzyPairs.map(pair => pair.variant)));
            const scored = scoreSong(song, parsed, expandedTerms, true);
            const snippets = bestSnippetsAndStanzas(song, parsed, snippetTerms, true);
            const fuzzyBonus = fuzzyPairs.length * 1.5;
            results.push(makeResult(song, scored.score + fuzzyBonus, snippets, true));
        }

        results.sort(compareResults);
        return results;
    }

    function makeResult(song, score, snippetInfo, fuzzy) {
        return {
            id: song.id,
            title: song.title,
            score,
            snippets: snippetInfo.snippets,
            matchedStanzas: snippetInfo.matchedStanzas,
            fuzzy,
            occurrences: occurrencesFor(song.id, snippetInfo.matchedStanzas),
        };
    }

    function scoreSong(song, parsed, terms, fuzzyMode) {
        let score = 0;
        const titleNorm = song.title_norm || normalizeText(song.title || '');
        const titleTokens = song.title_tokens || tokenize(song.title || '');
        const allTokens = allSongTokens(song);

        if (!fuzzyMode && parsed.norm && titleNorm === parsed.norm) score += 120;
        if (!fuzzyMode && parsed.norm && titleNorm.startsWith(parsed.norm) && titleNorm !== parsed.norm) score += 40;
        if (!fuzzyMode && parsed.norm && titleNorm.includes(parsed.norm)) score += 55;
        if (!fuzzyMode && parsed.norm && song.stanzas.some(st => (st.text_norm || '').includes(parsed.norm))) score += 22;

        for (const term of unique(terms)) {
            const exactTitleToken = titleTokens.some(token => token === term);
            const prefixTitleToken = !exactTitleToken && term.length >= 4 && titleTokens.some(token => token.startsWith(term));
            const substringTitleToken = !exactTitleToken && !prefixTitleToken && titleTokens.some(token => substringMatch(token, term));

            if (exactTitleToken) {
                score += 90;
            } else if (prefixTitleToken) {
                score += 22;
            } else if (substringTitleToken) {
                score += 10;
            }

            let stanzaHits = 0;
            for (const stanza of song.stanzas || []) {
                const tokens = stanza.tokens || tokenize(stanza.text || '');
                if (tokens.some(token => tokenOrSubstringMatch(token, term))) stanzaHits++;
            }
            if (stanzaHits) score += Math.min(14, stanzaHits * 3);
        }

        for (const [phrase, strict] of parsed.phrases) {
            if (titleNorm.includes(phrase)) score += strict ? 75 : 35;
            if ((song.stanzas || []).some(st => (st.text_norm || '').includes(phrase))) score += strict ? 45 : 18;
        }

        if (parsed.terms.length && containsAllTermsInTokens(allTokens, parsed.terms)) score += 12;
        score += proximityBonus(allTokens, parsed.terms);

        return { score };
    }

    function bestSnippetsAndStanzas(song, parsed, queryTerms, fuzzyMode) {
        const candidates = [];

        for (const stanza of song.stanzas || []) {
            for (const segment of stanza.segments || [{ text: stanza.text, text_norm: stanza.text_norm }]) {
                const segmentText = stripLeadingStanzaNumber(segment.text || '');
                const segmentNorm = segment.text_norm || normalizeText(segmentText);
                const segmentTokens = segmentNorm.split(/\s+/).filter(Boolean);
                let score = 0;

                if (!fuzzyMode && parsed.norm && segmentNorm.includes(parsed.norm)) score += 25;

                for (const term of queryTerms) {
                    if (segmentTokens.some(token => tokenMatchesQuery(token, term))) score += 10;
                    else if (segmentTokens.some(token => substringMatch(token, term))) score += 8;
                }

                for (const [phrase, strict] of parsed.phrases) {
                    if (segmentNorm.includes(phrase)) score += strict ? 50 : 20;
                }

                if (queryTerms.length && containsAllTerms(segmentNorm, queryTerms)) score += 12;
                score += proximityBonus(segmentTokens, queryTerms);

                if (score > 0) {
                    candidates.push({ score, stanza, text: segmentText });
                }
            }
        }

        candidates.sort((a, b) => b.score - a.score);

        const snippets = [];
        const matchedStanzas = new Set();
        const seen = new Set();

        for (const item of candidates) {
            const key = normalizeText(item.text);
            if (!key || seen.has(key)) continue;
            seen.add(key);

            snippets.push(`<div class="search-snippet">…${highlightHtml(compactExcerpt(item.text, queryTerms), queryTerms)}…</div>`);
            if (item.stanza.number != null) matchedStanzas.add(String(item.stanza.number));
            if (snippets.length >= MAX_SNIPPETS) break;
        }

        if (!snippets.length) {
            const fallback = findFallbackSegment(song, queryTerms);
            if (fallback) {
                snippets.push(`<div class="search-snippet">…${highlightHtml(compactExcerpt(fallback.text, queryTerms), queryTerms)}…</div>`);
                if (fallback.stanza.number != null) matchedStanzas.add(String(fallback.stanza.number));
            }
        }

        return { snippets, matchedStanzas };
    }

    function findFallbackSegment(song, queryTerms) {
        for (const stanza of song.stanzas || []) {
            for (const segment of stanza.segments || [{ text: stanza.text, text_norm: stanza.text_norm }]) {
                const text = stripLeadingStanzaNumber(segment.text || '');
                const tokens = tokenize(text);
                if (tokens.some(token => queryTerms.some(term => tokenOrSubstringMatch(token, term)))) {
                    return { stanza, text };
                }
            }
        }
        const first = (song.stanzas || [])[0];
        if (!first) return null;
        return { stanza: first, text: stripLeadingStanzaNumber(first.text || '') };
    }

    function passesStrictPhrases(song, parsed) {
        for (const [phrase, strict] of parsed.phrases) {
            if (strict && !songContainsPhrase(song, phrase)) {
                return false;
            }
        }
        return true;
    }

    function songContainsPhrase(song, phrase) {
        const titleNorm = song.title_norm || normalizeText(song.title || '');
        return titleNorm.includes(phrase) || (song.stanzas || []).some(stanza => (stanza.text_norm || '').includes(phrase));
    }

    function occurrencesFor(songId, matchedStanzas) {
        const entries = normalizeLinkEntries(state.links?.[songId] || []);
        if (!entries.length) return [];

        const matched = new Set([...matchedStanzas].map(String));
        let chosen = entries;

        if (matched.size > 0) {
            chosen = entries.filter(entry => {
                const stanzas = stanzaValues(entry.stanzas);
                return stanzas.some(stanza => matched.has(String(stanza)));
            });
        }

        if (!chosen.length) chosen = entries;

        const seen = new Set();
        const out = [];
        for (const entry of chosen) {
            if (!entry.slug || !entry.anchor) continue;
            const href = `${entry.slug}.html#pg${entry.anchor}`;
            if (seen.has(href)) continue;
            seen.add(href);
            out.push({
                href,
                text: pageLabel(entry.anchor),
                title: entry.title || entry.name || '',
            });
        }
        return out;
    }

    function normalizeLinkEntries(value) {
        if (Array.isArray(value)) return value;
        if (value && typeof value === 'object') return Object.values(value).flat();
        return [];
    }

    function stanzaValues(value) {
        if (value == null) return [];
        if (Array.isArray(value)) return unique(value.flatMap(stanzaValues));
        if (typeof value === 'number') return [String(Math.trunc(value))];
        if (typeof value !== 'string') return [];

        const out = [];
        const matches = value.match(/\d+\s*-\s*\d+|\d+/g) || [];
        for (const part of matches) {
            const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
            if (range) {
                const a = Number(range[1]);
                const b = Number(range[2]);
                for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(String(i));
            } else {
                out.push(String(Number(part)));
            }
        }
        return unique(out);
    }

    function pageLabel(anchor) {
        return String(anchor).replace(/-.*/, '');
    }

    function renderResults(results, mode) {
        els.tbody.innerHTML = '';
        setActions(false);

        if (!results.length) {
            els.table.hidden = true;
            els.status.innerHTML = '<span class="search-empty">Nic nenalezeno.</span>';
            return;
        }

        els.status.innerHTML = `Nalezeno výsledků: <strong>${results.length}</strong>${mode === 'fuzzy' ? ' <span class="search-muted">(zobrazeny pravděpodobné shody)</span>' : ''}${results.length > VISIBLE_LIMIT ? ` <span class="search-muted">(zobrazeno prvních ${VISIBLE_LIMIT})</span>` : ''}`;

        results.forEach((result, index) => {
            const tr = document.createElement('tr');
            tr.className = 'song-row';
            if (index >= VISIBLE_LIMIT) {
                tr.classList.add('search-extra-row');
                tr.hidden = true;
            }

            const idCell = document.createElement('td');
            idCell.textContent = result.id;
            tr.appendChild(idCell);

            const titleCell = document.createElement('td');
            const title = document.createElement('strong');
            title.className = 'result-title';
            title.textContent = result.title;
            titleCell.appendChild(title);
            titleCell.insertAdjacentHTML('beforeend', result.snippets.join('\n'));
            tr.appendChild(titleCell);

            const occurrenceCell = document.createElement('td');
            occurrenceCell.className = 'occurrences';
            occurrenceCell.appendChild(renderOccurrences(result.occurrences));
            tr.appendChild(occurrenceCell);

            els.tbody.appendChild(tr);
        });

        els.table.hidden = false;
        setActions(results.length > VISIBLE_LIMIT);
        refreshRowStripes();
    }

    function renderOccurrences(occurrences) {
        const fragment = document.createDocumentFragment();
        if (!occurrences.length) {
            const span = document.createElement('span');
            span.className = 'muted';
            span.textContent = '—';
            fragment.appendChild(span);
            return fragment;
        }

        occurrences.forEach((occ, index) => {
            if (index > 0) fragment.appendChild(document.createTextNode(', '));
            const a = document.createElement('a');
            a.href = occ.href;
            a.textContent = occ.text;
            if (occ.title) a.title = occ.title;
            fragment.appendChild(a);
        });
        return fragment;
    }

    function showAllResults() {
        els.tbody.querySelectorAll('tr.search-extra-row[hidden]').forEach(row => {
            row.hidden = false;
        });
        setActions(false);
        refreshRowStripes();
    }

    function setActions(show) {
        if (els.actions) els.actions.hidden = !show;
    }

    function refreshRowStripes() {
        const visibleRows = Array.from(els.tbody.querySelectorAll('tr.song-row')).filter(row => !row.hidden);
        visibleRows.forEach((row, index) => {
            row.classList.toggle('song-row-alt', index % 2 === 1);
        });
    }

    function compactExcerpt(text, queryTerms, radius = 70) {
        text = stripLeadingStanzaNumber(text);
        const chars = Array.from(text);
        if (chars.length <= radius * 2) return text;

        const folded = foldedWithMap(text);
        const terms = unique(queryTerms).sort((a, b) => b.length - a.length);
        let startChar = null;

        for (const term of terms) {
            if (term.length < MIN_SUBSTRING_LENGTH) continue;
            const pos = folded.text.indexOf(term);
            if (pos !== -1 && folded.map[pos] != null) {
                startChar = folded.map[pos];
                break;
            }
        }

        if (startChar == null) return chars.slice(0, radius * 2).join('').trim() + '…';

        const start = Math.max(0, startChar - radius);
        const end = Math.min(chars.length, startChar + radius);
        return `${start > 0 ? '…' : ''}${chars.slice(start, end).join('').trim()}${end < chars.length ? '…' : ''}`;
    }

    function highlightHtml(text, queryTerms) {
        const escapedParts = [];
        const wordRe = /[\p{L}\p{N}]+/gu;
        let last = 0;
        let match;

        while ((match = wordRe.exec(text)) !== null) {
            escapedParts.push(escapeHtml(text.slice(last, match.index)));
            escapedParts.push(highlightWordHtml(match[0], queryTerms));
            last = match.index + match[0].length;
        }
        escapedParts.push(escapeHtml(text.slice(last)));
        return escapedParts.join('');
    }

    function highlightWordHtml(word, queryTerms) {
        const folded = foldedWithMap(word);

        for (const term of queryTerms) {
            if (tokenMatchesQuery(folded.text, term)) {
                return `<mark>${escapeHtml(word)}</mark>`;
            }
        }

        const terms = unique(queryTerms).sort((a, b) => b.length - a.length);
        for (const term of terms) {
            if (term.length < MIN_SUBSTRING_LENGTH) continue;
            const start = folded.text.indexOf(term);
            if (start === -1) continue;

            const end = start + term.length - 1;
            const originalStart = folded.map[start];
            const originalEnd = folded.map[end] + 1;
            if (originalStart == null || originalEnd == null) continue;

            const chars = Array.from(word);
            return escapeHtml(chars.slice(0, originalStart).join(''))
                + `<mark>${escapeHtml(chars.slice(originalStart, originalEnd).join(''))}</mark>`
                + escapeHtml(chars.slice(originalEnd).join(''));
        }

        return escapeHtml(word);
    }

    function foldedWithMap(text) {
        const chars = Array.from(text);
        let out = '';
        const map = [];
        chars.forEach((ch, index) => {
            const foldedChars = Array.from(removeDiacritics(ch.toLocaleLowerCase('cs-CZ')));
            for (const f of foldedChars) {
                out += f;
                map.push(index);
            }
        });
        return { text: out, map };
    }

    function tokenMatchesQuery(token, term) {
        return token === term || (term.length >= 4 && token.startsWith(term));
    }

    function substringMatch(token, term) {
        return term.length >= MIN_SUBSTRING_LENGTH && token.includes(term);
    }

    function tokenOrSubstringMatch(token, term) {
        return tokenMatchesQuery(token, term) || substringMatch(token, term);
    }

    function containsAllTerms(textNorm, terms) {
        const tokens = (textNorm || '').split(/\s+/).filter(Boolean);
        return containsAllTermsInTokens(tokens, terms);
    }

    function containsAllTermsInTokens(tokens, terms) {
        return terms.every(term => tokens.some(token => tokenOrSubstringMatch(token, term)));
    }

    function allSongTokens(song) {
        const tokens = [];
        tokens.push(...(song.title_tokens || tokenize(song.title || '')));
        for (const stanza of song.stanzas || []) {
            tokens.push(...(stanza.tokens || tokenize(stanza.text || '')));
        }
        return tokens;
    }

    function proximityBonus(tokens, terms) {
        const uniqueTerms = unique(terms);
        if (uniqueTerms.length < 2) return 0;

        const positions = new Map();
        uniqueTerms.forEach(term => positions.set(term, []));

        tokens.forEach((token, index) => {
            uniqueTerms.forEach(term => {
                if (tokenOrSubstringMatch(token, term)) positions.get(term).push(index);
            });
        });

        if (uniqueTerms.some(term => positions.get(term).length === 0)) return 0;

        const all = [];
        positions.forEach((values, term) => values.forEach(pos => all.push([pos, term])));
        all.sort((a, b) => a[0] - b[0]);

        const counts = new Map();
        let left = 0;
        let covered = 0;
        let best = Infinity;

        for (let right = 0; right < all.length; right++) {
            const [posR, termR] = all[right];
            counts.set(termR, (counts.get(termR) || 0) + 1);
            if (counts.get(termR) === 1) covered++;

            while (covered === uniqueTerms.length) {
                const [posL, termL] = all[left];
                best = Math.min(best, posR - posL + 1);
                counts.set(termL, counts.get(termL) - 1);
                if (counts.get(termL) === 0) covered--;
                left++;
            }
        }

        return Number.isFinite(best) ? Math.max(0, 18 / best) : 0;
    }

    function expandFuzzyTerms(terms) {
        const vocab = new Set(state.vocabulary);
        const expansions = {};

        for (const term of terms) {
            if (term.length <= 3 || vocab.has(term)) {
                expansions[term] = [term];
                continue;
            }
            expansions[term] = unique([term].concat(closeMatches(term, 4)));
        }
        return expansions;
    }

    function closeMatches(term, limit) {
        const matches = [];
        const termLen = Math.max(1, term.length);

        for (const candidate of state.vocabulary) {
            if (candidate === term) continue;
            const candidateLen = Math.max(1, candidate.length);
            const distance = levenshtein(term, candidate);
            const maxDistance = termLen <= 6 ? 1 : termLen <= 10 ? 2 : 3;
            const levScore = 1 - distance / Math.max(termLen, candidateLen);
            const prefixScore = commonPrefixLength(term, candidate) / Math.max(termLen, candidateLen);
            const score = Math.max(levScore, prefixScore);

            if (score >= FUZZY_CUTOFF || distance <= maxDistance) {
                matches.push({ term: candidate, score: score - Math.abs(termLen - candidateLen) * 0.03, distance });
            }
        }

        matches.sort((a, b) => b.score - a.score || a.distance - b.distance);
        return matches.slice(0, limit).map(item => item.term);
    }

    function fuzzyHitsForSong(song, expansions) {
        const tokens = [];
        for (const stanza of song.stanzas || []) {
            tokens.push(...(stanza.tokens || tokenize(stanza.text || '')));
        }

        const hits = [];
        for (const [original, variants] of Object.entries(expansions)) {
            for (const variant of variants.slice(1)) {
                if (tokens.some(token => tokenOrSubstringMatch(token, variant))) {
                    hits.push({ original, variant });
                    break;
                }
            }
        }
        return hits;
    }

    function levenshtein(a, b) {
        const m = a.length;
        const n = b.length;
        const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
            }
        }
        return dp[m][n];
    }

    function commonPrefixLength(a, b) {
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) i++;
        return i;
    }

    function buildVocabulary(songs) {
        const set = new Set();
        songs.forEach(song => {
            (song.title_tokens || tokenize(song.title || '')).forEach(t => set.add(t));
            (song.stanzas || []).forEach(stanza => (stanza.tokens || tokenize(stanza.text || '')).forEach(t => set.add(t)));
        });
        return [...set].sort();
    }

    function tokenize(text) {
        const normalized = normalizeText(text);
        return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
    }

    function normalizeText(text) {
        return removeDiacritics(String(text || '').toLocaleLowerCase('cs-CZ'))
            .replace(/[^0-9\p{L}]+/gu, ' ')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function removeDiacritics(text) {
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function stripLeadingStanzaNumber(text) {
        return String(text || '').replace(/^\s*\d+[a-zA-Z]?\.\s*/u, '').trim();
    }

    function unique(items) {
        return [...new Set(items.filter(item => item !== null && item !== undefined && item !== ''))];
    }

    function compareResults(a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return naturalSongId(a.id).localeCompare(naturalSongId(b.id), 'cs', { numeric: true, sensitivity: 'base' });
    }

    function naturalSongId(id) {
        return String(id || '').padStart(8, '0');
    }

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        }[ch]));
    }
})();
