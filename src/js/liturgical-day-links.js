(() => {
    const target = document.getElementById("liturgical-day-links");
    const api = window.CzechLiturgicalCalendar;

    if (!api) {
        return;
    }

    let sectionStartPages = {};

    const AVAILABLE_DATE_PAGES = new Set([
        "01_18", "01_25", "02_02", "02_11", "02_22", "03_04", "03_19", "03_25",
        "04_23", "04_25", "05_01", "05_03", "05_14", "05_16", "05_30", "05_31",
        "06_01", "06_11", "06_13", "06_15", "06_24", "06_29", "07_03", "07_04",
        "07_05", "07_11", "07_13", "07_14", "07_22", "07_25", "07_26", "07_29",
        "07_31", "08_06", "08_08", "08_10", "08_11", "08_15", "08_16", "08_22",
        "08_24", "08_25", "08_29", "09_08",
        "09_14", "09_15", "09_16", "09_21", "09_28", "09_29", "10_02", "10_04",
        "10_07", "10_15", "10_18", "10_28", "11_01", "11_02", "11_09", "11_11",
        "11_13", "11_17", "11_18", "11_21", "11_30", "12_06", "12_08", "12_26",
        "12_27", "12_28",
    ]);

    const SYMBOL_LINKS = {
        ash_wednesday: [{ file: "popelecni_streda", title: "Popeleční středa" }],
        palm_sunday: [{ file: "kvetna_nedele", title: "Květná neděle" }],
        good_friday: [{ file: "velky_patek", title: "Velký pátek" }],
        holy_saturday: [{ file: "zmrtvychvstani_vigilie", title: "Velikonoční vigilie" }],
        easter_sunday: [{ file: "zmrtvychvstani_slavnost", title: "Zmrtvýchvstání Páně" }],
        ascension: [{ file: "nanebevstoupeni", title: "Nanebevstoupení Páně" }],
        pentecost: [{ file: "seslani_sv_ducha_slavnost", title: "Seslání Ducha svatého" }],
        holy_trinity: [{ file: "nejsvetejsi_trojice", title: "Nejsvětější Trojice" }],
        corpus_christi: [{ file: "tela_a_krve_pane", title: "Těla a krve Páně" }],
        sacred_heart: [{ file: "nejsvetejsiho_srdce", title: "Nejsvětějšího Srdce Ježíšova" }],
        immaculate_heart: [{ file: "neposkvrnene_srdce_panny_marie", title: "Neposkvrněného Srdce Panny Marie" }],
        christ_king: [{ file: "jezise_krista_krale", title: "Ježíše Krista Krále" }],
        bvm_unity: [{ file: "01_18", title: "Panny Marie, Matky jednoty křesťanů" }],
        paul_conversion: [{ file: "01_25", title: "Obrácení sv. Pavla, apoštola" }],
        presentation_of_lord: [{ file: "02_02", title: "Uvedení Páně do chrámu" }],
        bvm_lourdes: [{ file: "02_11", title: "Panny Marie Lurdské" }],
        chair_of_peter: [{ file: "02_22", title: "Stolce svatého apoštola Petra" }],
        casimir: [{ file: "03_04", title: "Sv. Kazimíra" }],
        joseph: [{ file: "03_19", title: "Sv. Josefa, Snoubence Panny Marie" }],
        annunciation: [{ file: "03_25", title: "Zvěstování Páně" }],
        adalbert: [{ file: "04_23", title: "Sv. Vojtěcha, biskupa a mučedníka" }],
        mark: [{ file: "04_25", title: "Sv. Marka, evangelisty" }],
        joseph_worker: [{ file: "05_01", title: "Sv. Josefa, dělníka" }],
        philip_james: [{ file: "05_03", title: "Sv. Filipa a Jakuba, apoštolů" }],
        matthias: [{ file: "05_14", title: "Sv. Matěje, apoštola" }],
        john_nepomuk: [{ file: "05_16", title: "Sv. Jana Nepomuckého, kněze a mučedníka" }],
        zdislava: [{ file: "05_30", title: "Sv. Zdislavy" }],
        visitation: [{ file: "05_31", title: "Navštívení Panny Marie" }],
        justin: [{ file: "06_01", title: "Sv. Justina, mučedníka" }],
        barnabas: [{ file: "06_11", title: "Sv. Barnabáše, apoštola" }],
        anthony_of_padua: [{ file: "06_13", title: "Sv. Antonína z Padovy, kněze a učitele církve" }],
        vitus: [{ file: "06_15", title: "Sv. Víta, mučedníka" }],
        baptist_birth: [{ file: "06_24", title: "Narození sv. Jana Křtitele" }],
        peter_paul: [{ file: "06_29", title: "Sv. Petra a Pavla, apoštolů" }],
        thomas_apostle: [{ file: "07_03", title: "Sv. Tomáše, apoštola" }],
        procopius: [{ file: "07_04", title: "Sv. Prokopa, opata" }],
        cyril_methodius: [{ file: "07_05", title: "Sv. Cyrila, mnicha, a Metoděje, biskupa, patronů Evropy" }],
        benedict: [{ file: "07_11", title: "Sv. Benedikta, opata, patrona Evropy" }],
        henry: [{ file: "07_13", title: "Sv. Jindřicha" }],
        hroznata: [{ file: "07_14", title: "Bl. Hroznaty, mučedníka" }],
        mary_magdalene: [{ file: "07_22", title: "Sv. Marie Magdalény" }],
        james: [{ file: "07_25", title: "Sv. Jakuba, apoštola" }],
        joachim_anne: [{ file: "07_26", title: "Sv. Jáchyma a Anny, rodičů Panny Marie" }],
        martha_mary_lazarus: [{ file: "07_29", title: "Sv. Marty" }],
        ignatius_of_loyola: [{ file: "07_31", title: "Sv. Ignáce z Loyoly, kněze" }],
        transfiguration: [{ file: "08_06", title: "Proměnění Páně" }],
        dominic: [{ file: "08_08", title: "Sv. Dominika, kněze" }],
        lawrence: [{ file: "08_10", title: "Sv. Vavřince, jáhna a mučedníka" }],
        clare: [{ file: "08_11", title: "Sv. Kláry, panny" }],
        assumption: [{ file: "08_15", title: "Nanebevzetí Panny Marie" }],
        stephen_hungary: [{ file: "08_16", title: "Sv. Štěpána Uherského" }],
        bvm_queenship: [{ file: "08_22", title: "Panny Marie Královny" }],
        bartholomew: [{ file: "08_24", title: "Sv. Bartoloměje, apoštola" }],
        louis: [{ file: "08_25", title: "Sv. Ludvíka" }],
        baptist_beheading: [{ file: "08_29", title: "Umučení sv. Jana Křtitele" }],
        bvm_birth: [{ file: "09_08", title: "Narození Panny Marie" }],
        cross: [{ file: "09_14", title: "Povýšení svatého kříže" }],
        bvm_sorrows: [{ file: "09_15", title: "Panny Marie Bolestné" }],
        ludmila: [{ file: "09_16", title: "Sv. Ludmily, mučednice" }],
        matthew: [{ file: "09_21", title: "Sv. Matouše, apoštola a evangelisty" }],
        wenceslaus: [{ file: "09_28", title: "Sv. Václava, mučedníka, hlavního patrona českého národa" }],
        archangels: [{ file: "09_29", title: "Sv. Michaela, Gabriela a Rafaela, archandělů" }],
        guardian_angels: [{ file: "10_02", title: "Svatých andělů strážných" }],
        francis_assisi: [{ file: "10_04", title: "Sv. Františka z Assisi" }],
        bvm_rosary: [{ file: "10_07", title: "Panny Marie Růžencové" }],
        teresa_avila: [{ file: "10_15", title: "Sv. Terezie od Ježíše, panny a učitelky církve" }],
        luke: [{ file: "10_18", title: "Sv. Lukáše, evangelisty" }],
        simon_jude: [{ file: "10_28", title: "Sv. Šimona a Judy, apoštolů" }],
        all_saints: [{ file: "11_01", title: "Všech svatých" }],
        all_souls: [{ file: "11_02", title: "Vzpomínka na všechny věrné zemřelé" }],
        lateran_basilica: [{ file: "11_09", title: "Posvěcení lateránské baziliky" }],
        martin: [{ file: "11_11", title: "Sv. Martina, biskupa" }],
        agnes_of_bohemia: [{ file: "11_13", title: "Sv. Anežky České, panny" }],
        elizabeth_of_hungary: [{ file: "11_17", title: "Sv. Alžběty Uherské, řeholnice" }],
        peter_paul_basilicas: [{ file: "11_18", title: "Posvěcení římských bazilik svatých apoštolů Petra a Pavla" }],
        bvm_presentation: [{ file: "11_21", title: "Zasvěcení Panny Marie v Jeruzalémě" }],
        andrew: [{ file: "11_30", title: "Sv. Ondřeje, apoštola" }],
        nicholas: [{ file: "12_06", title: "Sv. Mikuláše, biskupa" }],
        bvm_immaculate: [{ file: "12_08", title: "Panny Marie, počaté bez poskvrny prvotního hříchu" }],
        stephen: [{ file: "12_26", title: "Sv. Štěpána, prvomučedníka" }],
        john_evangelist: [{ file: "12_27", title: "Sv. Jana, apoštola a evangelisty" }],
        innocents: [{ file: "12_28", title: "Svatých Mláďátek, mučedníků" }],
        mother_of_god: [{ file: "leden_01", title: "Matky Boží, Panny Marie" }],
        epiphany: [{ file: "zjeveni_pane", title: "Zjevení Páně" }],
        baptism_of_lord: [{ file: "krtu_pane", title: "Křtu Páně" }],
        holy_family: [{ file: "svate_rodiny", title: "Svaté rodiny" }],
        nativity: [
            { file: "narozeni_vigilie", title: "Narození Páně – Vigilie" },
            { file: "narozeni_v_noci", title: "Narození Páně – V noci" },
            { file: "narozeni_za_svitani", title: "Narození Páně – Za svítání" },
            { file: "narozeni_ve_dne", title: "Narození Páně – Ve dne" },
        ],
    };

    const LENT_WEEKDAY_PAGES = new Set([
        "popelecni_streda_X4", "popelecni_streda_X5", "popelecni_streda_X6",
        "pust_01_X1", "pust_01_X2", "pust_01_X3", "pust_01_X4", "pust_01_X5", "pust_01_X6",
        "pust_02_X1", "pust_02_X2", "pust_02_X3", "pust_02_X4", "pust_02_X5", "pust_02_X6",
        "pust_03_X1", "pust_03_X2", "pust_03_X3", "pust_03_X4", "pust_03_X5", "pust_03_X6",
        "pust_04_X1", "pust_04_X2", "pust_04_X3", "pust_04_X4", "pust_04_X5", "pust_04_X6",
        "pust_05_X1", "pust_05_X2", "pust_05_X3", "pust_05_X4", "pust_05_X5", "pust_05_X6",
    ]);

    const HOLY_WEEKDAY_LINKS = {
        1: [{ file: "pondeli_sv_tydne", title: "Pondělí Svatého týdne" }],
        2: [{ file: "utery_sv_tydne", title: "Úterý Svatého týdne" }],
        3: [{ file: "streda_sv_tydne", title: "Středa Svatého týdne" }],
        4: [
            { file: "ctvrtek_sv_tydne", title: "Čtvrtek Svatého týdne – mše při svěcení olejů" },
            { file: "zeleny_ctvrtek", title: "Zelený čtvrtek – večerní mše" },
        ],
    };

    const SECTION_CODE_LINKS = {
        pas: { file: "o_duchovnich_pastyrich", title: "O duchovních pastýřích" },
        "pas(mis)": { file: "o_duchovnich_pastyrich", title: "O duchovních pastýřích (o misionářích)" },
        muc: { file: "o_mucednicich", title: "O mučednících" },
        pan: { file: "o_pannach", title: "O pannách" },
        mar_1: { file: "o_panne_marii_1", title: "O Panně Marii I" },
        mar_2: { file: "o_panne_marii_2", title: "O Panně Marii II" },
        reh: { file: "o_reholnicich", title: "O řeholnících" },
        svat: { file: "o_svatych", title: "O svatých" },
        mil: { file: "o_svatych_milosrdnych", title: "O svatých milosrdných" },
        uc: { file: "o_ucitelich_cirkve", title: "O učitelích církve" },
        vych: { file: "o_vychovatelich", title: "O vychovatelích" },
    };

    const MEMORIAL_SECTION_CODES = {"basil_gregory":["uc","pas"],"neumann":["pas","reh"],"raymond":["pas","reh"],"hilary":["uc","pas"],"anthony_of_egypt":["reh"],"fabian":["muc","pas"],"sebastian":["muc"],"agnes":["pan","muc"],"vincent_deacon":["muc"],"francis_de_sales":["uc","pas"],"timothy_titus":["pas"],"merici":["pan"],"aquinas":["uc","pas"],"bosco":["vych","pas"],"blase":["muc","pas"],"ansgar":["pas(mis)"],"agatha":["pan","muc"],"paul_miki":["muc"],"jerome_emiliani":["vych"],"scholastica":["pan","reh"],"servite_founders":["reh"],"peter_damian":["uc","pas"],"polycarp":["muc","pas"],"perpetua_felicity":["muc"],"john_of_god":["mil","reh"],"frances_of_rome":["svat"],"ogilvie":["muc","pas"],"hofbauer":["pas","reh"],"patrick":["pas"],"cyril_of_jerusalem":["uc","pas"],"turibius":["pas"],"francis_of_paola":["reh"],"isidore":["uc","pas"],"vincent_ferrer":["pas"],"de_la_salle":["vych","pas"],"stanislaus":["muc","pas"],"martin_i":["muc","pas"],"anselm":["uc","pas"],"george":["muc"],"fidelis":["muc","pas"],"peter_chanel":["pas(mis)"],"catherine_of_siena":["pan","reh"],"sigismund":["muc"],"pius_v":["pas"],"athanasius":["uc","pas"],"sarkander":["muc","pas"],"bvm_mediatrix":["mar_1"],"nereus_achilleus":["muc"],"pancras":["muc"],"john_i":["muc","pas"],"bernardine":["reh","pas"],"bede_venerable":["uc","pas"],"gregory_vii":["pas"],"de_pazzi":["pan"],"neri":["vych","pas"],"augustine_of_canterbury":["pas"],"marcellinus_peter":["muc"],"ugandan_martyrs":["muc"],"boniface":["muc","pas"],"ephrem":["uc"],"romuald":["reh"],"aloysius":["reh"],"paulinus":["pas"],"fisher_more":["muc"],"cyril_of_alexandria":["uc","pas"],"irenaeus":["muc","pas"],"first_martyrs_of_rome":["muc"],"goretti":["pan","muc"],"camillus_de_lellis":["mil"],"bonaventure":["uc","pas"],"bvm_mount_carmel":["mar_2","mar_1"],"ceslaus_hyacinth":["pas","reh"],"lawrence_of_brindisi":["uc","pas","reh"],"birgitta":["reh"],"gorazd":["pas"],"peter_chrysologus":["uc","pas"],"alphonsus":["uc","pas"],"eusebius":["pas"],"vianney":["pas"],"mary_major":["mar_2","mar_1"],"sixtus_ii":["muc"],"cajetan":["pas","reh"],"pontian_hippolytus":["muc","pas"],"kolbe":["muc","pas"],"eudes":["pas","reh"],"bernard":["uc","reh"],"pius_x":["pas"],"rose_lima":["pan","reh"],"five_camaldolese":["muc","reh"],"joseph_calasanz":["pas","vych"],"monica":["svat"],"augustine":["uc","pas"],"gregory_great":["uc","pas"],"grodecky":["muc","pas"],"spinola":["muc","pas"],"john_chrysostom":["uc","pas"],"cornelius_cyprian":["muc","pas"],"bellarmine":["uc","pas"],"januarius":["muc","pas"],"korean_martyrs":["muc"],"cosmas_damian":["muc"],"vincent_de_paul":["mil","pas"],"jerome":["uc","pas"],"therese_lisieux":["pan"],"denis":["muc"],"leonardi":["mil","pas"],"radim":["pas"],"callistus_i":["muc","pas"],"hedwig":["svat","reh"],"alacoque":["pan","reh"],"ignatius_of_antioch":["muc","pas"],"brebeuf_jogues":["muc","pas"],"paul_of_cross":["pas","reh"],"john_capistrano":["pas","reh"],"claret":["pas(mis)","reh"],"wolfgang":["pas"],"de_porres":["reh"],"borromeo":["pas"],"leo_great":["pas","uc"],"josaphat":["muc","pas"],"albert":["uc","pas"],"margaret_of_scotland":["mil"],"gertrude":["pan","reh"],"cecilia":["pan","muc"],"clement_i":["muc","pas"],"columban":["pas","reh"],"vietnamese_martyrs":["muc"],"campion":["muc","pas","reh"],"francis_xavier":["pas(mis)"],"john_damascene":["uc","pas"],"ambrose":["uc","pas"],"damasus_i":["pas"],"de_chantal":["reh"],"lucy":["pan","muc"],"john_of_cross":["uc","reh"],"canisius":["uc","pas"],"john_of_kanty":["pas","mil"],"becket":["muc","pas"],"sylvester_i":["pas"]};

    function pad2(value) {
        return String(value).padStart(2, "0");
    }

    function localDateOnly(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

    function addDays(date, days) {
        const copy = localDateOnly(date);
        copy.setDate(copy.getDate() + days);
        return copy;
    }

    function nextSunday(date) {
        const days = date.getDay() === 0 ? 7 : 7 - date.getDay();
        return addDays(date, days);
    }

    function previousSunday(date) {
        const days = date.getDay() === 0 ? -7 : -date.getDay();
        return addDays(date, days);
    }

    function datePageKey(date) {
        return `${pad2(date.getMonth() + 1)}_${pad2(date.getDate())}`;
    }

    function pageLink(file, title) {
        return { href: `${file}.html`, title };
    }

    function linkStartPage(link) {
        const slug = link.href.replace(/\.html$/, "");
        return sectionStartPages[slug];
    }

    function linksFromSymbol(feast) {
        const symbol = feast && (feast.Symbol || feast.Id);
        return (SYMBOL_LINKS[symbol] || []).map((link) => pageLink(link.file, link.title || feast.Title));
    }

    function generalSectionLinksForFeast(feast) {
        const symbol = feast && (feast.Symbol || feast.Id);
        return (MEMORIAL_SECTION_CODES[symbol] || [])
            .map((code) => SECTION_CODE_LINKS[code])
            .filter(Boolean)
            .map((link) => pageLink(link.file, link.title));
    }

    function linksForFeast(feast) {
        return linksFromSymbol(feast).length ? linksFromSymbol(feast) : generalSectionLinksForFeast(feast);
    }

    function displayedFeast(data) {
        const feasts = data.FeastsInDay || [];
        return feasts.find((feast) => linksFromSymbol(feast).length) ||
            feasts.find((feast) => generalSectionLinksForFeast(feast).length) ||
            feasts.find((feast) => feast.Source === "sanctorale") ||
            feasts[0] ||
            {};
    }

    function linksFromFixedDate(data, date) {
        const key = datePageKey(date);
        if (!AVAILABLE_DATE_PAGES.has(key)) {
            return [];
        }

        const sanctoraleFeast = (data.FeastsInDay || []).find((feast) => feast.Source === "sanctorale");
        return sanctoraleFeast ? [pageLink(key, sanctoraleFeast.Title)] : [];
    }

    function lentWeekdayLinks(data, date) {
        if (data.Season !== "lent" || date.getDay() === 0) {
            return [];
        }

        const week = Number(data.SeasonWeek);
        const weekday = date.getDay();
        const feast = (data.FeastsInDay || [])[0] || {};

        if (week === 6) {
            return (HOLY_WEEKDAY_LINKS[weekday] || []).map((link) => pageLink(link.file, link.title));
        }

        let file = null;
        if (week === 0 && weekday >= 4 && weekday <= 6) {
            file = `popelecni_streda_X${weekday}`;
        } else if (week >= 1 && week <= 5 && weekday >= 1 && weekday <= 6) {
            file = `pust_${pad2(week)}_X${weekday}`;
        }

        return file && LENT_WEEKDAY_PAGES.has(file) ? [pageLink(file, feast.Title || data.SeasonTitle)] : [];
    }

    function sundayLinks(data) {
        const feast = (data.FeastsInDay || [])[0] || {};
        const week = Number(data.SeasonWeek);
        const cycle = data.SundayCycle;
        let file = null;

        if (data.Season === "advent" && week >= 1 && week <= 4) {
            file = `advent_${week}`;
        } else if (data.Season === "christmas" && week === 2) {
            file = "vanoce_2";
        } else if (data.Season === "lent" && week >= 1 && week <= 5) {
            if (week === 4) {
                file = `pust_04_${cycle}`;
            } else if (week === 5) {
                file = cycle === "C" ? "pust_05_C" : "pust_05_AB";
            } else {
                file = `pust_${pad2(week)}`;
            }
        } else if (data.Season === "easter" && week >= 2 && week <= 7) {
            file = `velikonoce_${week}`;
        } else if (data.Season === "ordinary" && week >= 2 && week <= 33) {
            file = `mezidobi_${pad2(week)}_${cycle}`;
        }

        return file ? [pageLink(file, feast.Title || data.SeasonTitle)] : [];
    }

    function displayRank(feast) {
        if (!feast) {
            return null;
        }

        const symbol = feast.Symbol || feast.Id;
        if (["nativity", "epiphany", "ascension", "pentecost"].includes(symbol)) {
            return "slavnost";
        }
        if (symbol === "ash_wednesday") {
            return "jiné";
        }
        if (symbol === "palm_sunday" || feast.Sunday) {
            return "neděle";
        }
        if ((feast.Title || "").includes("Svatého týdne")) {
            return "svatý týden";
        }
        if ((feast.Title || "").includes("oktávu velikonočním")) {
            return "velikonoční oktáv";
        }

        return feast.Rank || null;
    }

    function optionalMemorialFerialEntry(data) {
        if (data.Season === "lent") {
            return null;
        }

        const feasts = data.FeastsInDay || [];
        const feria = feasts.find((feast) => feast.Rank === "ferie");
        const nonFerialFeasts = feasts.filter((feast) => feast !== feria);

        if (!feria || !nonFerialFeasts.length) {
            return null;
        }

        const onlyOptionalMemorials = nonFerialFeasts.every((feast) => feast.Rank === "nezávazná památka");
        if (!onlyOptionalMemorials) {
            return null;
        }

        return {
            title: feria.Title || data.SeasonTitle,
            rank: displayRank(feria),
            links: [],
        };
    }

    function linkedFeastEntries(data, date, requireSundayLink) {
        const ferialEntry = optionalMemorialFerialEntry(data);
        const feastEntries = (data.FeastsInDay || [])
            .map((feast) => ({
                title: feast.Title,
                rank: displayRank(feast),
                links: linksForFeast(feast),
            }))
            .filter((entry) => entry.links.length);

        if (feastEntries.length) {
            return ferialEntry ? [ferialEntry, ...feastEntries] : feastEntries;
        }

        const fallbackFeast = displayedFeast(data);

        const fixedDateLinks = linksFromFixedDate(data, date);
        if (fixedDateLinks.length) {
            return [{
                title: fallbackFeast.Title || data.SeasonTitle,
                rank: displayRank(fallbackFeast),
                links: fixedDateLinks,
            }];
        }

        const lentLinks = lentWeekdayLinks(data, date);
        if (lentLinks.length) {
            return [{
                title: fallbackFeast.Title || data.SeasonTitle,
                rank: displayRank(fallbackFeast),
                links: lentLinks,
            }];
        }

        if (requireSundayLink || date.getDay() === 0) {
            const links = sundayLinks(data);
            if (links.length) {
                return [{
                    title: fallbackFeast.Title || data.SeasonTitle,
                    rank: displayRank(fallbackFeast),
                    links,
                }];
            }
        }

        return [{
            title: fallbackFeast.Title || data.SeasonTitle,
            rank: displayRank(fallbackFeast),
            links: [],
        }];
    }

    function findLinks(data, date, requireSundayLink) {
        for (const feast of data.FeastsInDay || []) {
            const symbolLinks = linksFromSymbol(feast);
            if (symbolLinks.length) {
                return symbolLinks;
            }
        }

        for (const feast of data.FeastsInDay || []) {
            const generalLinks = generalSectionLinksForFeast(feast);
            if (generalLinks.length) {
                return generalLinks;
            }
        }

        const fixedDateLinks = linksFromFixedDate(data, date);
        if (fixedDateLinks.length) {
            return fixedDateLinks;
        }

        const lentLinks = lentWeekdayLinks(data, date);
        if (lentLinks.length) {
            return lentLinks;
        }

        if (requireSundayLink || date.getDay() === 0) {
            return sundayLinks(data);
        }

        return [];
    }

    function dayInfo(calendar, date, label, requireSundayLink) {
        const result = calendar.GetFeastsForDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
        const data = result.Data;
        const entries = linkedFeastEntries(data, date, requireSundayLink);
        const firstEntry = entries[0] || {};

        return {
            label,
            date,
            title: firstEntry.title || data.SeasonTitle,
            rank: firstEntry.rank || null,
            links: firstEntry.links || [],
            entries,
            current: label === "Dnes",
        };
    }

    function formatDate(date) {
        return new Intl.DateTimeFormat("cs-CZ", {
            weekday: "long",
            day: "numeric",
            month: "numeric",
            year: "numeric",
        }).format(date);
    }

    function cycleInfo(calendar, date) {
        const result = calendar.GetFeastsForDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
        const data = result.Data;
        return `Nedělní cyklus ${data.SundayCycle} · Feriální cyklus ${data.WeekdayCycle}`;
    }

    function renderLinkList(item) {
        const linkWrap = document.createElement("div");
        linkWrap.className = "liturgical-day-link__links";

        if (!item.links.length) {
            const missing = document.createElement("span");
            missing.className = "liturgical-day-link__missing";
            missing.textContent = "V MZ není pro tento den samostatná stránka.";
            linkWrap.appendChild(missing);
            return linkWrap;
        }

        item.links.forEach((link) => {
            const linkItem = document.createElement("span");
            linkItem.className = "liturgical-day-link__link-item";

            const anchor = document.createElement("a");
            anchor.href = link.href;
            anchor.textContent = link.title;
            linkItem.appendChild(anchor);

            const page = linkStartPage(link);
            if (page) {
                const pageEl = document.createElement("span");
                pageEl.className = "liturgical-day-link__page";
                pageEl.textContent = `(${page})`;
                linkItem.appendChild(pageEl);
            }

            linkWrap.appendChild(linkItem);
        });

        return linkWrap;
    }

    function renderEntry(entry) {
        const entryEl = document.createElement("div");
        entryEl.className = "liturgical-day-link__entry";

        const title = document.createElement("strong");
        title.className = "liturgical-day-link__title";
        title.textContent = entry.title;
        entryEl.appendChild(title);

        if (entry.rank) {
            const rank = document.createElement("div");
            rank.className = "liturgical-day-link__rank";
            rank.textContent = entry.rank;
            entryEl.appendChild(rank);
        }

        entryEl.appendChild(renderLinkList(entry));
        return entryEl;
    }

    function render(items, cycles) {
        target.replaceChildren();

        const heading = document.createElement("h2");
        heading.textContent = "Aktuální liturgie";
        target.appendChild(heading);

        const cycleEl = document.createElement("div");
        cycleEl.className = "liturgical-day-links__cycles";
        cycleEl.textContent = cycles;
        target.appendChild(cycleEl);

        const list = document.createElement("div");
        list.className = "liturgical-day-links__items";

        items.forEach((item) => {
            const card = document.createElement("article");
            card.className = "liturgical-day-link";
            if (item.current) {
                card.classList.add("liturgical-day-link--current");
            }

            const label = document.createElement("div");
            label.className = "liturgical-day-link__label";
            label.textContent = item.label;

            const title = document.createElement("strong");
            title.className = "liturgical-day-link__title";
            title.textContent = item.title;

            const date = document.createElement("div");
            date.className = "liturgical-day-link__date";
            date.textContent = formatDate(item.date);

            card.append(label);

            if (item.entries.length > 1) {
                card.appendChild(date);

                const entries = document.createElement("div");
                entries.className = "liturgical-day-link__entries";
                item.entries.forEach((entry) => {
                    entries.appendChild(renderEntry(entry));
                });
                card.appendChild(entries);
            } else {
                card.append(title, date);

                if (item.rank) {
                    const rank = document.createElement("div");
                    rank.className = "liturgical-day-link__rank";
                    rank.textContent = item.rank;
                    card.appendChild(rank);
                }

                card.appendChild(renderLinkList(item));
            }
            list.appendChild(card);
        });

        target.appendChild(list);
    }

    async function loadSectionStartPages() {
        if (typeof fetch !== "function") {
            return;
        }

        try {
            const response = await fetch("assets/data/section_start_pages.json");
            if (response.ok) {
                sectionStartPages = await response.json();
            }
        } catch (_error) {
            sectionStartPages = {};
        }
    }

    async function initialize() {
        await loadSectionStartPages();

        const calendar = api.createCzechCalendar();
        const today = localDateOnly(currentDate());
        const items = [
            dayInfo(calendar, previousSunday(today), "Předcházející neděle", true),
            dayInfo(calendar, today, "Dnes", false),
        ];

        if (today.getDay() === 0) {
            items.push(dayInfo(calendar, nextSunday(today), "Následující neděle", true));
        } else {
            items.push(dayInfo(calendar, nextSunday(today), "Následující neděle", true));
        }

        render(items, cycleInfo(calendar, today));
    }

    window.MZLiturgicalDayLinks = {
        datePageKey,
        findLinks,
        currentDate,
        lentWeekdayLinks,
        nextSunday,
        previousSunday,
        sundayLinks,
    };

    if (target) {
        initialize();
    }
})();
