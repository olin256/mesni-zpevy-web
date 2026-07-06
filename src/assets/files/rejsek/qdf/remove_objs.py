import glob
import pikepdf
import os


for fname in glob.glob("no_annot/*.pdf"):

    out_fname = os.path.join("./final", os.path.basename(fname))

    pdf = pikepdf.Pdf.open(fname)

    for obj_id, obj in enumerate(pdf.objects):
        if obj is not None:  # může obsahovat None (smazané objekty)
            obj_str = str(obj)
            if "textedit" in obj_str:
                # print(f"Nalezen objekt {obj_id} s '/Watermark'")
                # například smazat:
                del pdf.objects[obj_id]

    pdf.save(out_fname)

    # with open(out_fname, "wb") as f:
        # f.write(new_fcont)