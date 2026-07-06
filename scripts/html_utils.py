def strip_comments(node):
    for c in node.xpath("//comment()"):
        c.getparent().remove(c)