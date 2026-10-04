# Side-by-side strip of screenshots (each scaled to 390x844), optionally with the concept mockup last.
import sys
from PIL import Image
out_path, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB').resize((390, 844)) for f in files]
out = Image.new('RGB', (390 * len(ims), 844))
for i, im in enumerate(ims):
    out.paste(im, (i * 390, 0))
out.save(out_path)
