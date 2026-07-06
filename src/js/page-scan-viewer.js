const viewer = document.querySelector('.scan-viewer');

if (viewer) {
    const firstPage = Number.parseInt(viewer.dataset.firstPage, 10);
    const lastPage = Number.parseInt(viewer.dataset.lastPage, 10);
    const defaultPage = Number.parseInt(viewer.dataset.defaultPage, 10);
    const currentPageEl = document.getElementById('scan-current-page');
    const scanSwiperEl = viewer.querySelector('.scan-swiper');
    const pages = Array.from(
        { length: lastPage - firstPage + 1 },
        (_, index) => firstPage + index
    );
    const navigationInset = 10;
    let swiper;

    function clampPage(page) {
        if (Number.isNaN(page)) return defaultPage;
        return Math.min(Math.max(page, firstPage), lastPage);
    }

    function getInitialPage() {
        const params = new URLSearchParams(window.location.search);
        return clampPage(Number.parseInt(params.get('pg'), 10));
    }

    function padPage(page) {
        return String(page).padStart(3, '0');
    }

    function updateUrl(page, replace = false) {
        const url = new URL(window.location.href);
        url.searchParams.set('pg', page);
        const method = replace ? 'replaceState' : 'pushState';
        window.history[method]({ page }, '', url);
    }

    function renderSlide(page) {
        const padded = padPage(page);
        return `
            <div class="swiper-slide" data-page="${page}">
                <img
                    src="assets/images/page_scans/${padded}.png"
                    loading="lazy"
                    alt="Sken strany ${page}"
                >
            </div>
        `;
    }

    function setCurrentPage(page, replace = false) {
        if (currentPageEl) {
            currentPageEl.textContent = page;
        }
        updateUrl(page, replace);
    }

    function updateNavigationPosition() {
        const activeSlide = scanSwiperEl.querySelector('.swiper-slide-active');
        const image = activeSlide?.querySelector('img');
        const target = image || activeSlide || scanSwiperEl;
        const rect = target?.getBoundingClientRect();

        if (!rect || rect.width <= 0) return;

        scanSwiperEl.style.setProperty(
            '--scan-prev-left',
            `${Math.max(navigationInset, rect.left + navigationInset)}px`
        );
        scanSwiperEl.style.setProperty(
            '--scan-next-right',
            `${Math.max(navigationInset, window.innerWidth - rect.right + navigationInset)}px`
        );
    }

    function scheduleNavigationPositionUpdate() {
        window.requestAnimationFrame(() => {
            if (swiper?.animating) return;
            updateNavigationPosition();
        });
    }

    const initialPage = getInitialPage();
    let restoringHistory = false;
    swiper = new Swiper('.scan-swiper', {
        initialSlide: initialPage - firstPage,
        navigation: {
            nextEl: '.scan-swiper .swiper-button-next',
            prevEl: '.scan-swiper .swiper-button-prev',
        },
        virtual: {
            slides: pages,
            addSlidesBefore: 1,
            addSlidesAfter: 1,
            renderSlide,
        },
    });

    setCurrentPage(initialPage, true);
    scheduleNavigationPositionUpdate();

    swiper.on('slideChange', () => {
        if (!restoringHistory) {
            setCurrentPage(firstPage + swiper.activeIndex);
        }
        scheduleNavigationPositionUpdate();
    });

    swiper.on('slideChangeTransitionEnd', scheduleNavigationPositionUpdate);
    swiper.on('transitionEnd', scheduleNavigationPositionUpdate);

    scanSwiperEl.addEventListener('load', (event) => {
        if (event.target.tagName === 'IMG') {
            scheduleNavigationPositionUpdate();
        }
    }, true);

    window.addEventListener('resize', scheduleNavigationPositionUpdate);

    window.addEventListener('orientationchange', () => {
        window.setTimeout(scheduleNavigationPositionUpdate, 100);
    });

    window.addEventListener('popstate', () => {
        const page = getInitialPage();
        restoringHistory = true;
        swiper.slideTo(page - firstPage);
        restoringHistory = false;
        if (currentPageEl) {
            currentPageEl.textContent = page;
        }
        scheduleNavigationPositionUpdate();
    });
}
