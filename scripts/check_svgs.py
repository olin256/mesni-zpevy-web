import glob
from lxml import etree

def check_invalid_svg_files(directory):
    svg_files = glob.glob(f"{directory}/*.svg")
    for filepath in svg_files:
        try:
            with open(filepath, 'rb') as f:
                etree.parse(f)
        except etree.XMLSyntaxError as e:
            print(f"[XML ERROR] {filepath} - {e}")
        except Exception as e:
            print(f"[OTHER FAIL] {filepath} - {e}")

# Použití: zadej cestu ke složce
check_invalid_svg_files("../build/tmp/svg/")
