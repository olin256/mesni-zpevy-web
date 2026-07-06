\version "2.24.0"
\pointAndClickOff

\paper {
    #(set-paper-size "a0")
    line-width = 12\cm
    print-page-number = ##f  % zruseni vypisovani cisla strany
    indent = 0  % zruseni odsazeni prvniho radku
    top-margin = 0  % zruseni odsazeni od vrchu strany
    ragged-last-bottom = ##t
    ragged-bottom = ##t
    property-defaults.fonts.serif = "C059"
    % SYSTEM_COUNT
}

\header {
    tagline = ""  % odstraneni textu v paticce strany
}

\layout {
    \context {
        \Score
        autoBeaming = ##f
        \remove "Bar_number_engraver"  % odstraneni cisla taktu
        \override BreathingSign.text = #(make-musicglyph-markup "scripts.rvarcomma")
        % TIME
        % BREAKS
    }
}

% MUSIC

% LYRICS

% SCORE

\score {
    \new Staff <<
        \new Voice = "soprano" <<
            \soprano
        >>
        \new Lyrics \lyricsto "soprano" % VERSE
    >>
    \layout {}
}
