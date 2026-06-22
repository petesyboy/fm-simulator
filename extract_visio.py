import win32com.client
import os

visio = win32com.client.Dispatch("Visio.Application")
visio.Visible = False
visio.AlertResponse = 1 # Suppress alerts

stencils = [
    "ms-vs-gigamon-g-tap-stencils.vss",
    "ms-vs-gigamon-gigavue-fm-stencils.vss",
    "ms-vs-gigamon-gigavue-hc-series-stencils.vss",
    "ms-vs-gigamon-gigavue-ta-series-stencils.vss"
]

out_dir = os.path.abspath("public/hardware-icons/visio")
os.makedirs(out_dir, exist_ok=True)

for stencil in stencils:
    doc_path = os.path.abspath(os.path.join("public datasheets", stencil))
    print(f"Opening {doc_path}...")
    try:
        doc = visio.Documents.OpenEx(doc_path, 4) # 4 = visOpenHidden
        print(f"Opened {stencil}. Iterating masters...")
        for master in doc.Masters:
            name = master.NameU or master.Name
            safe_name = "".join(c if c.isalnum() else "_" for c in name)
            out_path = os.path.join(out_dir, f"{safe_name}.svg")
            try:
                master.Export(out_path)
                print(f"Exported {name} -> {safe_name}.svg")
            except Exception as e:
                print(f"Failed to export {name}: {e}")
        doc.Close()
    except Exception as e:
        print(f"Failed to process {stencil}: {e}")

visio.Quit()
print("Done!")
