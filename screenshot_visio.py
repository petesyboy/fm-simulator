import win32com.client
import os
import time
from PIL import ImageGrab

try:
    visio = win32com.client.Dispatch("Visio.Application")
    visio.Visible = True
    
    time.sleep(2)
    
    doc_path = os.path.abspath(r"public datasheets\ms-vs-gigamon-gigavue-ta-series-stencils.vss")
    
    import threading
    
    def take_screenshot():
        print("Waiting 5 seconds to take screenshot...")
        time.sleep(5)
        im = ImageGrab.grab()
        im.save("visio_screenshot.png")
        print("Screenshot saved to visio_screenshot.png")
        
    t = threading.Thread(target=take_screenshot)
    t.start()
    
    print("Opening doc...")
    doc = visio.Documents.OpenEx(doc_path, 0)
    print("Opened doc successfully!")
    
    t.join()
    visio.Quit()
    
except Exception as e:
    print("Exception:", e)
