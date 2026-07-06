import glob
import re
import os


def to_spaces(m):
    inner = re.sub(rb"\S", b" ", m[0])
    # return m[1] + inner + m[3]
    return inner

for fname in glob.glob("*.pdf"):

    out_fname = os.path.join("./no_annot", os.path.basename(fname))

    with open(fname, "rb") as f:
        fcont = f.read()

    new_fcont = re.sub(rb"/Annots \[.*?\]", to_spaces, fcont, flags=re.DOTALL)

    with open(out_fname, "wb") as f:
        f.write(new_fcont)