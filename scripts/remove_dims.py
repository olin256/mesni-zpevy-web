import os
import xml.etree.ElementTree as ET

# Cesta ke složce se SVG soubory
svg_folder = '../dist/assets/svg/'  # změň podle potřeby

# Projdi všechny soubory ve složce
for filename in os.listdir(svg_folder):
    if filename.lower().endswith('.svg'):
        filepath = os.path.join(svg_folder, filename)
        
        # Načti SVG jako XML
        tree = ET.parse(filepath)
        root = tree.getroot()

        # Odstraň atributy width a height
        if 'width' in root.attrib:
            del root.attrib['width']
        if 'height' in root.attrib:
            del root.attrib['height']

        # Ulož změny zpět do souboru
        tree.write(filepath, encoding='utf-8', xml_declaration=True)
        print(f'Upraveno: {filename}')
