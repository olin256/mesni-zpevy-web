(function() {
    const root = document.documentElement;
    const button = document.querySelector('.theme-toggle');
    const icon = button?.querySelector('.theme-toggle__icon');
    const storageKey = 'mz-theme';
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    if (!button || !icon) {
        return;
    }

    function storedTheme() {
        try {
            return localStorage.getItem(storageKey);
        } catch (error) {
            return null;
        }
    }

    function effectiveTheme() {
        const theme = storedTheme();
        if (theme === 'dark' || theme === 'light') {
            return theme;
        }
        return media.matches ? 'dark' : 'light';
    }

    function applyButtonState() {
        const theme = effectiveTheme();
        icon.textContent = theme === 'dark' ? '☀' : '☾';
        button.setAttribute(
            'aria-label',
            theme === 'dark'
                ? 'Přepnout do světlého režimu'
                : 'Přepnout do tmavého režimu'
        );
        button.setAttribute(
            'title',
            theme === 'dark'
                ? 'Přepnout do světlého režimu'
                : 'Přepnout do tmavého režimu'
        );
    }

    button.addEventListener('click', function() {
        const nextTheme = effectiveTheme() === 'dark' ? 'light' : 'dark';
        root.dataset.theme = nextTheme;
        try {
            localStorage.setItem(storageKey, nextTheme);
        } catch (error) {}
        applyButtonState();
    });

    media.addEventListener?.('change', applyButtonState);
    applyButtonState();
}());
