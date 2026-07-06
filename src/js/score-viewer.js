if (window.location.hash) {
    window.scrollTo(0, 0); // Nastaví pozici na začátek
}

// Najde všechny elementy s třídou '.swiper-slide'
const svgContainers = document.querySelectorAll('.swiper-slide');

// Pole pro uložení všech fetch operací
const fetchPromises = Array.from(svgContainers).map((container) => {
    const svgPath = container.dataset.svg;

    if (svgPath) {
        const svgDir = svgPath.startsWith("K") ? "assets/korejs" : "assets/svg";
        const svgFullPath = `${svgDir}/${svgPath}.svg`;
        return fetch(svgFullPath)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Chyba při načítání ${svgPath}: ${response.statusText}`);
                }
                return response.text();
            })
            .then((svgContent) => {
                // Vloží načtené SVG jako vnitřní HTML do divu
                container.innerHTML = svgContent;

                // Najde právě vložený <svg>
                const svg = container.querySelector('svg');

                // Najde element <text> s font-weight="bold"
                const boldText = svg.querySelector('text[font-weight="bold"]');

                // Pokud existuje, změní jeho obsah
                if (boldText) {
                    const numValue = container.dataset.num;
                    if (numValue !== undefined) {
                        boldText.textContent = `${numValue}.`;
                    }
                }
            })
            .catch((error) => {
                console.error(`Nepodařilo se načíst SVG:`, error);
            });
    } else {
        // Pokud `data-svg` neexistuje nebo je prázdný, vrátí splněný Promise
        return Promise.resolve();
    }
});

// Čeká na dokončení všech fetch operací
Promise.all(fetchPromises)
    .then(() => {
        const targetId = window.location.hash.substring(1);
        if (targetId) {
            const target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        }
    })
    .catch((error) => {
        console.error('Chyba při načítání některého SVG:', error);
    });


// Vyber všechny Swiper kontejnery na stránce
document.querySelectorAll('.swiper-container').forEach((container) => {
    new Swiper(container, {
        loop: true,
        navigation: {
            // Navigační prvky relativně k aktuálnímu kontejneru
            nextEl: container.querySelector('.swiper-button-next'),
            prevEl: container.querySelector('.swiper-button-prev'),
        },
    });
});

