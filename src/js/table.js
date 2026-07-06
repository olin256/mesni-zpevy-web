document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('songIndex');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    const sortButtons = table.querySelectorAll('thead button[data-sort]');
    const collator = new Intl.Collator('cs', {
        sensitivity: 'base',
        numeric: true
    });

    let currentSort = {
        key: null,
        direction: 1
    };

    initSongInfoRows();
    updateRowStriping();

    function initSongInfoRows() {
        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.forEach(row => {
            if (row.classList.contains('song-info-row')) return;

            row.classList.add('song-row');

            const songNumber = getCellText(row, 0);
            const songTitle = getCellText(row, 1);
            const infoId = `song-info-${makeSafeId(songNumber)}`;

            const firstCell = row.cells[0];
            firstCell.textContent = '';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'song-info-toggle';
            button.textContent = songNumber;
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-controls', infoId);
            button.title = `Zobrazit informace o písni ${songNumber}`;

            firstCell.appendChild(button);

            const infoRow = document.createElement('tr');
            infoRow.className = 'song-info-row';
            infoRow.id = infoId;
            infoRow.hidden = true;

            const infoCell = document.createElement('td');
            infoCell.colSpan = row.cells.length;

            const wrapper = document.createElement('div');
            wrapper.className = 'song-info';

            const img = document.createElement('img');
            img.className = 'song-info-image';
            img.alt = `Informace o písni ${songNumber}: ${songTitle}`;
            img.loading = 'lazy';
            img.decoding = 'async';

            const links = createSongInfoLinks(songNumber);

            if (links) {
                wrapper.appendChild(links);
            }

            wrapper.appendChild(img);
            infoCell.appendChild(wrapper);
            infoRow.appendChild(infoCell);

            row.after(infoRow);

            button.addEventListener('click', () => {
                toggleSongInfo(button, infoRow, songNumber);
            });
        });
    }

    function toggleSongInfo(button, infoRow, songNumber) {
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        const willExpand = !isExpanded;

        if (willExpand) {
            const img = infoRow.querySelector('.song-info-image');

            if (img && !img.getAttribute('src')) {
                img.src = getInfoImagePath(songNumber);
            }
        }

        button.setAttribute('aria-expanded', String(willExpand));
        infoRow.hidden = !willExpand;
    }

    function getInfoImagePath(songNumber) {
        const match = songNumber.trim().match(/^(\d+)([a-zá-ž]*)$/i);

        if (!match) {
            return '';
        }

        const number = match[1].padStart(3, '0');
        const suffix = match[2].toLowerCase();

        return `assets/images/info_images/${number}${suffix}.png`;
    }

    function makeSafeId(value) {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9á-ž_-]+/gi, '-');
    }

    function parseSongNumber(value) {
        const match = value.trim().match(/^(\d+)([a-zá-ž]*)$/i);

        if (!match) {
            return {
                number: Number.POSITIVE_INFINITY,
                suffix: value.trim()
            };
        }

        return {
            number: Number(match[1]),
            suffix: match[2].toLowerCase()
        };
    }

    function compareSongNumbers(a, b) {
        const first = parseSongNumber(a);
        const second = parseSongNumber(b);

        if (first.number !== second.number) {
            return first.number - second.number;
        }

        return collator.compare(first.suffix, second.suffix);
    }

    function getCellText(row, index) {
        return row.cells[index].textContent.trim();
    }

    function getSongBaseNumber(songNumber) {
        const match = songNumber.trim().match(/^(\d+)/);

        if (!match) {
            return null;
        }

        return match[1].padStart(3, '0');
    }

    function createSongInfoLinks(songNumber) {
        const baseNumber = getSongBaseNumber(songNumber);

        if (!baseNumber) {
            return null;
        }

        const paragraph = document.createElement('p');
        paragraph.className = 'song-info-links';

        const voiceLink = document.createElement('a');
        voiceLink.href = `midi_voice/${baseNumber}_voice.mid`;
        voiceLink.textContent = 'MIDI hlas';

        const organMidiLink = document.createElement('a');
        organMidiLink.href = `midi_organ/${baseNumber}_organ.mid`;
        organMidiLink.textContent = 'MIDI varhany';

        const organPdfLink = document.createElement('a');
        organPdfLink.href = `https://olin256.github.io/mesni-zpevy/pdf/${baseNumber}.pdf`;
        organPdfLink.textContent = 'PDF varhany';

        paragraph.appendChild(voiceLink);
        paragraph.appendChild(organMidiLink);
        paragraph.appendChild(organPdfLink);

        return paragraph;
    }

    function getSongItems() {
        return Array.from(tbody.querySelectorAll('tr.song-row')).map(row => {
            const infoRow = row.nextElementSibling;

            return {
                row,
                infoRow: infoRow && infoRow.classList.contains('song-info-row')
                    ? infoRow
                    : null
            };
        });
    }

    function sortTable(key) {
        const items = getSongItems();

        if (currentSort.key === key) {
            currentSort.direction *= -1;
        } else {
            currentSort.key = key;
            currentSort.direction = 1;
        }

        items.sort((itemA, itemB) => {
            let result = 0;

            if (key === 'number') {
                result = compareSongNumbers(
                    getCellText(itemA.row, 0),
                    getCellText(itemB.row, 0)
                );
            } else if (key === 'title') {
                result = collator.compare(
                    getCellText(itemA.row, 1),
                    getCellText(itemB.row, 1)
                );
            }

            return result * currentSort.direction;
        });

        items.forEach(item => {
            tbody.appendChild(item.row);

            if (item.infoRow) {
                tbody.appendChild(item.infoRow);
            }
        });

        updateRowStriping();
        updateSortHeader(key);
    }

    function updateSortHeader(key) {
        table.querySelectorAll('th[aria-sort]').forEach(th => {
            th.removeAttribute('aria-sort');
        });

        const activeButton = table.querySelector(`thead button[data-sort="${key}"]`);
        if (!activeButton) return;

        activeButton.closest('th').setAttribute(
            'aria-sort',
            currentSort.direction === 1 ? 'ascending' : 'descending'
        );
    }

    function updateRowStriping() {
        getSongItems().forEach((item, index) => {
            item.row.classList.toggle('song-row-alt', index % 2 === 1);
        });
    }

    sortButtons.forEach(button => {
        button.addEventListener('click', () => {
            sortTable(button.dataset.sort);
        });
    });
});
