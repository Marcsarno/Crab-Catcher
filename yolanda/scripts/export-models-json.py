# Converts every bundled model (src/models/**/*.glb|.gltf) into a self-contained glTF JSON
# file named .json under <out>/assets/ — used by the single-file share build, whose host
# only serves standard web file types. Usage: python3 scripts/export-models-json.py <outdir>
import base64, json, os, struct, sys
out = sys.argv[1]
n = 0
for root, _, files in os.walk('src/models'):
    for f in files:
        src = os.path.join(root, f)
        rel = os.path.relpath(src, 'src/models')
        dst = os.path.join(out, 'assets', os.path.splitext(rel)[0] + '.json')
        if f.endswith('.glb'):
            b = open(src, 'rb').read()
            jl = struct.unpack_from('<I', b, 12)[0]
            js = json.loads(b[20:20 + jl])
            off = 20 + jl
            bl = struct.unpack_from('<I', b, off)[0]
            binc = b[off + 8: off + 8 + bl]
            js['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(binc).decode()
        elif f.endswith('.gltf'):
            js = json.load(open(src))
        else:
            continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        json.dump(js, open(dst, 'w'), separators=(',', ':'))
        n += 1
print(f'wrote {n} model json files to {out}/assets')
