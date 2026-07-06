from glob import iglob
from os.path import basename
import re

with open("../src/templates/html_template.html", "r", encoding="utf-8") as f:
    html_template = f.read()

html_template = re.sub(r"<!--.*?-->", "" , html_template)

for fname in iglob("../src/pages/*.html"):
    base_fname = basename(fname)

    with open(fname, "r", encoding="utf-8") as f:
        main_content = f.read()

    m = re.search("<h1>(.*?)</h1>", main_content)
    title = m[1].strip()

    full_title = f"{title} | Mešní zpěvy online"
    
    html_out = html_template

    if base_fname == "hledani.html":
        html_out = html_out.replace(
            '<link rel="stylesheet" href="assets/css/style.css" />',
            '<link rel="stylesheet" href="assets/css/style.css" />\n'
            '    <link rel="stylesheet" href="assets/css/table.css" />\n'
            '    <link rel="stylesheet" href="assets/css/search.css" />',
            1
        )
        html_out = html_out.replace(
            '<main class="container">',
            '<main class="container search-page">',
            1
        )
    
    html_out = html_out.replace("</title>", f"{full_title}</title>", 1)
    for mt in ['property="og:title"', 'name="twitter:title"']:
        html_out = html_out.replace(
            f'<meta {mt} content="Mešní zpěvy online">',
            f'<meta {mt} content="{full_title}">',
            1
        )
        
    html_out = html_out.replace(
        '<meta property="og:url" content="https://mesnizpevy.cz/">',
        f'<meta property="og:url" content="https://mesnizpevy.cz/{base_fname}">',
        1
    )

    html_out = html_out.replace("</main>", f"{main_content}\n</main>", 1)

    if base_fname == "hledani.html":
        html_out = html_out.replace(
            "</body>",
            '<script src="assets/js/search.js" '
            'data-index="assets/data/search_index.json" '
            'data-links="assets/data/occurrences.json"></script>\n'
            '</body>',
            1
        )

    with open(f"../dist/{base_fname}", "w", encoding="utf-8") as f:
        f.write(html_out)
