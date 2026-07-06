(() => {
    const sections = Array.from(document.querySelectorAll("[data-index-section]"));

    function setExpanded(section, expanded) {
        const content = section.querySelector("ul");
        const button = section.querySelector(".index-section-toggle");
        const label = section.querySelector(".index-section-toggle__state");
        if (!content || !button) {
            return;
        }

        content.hidden = !expanded;
        if (label) {
            label.textContent = expanded ? "Skrýt" : "Zobrazit";
        }
        button.setAttribute("aria-expanded", String(expanded));
        section.classList.toggle("is-open", expanded);
    }

    function currentDate() {
        const dateParam = new URLSearchParams(window.location.search).get("date");
        const match = dateParam && dateParam.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            const date = new Date(year, month - 1, day);
            if (
                date.getFullYear() === year &&
                date.getMonth() === month - 1 &&
                date.getDate() === day
            ) {
                return date;
            }
        }

        return new Date();
    }

    function todayLiturgicalSection() {
        const api = window.CzechLiturgicalCalendar;
        if (!api) {
            return null;
        }

        const today = currentDate();
        const calendar = api.createCzechCalendar();
        const result = calendar.GetFeastsForDay(
            today.getFullYear(),
            today.getMonth() + 1,
            today.getDate()
        );
        const data = result && result.Data;
        if (!data) {
            return null;
        }

        const feastText = (data.FeastsInDay || [])
            .map((feast) => `${feast.Symbol || ""} ${feast.Id || ""} ${feast.Title || ""}`)
            .join(" ");

        if (/\b(easter_sunday|holy_saturday)\b/.test(feastText)) {
            return "velikonoce";
        }
        if (/\b(palm_sunday|good_friday)\b/.test(feastText) || /Svatého týdne/.test(feastText)) {
            return "sv_tyden_triduum";
        }

        return {
            advent: "advent",
            christmas: "vanoce",
            lent: "pust",
            triduum: "sv_tyden_triduum",
            easter: "velikonoce",
            ordinary: "mezidobi",
        }[data.Season] || null;
    }

    function initializeIndexSections() {
        const openSection = todayLiturgicalSection();

        sections.forEach((section) => {
            const heading = section.querySelector("h2");
            const content = section.querySelector("ul");
            if (!heading || !content) {
                return;
            }

            const title = document.createElement("span");
            title.className = "index-section-toggle__title";
            while (heading.firstChild) {
                title.appendChild(heading.firstChild);
            }

            const label = document.createElement("span");
            label.className = "index-section-toggle__state";
            label.setAttribute("aria-hidden", "true");

            const button = document.createElement("button");
            button.type = "button";
            button.className = "index-section-toggle";
            button.appendChild(title);
            button.appendChild(label);
            button.addEventListener("click", () => {
                setExpanded(section, content.hidden);
            });

            heading.appendChild(button);
            setExpanded(section, section.dataset.indexSection === openSection);
        });
    }

    function initializeLegacyHiddenContent() {
        document.querySelectorAll(".hidden").forEach((content) => {
            const button = document.createElement("button");
            button.textContent = "Zobrazit";

            button.addEventListener("click", () => {
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                    button.textContent = "Zobrazit";
                } else {
                    content.style.maxHeight = `${content.scrollHeight}px`;
                    button.textContent = "Skrýt";
                }
            });

            content.parentNode.insertBefore(button, content);
        });
    }

    if (sections.length) {
        initializeIndexSections();
    } else {
        initializeLegacyHiddenContent();
    }
})();
