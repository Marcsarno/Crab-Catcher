"""Builds every 3D model for Hollowdeep in Blender and exports GLB files.

Run: blender -b --python tools/blender_models.py   (from hollowdeep/)

Conventions
- Blender Z up, characters face +Y (becomes Godot -Z forward after glTF export).
- Characters are split into parts with origins at their joints so Godot can
  animate them procedurally: root > legs/torso > head/arms > weapon.
"""
import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "models")
os.makedirs(OUT, exist_ok=True)
MATS = {}


# ------------------------------------------------------------------ helpers
def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.objects):
        for b in list(coll):
            if b.users == 0:
                coll.remove(b)


def mat(name, color, rough=0.85, metal=0.0, emit=None, emit_strength=2.0):
    key = name
    if key in MATS and MATS[key].name in bpy.data.materials:
        return MATS[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*srgb(color), 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*srgb(emit), 1)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    MATS[key] = m
    return m


def srgb(c):
    def f(x):
        x = x / 255.0
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return tuple(f(v) for v in c)


def _finish(ob, m):
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if m is not None:
        ob.data.materials.append(m)
    return ob


def box(loc, size, m=None, rot=(0, 0, 0), taper=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.scale = size
    if taper:
        # taper = (sx, sy) multiplier for the top (+Z local) face
        for v in ob.data.vertices:
            if v.co.z > 0:
                v.co.x *= taper[0]
                v.co.y *= taper[1]
    return _finish(ob, m)


def cyl(loc, r, depth, m=None, rot=(0, 0, 0), seg=8, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    return _finish(bpy.context.active_object, m)


def cone(loc, r, depth, m=None, rot=(0, 0, 0), seg=8):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r, radius2=0, depth=depth, location=loc, rotation=rot)
    return _finish(bpy.context.active_object, m)


def sph(loc, r, m=None, scale=(1, 1, 1), seg=10, smooth=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(4, seg // 2), radius=r, location=loc)
    ob = bpy.context.active_object
    ob.scale = scale
    if smooth:
        bpy.ops.object.shade_smooth()
    return _finish(ob, m)


def torus(loc, r, t, m=None, rot=(0, 0, 0), seg=12):
    bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=6, major_radius=r, minor_radius=t, location=loc, rotation=rot)
    return _finish(bpy.context.active_object, m)


def limb(a, b, r0, r1, m=None, seg=6):
    """Tapered cylinder from point a to point b."""
    a = Vector(a)
    b = Vector(b)
    d = b - a
    mid = (a + b) / 2
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r0, radius2=r1, depth=d.length, location=mid)
    ob = bpy.context.active_object
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return _finish(ob, m)


def join(objs, name, pivot=(0, 0, 0)):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    ob.data.name = name
    bpy.context.scene.cursor.location = pivot
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return ob


def parent(child, par):
    mw = child.matrix_world.copy()
    child.parent = par
    child.matrix_world = mw


def empty(name, loc=(0, 0, 0)):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=loc)
    e = bpy.context.active_object
    e.name = name
    return e


def export(name):
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=False, export_yup=True, export_materials="EXPORT")
    print("EXPORTED", path)


# ---------------------------------------------------------------- materials
def M():
    return dict(
        bone=mat("bone", (196, 186, 160), 0.7),
        bone_dark=mat("bone_dark", (120, 108, 86), 0.8),
        rust=mat("rust", (96, 60, 40), 0.6, 0.5),
        iron=mat("iron", (90, 92, 98), 0.45, 0.8),
        steel=mat("steel", (170, 174, 182), 0.3, 0.9),
        gold=mat("gold", (210, 160, 60), 0.3, 1.0),
        leather=mat("leather", (70, 44, 28), 0.8),
        leather_dark=mat("leather_dark", (40, 26, 18), 0.85),
        cloth_red=mat("cloth_red", (110, 22, 20), 0.95),
        cloth_brown=mat("cloth_brown", (78, 60, 40), 0.95),
        cloth_grey=mat("cloth_grey", (90, 88, 84), 0.95),
        cloth_green=mat("cloth_green", (40, 70, 46), 0.95),
        cloth_black=mat("cloth_black", (22, 20, 22), 0.95),
        cloth_blue=mat("cloth_blue", (34, 44, 90), 0.95),
        wood=mat("wood", (96, 62, 36), 0.85),
        wood_dark=mat("wood_dark", (52, 34, 22), 0.9),
        stone=mat("stone", (110, 104, 96), 0.95),
        stone_dark=mat("stone_dark", (64, 60, 56), 0.95),
        skin=mat("skin", (196, 150, 120), 0.7),
        skin_ghoul=mat("skin_ghoul", (118, 128, 98), 0.75),
        skin_imp=mat("skin_imp", (156, 52, 30), 0.65),
        skin_brute=mat("skin_brute", (196, 150, 140), 0.6),
        flesh=mat("flesh", (130, 30, 28), 0.5),
        blood=mat("blood", (90, 6, 6), 0.3),
        eye_yellow=mat("eye_yellow", (255, 210, 80), 0.5, emit=(255, 200, 60), emit_strength=4),
        eye_red=mat("eye_red", (255, 40, 20), 0.5, emit=(255, 30, 10), emit_strength=5),
        eye_green=mat("eye_green", (80, 255, 120), 0.5, emit=(60, 255, 110), emit_strength=6),
        flame=mat("flame", (255, 160, 40), 0.5, emit=(255, 140, 30), emit_strength=6),
        horn=mat("horn", (40, 32, 28), 0.5),
        hair_white=mat("hair_white", (210, 206, 198), 0.9),
        hair_brown=mat("hair_brown", (70, 46, 28), 0.9),
        potion_red=mat("potion_red", (200, 20, 20), 0.15, emit=(150, 0, 0), emit_strength=1.5),
        potion_blue=mat("potion_blue", (30, 60, 220), 0.15, emit=(10, 40, 200), emit_strength=1.5),
        glass=mat("glass", (200, 210, 220), 0.1),
        paper=mat("paper", (210, 196, 160), 0.9),
        straw=mat("straw", (170, 140, 70), 0.95),
        plaster=mat("plaster", (180, 168, 144), 0.95),
        roof=mat("roof", (70, 50, 40), 0.9),
        leaf=mat("leaf", (40, 50, 30), 0.9),
        black=mat("black", (6, 6, 6), 1.0),
        water=mat("water", (20, 30, 40), 0.1),
    )


# ------------------------------------------------------------ humanoid rig
def humanoid(c, mt):
    """Generic segmented humanoid.  c: dict of proportions & materials.
    Returns dict of part objects (already parented)."""
    H = c.get("height", 1.8)
    s = H / 1.8
    hip = 0.92 * s
    sh = 1.48 * s
    w = c.get("width", 1.0)
    skin = c["skin"]
    root = empty("root")

    # legs (origin at hip joint)
    legs = {}
    for side, sx in (("l", -1), ("r", 1)):
        x = 0.11 * s * w * sx
        parts = []
        lm = c.get("leg_mat", skin)
        parts.append(limb((x, 0, hip), (x, 0.02, hip * 0.5), c.get("thigh", 0.075) * s * w, c.get("knee", 0.06) * s, lm))
        parts.append(limb((x, 0.02, hip * 0.5), (x, 0, 0.07 * s), c.get("knee", 0.06) * s, c.get("ankle", 0.045) * s, c.get("shin_mat", lm)))
        parts.append(box((x, 0.05 * s, 0.035 * s), (0.1 * s, 0.22 * s, 0.07 * s), c.get("foot_mat", lm)))
        if c.get("boots"):
            parts.append(cyl((x, 0, 0.2 * s), 0.07 * s, 0.3 * s, c["boots"]))
        legs[side] = join(parts, "leg_" + side, (x, 0, hip))
        parent(legs[side], root)

    # torso (origin at hip)
    tparts = []
    tw = c.get("torso_w", 0.36) * s * w
    td = c.get("torso_d", 0.22) * s * w
    tm = c.get("torso_mat", skin)
    tparts.append(box((0, 0, hip + 0.06 * s), (tw * 0.9, td * 0.9, 0.18 * s), c.get("pelvis_mat", tm)))
    tparts.append(box((0, 0, (hip + sh) / 2 + 0.04 * s), (tw, td, (sh - hip) * 0.8), tm, taper=(1.15, 1.05)))
    if c.get("belly"):
        tparts.append(sph((0, td * 0.3, hip + 0.3 * s), 0.2 * s * w * c["belly"], tm, (1.0, 0.9, 1.0), 10, True))
    for extra in c.get("torso_extra", []):
        tparts.append(extra(s, hip, sh, tw, td))
    torso = join(tparts, "torso", (0, 0, hip))
    parent(torso, root)

    # head (origin at neck)
    neck = sh + 0.03 * s
    hparts = []
    hs = c.get("head_size", 1.0)
    hparts.append(limb((0, 0, sh - 0.02 * s), (0, 0, neck + 0.08 * s), 0.05 * s, 0.045 * s, skin))
    hparts.append(sph((0, 0.01 * s, neck + 0.14 * s * hs), 0.12 * s * hs, c.get("head_mat", skin), c.get("head_scale", (0.9, 1.0, 1.1)), 10))
    ey = c.get("eye_mat", mt["black"])
    for sx in (-1, 1):
        hparts.append(sph((0.042 * s * hs * sx, 0.1 * s * hs, neck + 0.16 * s * hs), 0.022 * s * hs, ey, (1, 1, 1), 6))
    for extra in c.get("head_extra", []):
        hparts.append(extra(s, neck, hs))
    head = join(hparts, "head", (0, 0, neck))
    parent(head, torso)

    # arms (origin at shoulder)
    arms = {}
    al = c.get("arm_len", 1.0)
    for side, sx in (("l", -1), ("r", 1)):
        x = (tw * 0.5 + 0.05 * s) * sx * 1.05
        am = c.get("arm_mat", skin)
        elbow = (x + 0.02 * sx * s, 0.03 * s, sh - 0.3 * s * al)
        hand = (x + 0.02 * sx * s, 0.08 * s, sh - 0.58 * s * al)
        parts = [
            sph((x, 0, sh - 0.02 * s), 0.07 * s * w, c.get("shoulder_mat", am), (1, 1, 1), 8),
            limb((x, 0, sh), elbow, c.get("upper_arm", 0.055) * s * w, 0.045 * s, am),
            limb(elbow, hand, 0.045 * s, 0.035 * s, c.get("fore_mat", am)),
            sph(hand, 0.048 * s, c.get("hand_mat", skin), (1, 1.1, 1.2), 6),
        ]
        if c.get("claws"):
            for k in (-1, 0, 1):
                parts.append(cone((hand[0] + k * 0.025 * s, hand[1] + 0.04 * s, hand[2] - 0.07 * s), 0.012 * s, 0.1 * s, mt["horn"], (math.radians(180 - 20), 0, 0), 4))
        arms[side] = join(parts, "arm_" + side, (x, 0, sh))
        parent(arms[side], torso)
        arms[side + "_hand"] = hand

    # held items
    if c.get("weapon_r"):
        wpn = c["weapon_r"](arms["r_hand"], s)
        wpn = join(wpn, "weapon", arms["r_hand"])
        parent(wpn, arms["r"])
    if c.get("weapon_l"):
        wl = c["weapon_l"](arms["l_hand"], s)
        wl = join(wl, "offhand", arms["l_hand"])
        parent(wl, arms["l"])

    # hunch / posture baked into rest transforms
    torso.rotation_euler.x = math.radians(c.get("hunch", 0))
    for side in ("l", "r"):
        arms[side].rotation_euler.x = math.radians(c.get("arm_fwd", 10))
    return dict(root=root, torso=torso, head=head, arm_l=arms["l"], arm_r=arms["r"], leg_l=legs["l"], leg_r=legs["r"])


# ------------------------------------------------------------ weapon parts
def w_sword(mt, length=0.85, blade="steel"):
    def f(hand, s):
        x, y, z = hand
        # held pointing forward-up (+Y,+Z) out of the fist
        p = []
        p.append(cyl((x, y, z), 0.022 * s, 0.18 * s, mt["leather_dark"], (math.radians(-60), 0, 0), 6))
        d = Vector((0, math.cos(math.radians(30)), math.sin(math.radians(30))))
        base = Vector(hand) + d * 0.09 * s
        p.append(box(tuple(base), (0.24 * s, 0.04 * s, 0.04 * s), mt["iron"], (math.radians(-60), 0, 0)))
        tip = base + d * length * s
        p.append(limb(tuple(base), tuple(tip), 0.04 * s, 0.006 * s, mt[blade], 4))
        return p
    return f


def w_cleaver(mt):
    def f(hand, s):
        x, y, z = hand
        p = [cyl((x, y, z), 0.035 * s, 0.32 * s, mt["wood_dark"], (math.radians(-60), 0, 0), 6)]
        d = Vector((0, math.cos(math.radians(30)), math.sin(math.radians(30))))
        b0 = Vector(hand) + d * 0.18 * s
        mid = b0 + d * 0.35 * s
        p.append(box(tuple(mid + Vector((0, 0.06, -0.12)) * s), (0.04 * s, 0.75 * s, 0.4 * s), mt["rust"], (math.radians(-60), 0, 0)))
        p.append(box(tuple(mid + Vector((0, 0.1, -0.24)) * s), (0.045 * s, 0.6 * s, 0.06 * s), mt["blood"], (math.radians(-60), 0, 0)))
        return p
    return f


def w_spear(mt):
    def f(hand, s):
        x, y, z = hand
        p = [cyl((x, y + 0.15 * s, z + 0.25 * s), 0.018 * s, 1.1 * s, mt["wood"], (math.radians(-60), 0, 0), 5)]
        d = Vector((0, math.cos(math.radians(30)), math.sin(math.radians(30))))
        tip = Vector((x, y + 0.15 * s, z + 0.25 * s)) + d * 0.6 * s
        p.append(limb(tuple(tip), tuple(tip + d * 0.22 * s), 0.04 * s, 0.0, mt["rust"], 4))
        return p
    return f


def w_staff(mt, orb):
    def f(hand, s):
        x, y, z = hand
        p = [cyl((x, y, z + 0.3 * s), 0.025 * s, 1.9 * s, mt["wood_dark"], (0, 0, 0), 6)]
        top = (x, y, z + 1.25 * s)
        for k in range(3):
            a = k * 2.09
            p.append(limb((x, y, z + 1.1 * s), (x + math.cos(a) * 0.09 * s, y + math.sin(a) * 0.09 * s, z + 1.32 * s), 0.015 * s, 0.006 * s, mt["bone"], 4))
        p.append(sph(top, 0.08 * s, orb, (1, 1, 1), 10, True))
        return p
    return f


def w_bow(mt):
    def f(hand, s):
        x, y, z = hand
        p = []
        pts = []
        for i in range(7):
            t = (i / 6 - 0.5) * 2
            pts.append(Vector((x, y + 0.08 * s - abs(t) ** 2 * 0.18 * s, z + t * 0.55 * s)))
        for i in range(6):
            p.append(limb(tuple(pts[i]), tuple(pts[i + 1]), 0.02 * s, 0.02 * s, mt["wood"], 5))
        p.append(limb(tuple(pts[0]), tuple(pts[-1]), 0.004 * s, 0.004 * s, mt["paper"], 3))
        return p
    return f


def w_shield_small(mt):
    def f(hand, s):
        x, y, z = hand
        p = [cyl((x - 0.05 * s, y + 0.04 * s, z + 0.05 * s), 0.2 * s, 0.04 * s, mt["wood_dark"], (0, math.radians(90), 0), 10)]
        p.append(sph((x - 0.08 * s, y + 0.04 * s, z + 0.05 * s), 0.05 * s, mt["rust"], (0.6, 1, 1), 8))
        p.append(torus((x - 0.06 * s, y + 0.04 * s, z + 0.05 * s), 0.19 * s, 0.015 * s, mt["rust"], (0, math.radians(90), 0)))
        return p
    return f


def w_dagger(mt):
    def f(hand, s):
        x, y, z = hand
        d = Vector((0, math.cos(math.radians(30)), math.sin(math.radians(30))))
        p = [cyl((x, y, z), 0.018 * s, 0.12 * s, mt["leather_dark"], (math.radians(-60), 0, 0), 5)]
        b = Vector(hand) + d * 0.06 * s
        p.append(limb(tuple(b), tuple(b + d * 0.3 * s), 0.03 * s, 0.003 * s, mt["rust"], 4))
        return p
    return f


# -------------------------------------------------------------- characters
def build_ghoul(mt):
    reset()

    def rags(s, hip, sh, tw, td):
        return box((0, 0, hip - 0.05 * s), (tw * 1.05, td * 1.1, 0.28 * s), mt["cloth_brown"], taper=(0.95, 0.95))

    def ribs(s, hip, sh, tw, td):
        parts = [box((0, td * 0.5, hip + 0.42 * s + k * 0.08 * s), (tw * 0.8, 0.02 * s, 0.025 * s), mt["skin_ghoul"]) for k in range(3)]
        return join(parts, "ribs_tmp")

    def jaw(s, neck, hs):
        return box((0, 0.07 * s, neck + 0.05 * s), (0.12 * s, 0.1 * s, 0.05 * s), mt["flesh"])

    def hair(s, neck, hs):
        return sph((0, -0.02 * s, neck + 0.2 * s), 0.11 * s, mt["hair_brown"], (0.95, 1.0, 0.6), 8)

    humanoid(dict(height=1.8, skin=mt["skin_ghoul"], hunch=28, arm_len=1.2, arm_fwd=35, claws=True,
                  torso_w=0.32, torso_d=0.2, thigh=0.06, knee=0.05, upper_arm=0.045,
                  eye_mat=mt["eye_yellow"], torso_extra=[rags, ribs], head_extra=[jaw, hair],
                  leg_mat=mt["skin_ghoul"]), mt)
    export("ghoul")


def build_imp(mt):
    reset()

    def horns(s, neck, hs):
        p = []
        for sx in (-1, 1):
            p.append(limb((0.07 * s * sx, 0.0, neck + 0.24 * s), (0.17 * s * sx, -0.06 * s, neck + 0.42 * s), 0.035 * s, 0.004 * s, mt["horn"], 5))
            p.append(cone((0.13 * s * sx, 0.0, neck + 0.16 * s), 0.04 * s, 0.14 * s, mt["skin_imp"], (0, math.radians(-75 * sx), 0), 4))
        p.append(box((0, 0.12 * s, neck + 0.08 * s), (0.11 * s, 0.08 * s, 0.05 * s), mt["horn"]))
        return join(p, "horn_tmp")

    def tail(s, hip, sh, tw, td):
        p = [limb((0, -td * 0.4, hip), (0, -0.35 * s, hip - 0.25 * s), 0.04 * s, 0.02 * s, mt["skin_imp"], 5),
             limb((0, -0.35 * s, hip - 0.25 * s), (0, -0.55 * s, hip - 0.2 * s), 0.02 * s, 0.006 * s, mt["skin_imp"], 5),
             cone((0, -0.58 * s, hip - 0.19 * s), 0.05 * s, 0.1 * s, mt["horn"], (math.radians(-90), 0, 0), 4)]
        return join(p, "tail_tmp")

    def loin(s, hip, sh, tw, td):
        return box((0, 0, hip - 0.02 * s), (tw * 1.02, td * 1.05, 0.16 * s), mt["leather_dark"])

    humanoid(dict(height=1.15, skin=mt["skin_imp"], hunch=18, head_size=1.45, arm_len=1.05, arm_fwd=25, claws=True,
                  torso_w=0.32, torso_d=0.24, belly=0.6, eye_mat=mt["eye_red"], head_extra=[horns],
                  torso_extra=[tail, loin], weapon_r=w_spear(mt), head_scale=(1.0, 1.05, 0.95)), mt)
    export("imp")


def build_skeleton(mt, archer=False):
    reset()

    def ribcage(s, hip, sh, tw, td):
        p = [limb((0, -td * 0.3, hip), (0, -td * 0.3, sh), 0.03 * s, 0.03 * s, mt["bone"], 6)]
        for k in range(5):
            z = hip + 0.25 * s + k * 0.07 * s
            p.append(torus((0, 0, z), tw * 0.42 * (1 - abs(k - 2) * 0.08), 0.014 * s, mt["bone"], (0, 0, 0), 10))
        p.append(torus((0, 0, hip + 0.04 * s), tw * 0.36, 0.03 * s, mt["bone"], (0, 0, 0), 10))
        p.append(box((0, 0, sh - 0.01 * s), (tw * 1.05, 0.06 * s, 0.03 * s), mt["bone"]))
        if not archer:
            p.append(box((0, 0, hip + 0.05 * s), (tw * 0.95, td * 1.0, 0.22 * s), mt["cloth_red"], taper=(0.9, 0.9)))
        else:
            p.append(box((0, 0, hip + 0.05 * s), (tw * 0.95, td * 1.0, 0.22 * s), mt["cloth_green"], taper=(0.9, 0.9)))
            p.append(cyl((0.08 * s, -td * 0.7, sh - 0.25 * s), 0.06 * s, 0.5 * s, mt["leather"], (math.radians(15), math.radians(20), 0), 6))
        return join(p, "rib_tmp")

    def skull(s, neck, hs):
        p = [box((0, 0.06 * s, neck + 0.06 * s), (0.11 * s, 0.09 * s, 0.05 * s), mt["bone_dark"])]
        if not archer:
            p.append(sph((0, 0, neck + 0.2 * s), 0.13 * s, mt["rust"], (1, 1.05, 0.65), 10))
        else:
            p.append(cone((0, -0.02 * s, neck + 0.24 * s), 0.16 * s, 0.28 * s, mt["cloth_green"], (math.radians(-10), 0, 0), 8))
        return join(p, "skull_tmp")

    humanoid(dict(height=1.78, skin=mt["bone"], hunch=6, thigh=0.03, knee=0.028, ankle=0.022, upper_arm=0.028,
                  torso_w=0.3, torso_d=0.18, torso_mat=None if False else mt["bone"], eye_mat=mt["eye_red"],
                  torso_extra=[ribcage], head_extra=[skull], head_scale=(0.85, 1.0, 1.05), arm_fwd=20,
                  weapon_r=None if archer else w_sword(mt, 0.75, "rust"),
                  weapon_l=w_bow(mt) if archer else w_shield_small(mt)), mt)
    # thin out the torso slab: replace with spine look by shrinking the default box
    t = bpy.data.objects["torso"]
    export("skeleton_archer" if archer else "skeleton")


def build_cultist(mt):
    reset()

    def robe(s, hip, sh, tw, td):
        p = [cyl((0, 0, hip * 0.55), 0.32 * s, hip * 1.15, mt["cloth_black"], (0, 0, 0), 10, r2=0.17 * s),
             box((0, td * 0.52, (hip + sh) / 2), (0.08 * s, 0.01 * s, (sh - hip) * 0.9), mt["cloth_red"])]
        return join(p, "robe_tmp")

    def hood(s, neck, hs):
        p = [cone((0, -0.03 * s, neck + 0.22 * s), 0.17 * s, 0.42 * s, mt["cloth_black"], (math.radians(-12), 0, 0), 8),
             sph((0, 0.02 * s, neck + 0.12 * s), 0.13 * s, mt["cloth_black"], (1.05, 1.0, 1.0), 8)]
        return join(p, "hood_tmp")

    humanoid(dict(height=1.85, skin=mt["skin"], torso_mat=mt["cloth_black"], arm_mat=mt["cloth_black"], hunch=4,
                  head_mat=mt["black"], eye_mat=mt["eye_yellow"], torso_extra=[robe], head_extra=[hood],
                  leg_mat=mt["cloth_black"], arm_fwd=15, weapon_r=w_dagger(mt)), mt)
    export("cultist")


def build_brute(mt):
    """Level 2 boss: The Flayer."""
    reset()

    def apron(s, hip, sh, tw, td):
        p = [box((0, td * 0.75, hip + 0.05 * s), (tw * 0.9, 0.03 * s, 0.9 * s), mt["leather"]),
             box((0, td * 0.78, hip + 0.1 * s), (tw * 0.5, 0.035 * s, 0.35 * s), mt["blood"]),
             box((0, 0, sh - 0.12 * s), (tw * 1.02, td * 1.02, 0.04 * s), mt["leather_dark"]),
             ]
        for k in range(5):
            p.append(cone((-tw * 0.4 + k * tw * 0.2, td * 0.6, hip - 0.4 * s), 0.02 * s, 0.12 * s, mt["iron"], (math.radians(180), 0, 0), 4))
        # meat hooks on the belt
        for sx in (-1, 1):
            p.append(torus((sx * tw * 0.55, td * 0.2, hip - 0.05 * s), 0.06 * s, 0.01 * s, mt["iron"], (0, math.radians(90), 0), 8))
        return join(p, "apron_tmp")

    def mask(s, neck, hs):
        p = [box((0, 0.1 * s, neck + 0.15 * s), (0.22 * s, 0.06 * s, 0.18 * s), mt["rust"]),
             box((0, 0.13 * s, neck + 0.17 * s), (0.18 * s, 0.02 * s, 0.02 * s), mt["black"]),
             box((0, 0.13 * s, neck + 0.07 * s), (0.02 * s, 0.02 * s, 0.1 * s), mt["iron"]),
             ]
        for k in range(4):
            p.append(cone((-0.09 * s + k * 0.06 * s, -0.02 * s, neck + 0.27 * s), 0.015 * s, 0.08 * s, mt["iron"], (0, 0, 0), 4))
        return join(p, "mask_tmp")

    humanoid(dict(height=2.7, width=1.55, skin=mt["skin_brute"], belly=1.15, hunch=12, head_size=0.9,
                  torso_w=0.42, torso_d=0.3, thigh=0.09, knee=0.075, upper_arm=0.07, arm_len=1.05, arm_fwd=25,
                  eye_mat=mt["eye_red"], torso_extra=[apron], head_extra=[mask], leg_mat=mt["leather_dark"],
                  fore_mat=mt["skin_brute"], weapon_r=w_cleaver(mt), boots=mt["leather_dark"]), mt)
    export("brute")


def build_matron(mt):
    """Level 3 boss: The Hollow Matron."""
    reset()

    def robe(s, hip, sh, tw, td):
        p = [cyl((0, 0, hip * 0.45), 0.5 * s, hip * 1.2, mt["cloth_grey"], (0, 0, 0), 12, r2=0.2 * s)]
        for k in range(6):
            a = k / 6 * math.pi * 2
            p.append(cone((math.cos(a) * 0.45 * s, math.sin(a) * 0.45 * s, -0.05 * s), 0.1 * s, 0.25 * s, mt["cloth_grey"], (math.radians(180), 0, 0), 4))
        p.append(torus((0, 0, sh - 0.05 * s), tw * 0.55, 0.05 * s, mt["bone"], (0, 0, 0), 10))
        for k in range(5):
            a = (k - 2) * 0.35
            p.append(sph((math.sin(a) * 0.22 * s, math.cos(a) * 0.12 * s + 0.04 * s, sh - 0.2 * s), 0.04 * s, mt["bone"], (1, 1, 1), 6))
        return join(p, "robe_tmp")

    def hood(s, neck, hs):
        p = [sph((0, -0.01 * s, neck + 0.15 * s), 0.17 * s, mt["cloth_grey"], (1.05, 1.1, 1.15), 10),
             box((0, 0.13 * s, neck + 0.13 * s), (0.16 * s, 0.04 * s, 0.2 * s), mt["black"]),
             cone((0, -0.06 * s, neck + 0.35 * s), 0.1 * s, 0.3 * s, mt["cloth_grey"], (math.radians(-30), 0, 0), 6)]
        for sx in (-1, 1):
            p.append(sph((0.04 * s * sx, 0.155 * s, neck + 0.16 * s), 0.022 * s, mt["eye_green"], (1, 1, 1), 6))
        return join(p, "hood_tmp")

    humanoid(dict(height=2.5, skin=mt["bone"], torso_mat=mt["cloth_grey"], arm_mat=mt["cloth_grey"], hunch=10,
                  leg_mat=mt["cloth_grey"], arm_len=1.25, arm_fwd=20, eye_mat=mt["eye_green"], claws=True,
                  torso_extra=[robe], head_extra=[hood], weapon_r=w_staff(mt, mt["eye_green"])), mt)
    export("matron")


def build_npc(mt, kind):
    reset()
    if kind == "healer":
        def robe(s, hip, sh, tw, td):
            return join([cyl((0, 0, hip * 0.5), 0.3 * s, hip * 1.05, mt["cloth_green"], (0, 0, 0), 10, r2=0.18 * s),
                         box((0, td * 0.55, hip + 0.1 * s), (tw * 0.6, 0.02 * s, 0.6 * s), mt["paper"])], "r")

        def hair(s, neck, hs):
            return join([sph((0, -0.03 * s, neck + 0.19 * s), 0.13 * s, mt["hair_brown"], (1, 1, 0.9), 10),
                         sph((0, -0.13 * s, neck + 0.23 * s), 0.07 * s, mt["hair_brown"], (1, 1, 1), 8)], "h")
        humanoid(dict(height=1.66, skin=mt["skin"], torso_mat=mt["cloth_green"], arm_mat=mt["cloth_green"], leg_mat=mt["cloth_green"],
                      torso_extra=[robe], head_extra=[hair], torso_w=0.3, arm_fwd=12), mt)
    elif kind == "smith":
        def apron(s, hip, sh, tw, td):
            return join([box((0, td * 0.56, hip + 0.1 * s), (tw * 0.9, 0.03 * s, 0.85 * s), mt["leather"])], "a")

        def beard(s, neck, hs):
            return join([box((0, 0.08 * s, neck + 0.06 * s), (0.16 * s, 0.08 * s, 0.16 * s), mt["hair_brown"], taper=(1.2, 1))], "b")

        def hammer(hand, s):
            x, y, z = hand
            return [cyl((x, y + 0.12 * s, z + 0.2 * s), 0.02 * s, 0.55 * s, mt["wood"], (math.radians(-60), 0, 0), 6),
                    box((x, y + 0.3 * s, z + 0.36 * s), (0.08 * s, 0.1 * s, 0.18 * s), mt["iron"], (math.radians(-60), 0, 0))]
        humanoid(dict(height=1.85, width=1.25, skin=mt["skin"], torso_mat=mt["cloth_brown"], leg_mat=mt["cloth_brown"],
                      torso_extra=[apron], head_extra=[beard], arm_fwd=12, weapon_r=hammer, boots=mt["leather_dark"]), mt)
    else:  # elder
        def robe(s, hip, sh, tw, td):
            return join([cyl((0, 0, hip * 0.5), 0.3 * s, hip * 1.05, mt["cloth_blue"], (0, 0, 0), 10, r2=0.18 * s)], "r")

        def beard(s, neck, hs):
            return join([box((0, 0.09 * s, neck + 0.0 * s), (0.14 * s, 0.07 * s, 0.3 * s), mt["hair_white"], taper=(1.3, 1)),
                         sph((0, -0.02 * s, neck + 0.2 * s), 0.115 * s, mt["hair_white"], (1, 1, 0.7), 8)], "b")

        def cane(hand, s):
            x, y, z = hand
            return [cyl((x, y + 0.05 * s, z - 0.35 * s), 0.02 * s, 1.0 * s, mt["wood_dark"], (0, 0, 0), 6)]
        humanoid(dict(height=1.72, skin=mt["skin"], torso_mat=mt["cloth_blue"], arm_mat=mt["cloth_blue"], leg_mat=mt["cloth_blue"],
                      hunch=12, torso_extra=[robe], head_extra=[beard], arm_fwd=12, weapon_r=cane), mt)
    export("npc_" + kind)


# ------------------------------------------------------- first person arms
def build_fp(mt):
    # right arm holding a grip at origin; grip axis = +Z (blade up)
    reset()
    p = [limb((0.05, -0.55, -0.12), (0.0, -0.08, -0.02), 0.06, 0.048, mt["cloth_red"], 8),
         cyl((0.0, -0.1, -0.02), 0.055, 0.12, mt["iron"], (math.radians(80), 0, 0), 8),
         box((0.0, 0.0, 0.0), (0.09, 0.08, 0.1), mt["leather_dark"])]
    arm = join(p, "fp_arm", (0, 0, 0))
    export("fp_arm_r")
    reset()
    p = [limb((-0.05, -0.55, -0.12), (0.0, -0.08, -0.02), 0.06, 0.048, mt["cloth_red"], 8),
         cyl((0.0, -0.1, -0.02), 0.055, 0.12, mt["iron"], (math.radians(80), 0, 0), 8),
         box((0.0, 0.0, 0.0), (0.09, 0.08, 0.1), mt["leather_dark"])]
    join(p, "fp_arm", (0, 0, 0))
    export("fp_arm_l")


def build_weapons(mt):
    """Each weapon: grip at origin, extends along +Z."""
    def save(name, parts):
        join(parts, name, (0, 0, 0))
        export(name)

    reset()
    save("wpn_sword", [cyl((0, 0, 0), 0.02, 0.2, mt["leather_dark"], seg=6), sph((0, 0, -0.11), 0.035, mt["iron"], seg=6),
                       box((0, 0, 0.11), (0.26, 0.04, 0.035), mt["iron"]),
                       limb((0, 0, 0.12), (0, 0, 0.95), 0.038, 0.004, mt["steel"], 4)])
    reset()
    save("wpn_blade", [cyl((0, 0, 0), 0.02, 0.22, mt["cloth_red"], seg=6), sph((0, 0, -0.12), 0.04, mt["gold"], seg=6),
                       box((0, 0, 0.12), (0.32, 0.05, 0.04), mt["gold"]),
                       box((0, 0, 0.62), (0.07, 0.012, 0.95), mt["steel"], taper=(0.4, 1))])
    reset()
    save("wpn_axe", [cyl((0, 0, 0.3), 0.024, 0.85, mt["wood"], seg=6),
                     box((0.1, 0, 0.62), (0.2, 0.025, 0.12), mt["iron"], taper=(1, 1)),
                     box((0.2, 0, 0.62), (0.05, 0.02, 0.3), mt["steel"])])
    reset()
    save("wpn_mace", [cyl((0, 0, 0.22), 0.025, 0.65, mt["wood_dark"], seg=6), sph((0, 0, 0.58), 0.09, mt["iron"], seg=8)] +
         [cone((math.cos(a) * 0.09, math.sin(a) * 0.09, 0.58), 0.03, 0.08, mt["iron"], (0, math.radians(90), a), 4) for a in [k * math.pi / 3 for k in range(6)]])
    reset()
    save("wpn_club", [limb((0, 0, -0.08), (0, 0, 0.7), 0.03, 0.07, mt["wood"], 7)])
    reset()
    # shield: held in left hand, facing +Y (towards the enemies / away from camera)
    save("shield_round", [cyl((0, 0.06, 0.05), 0.32, 0.05, mt["wood"], (math.radians(90), 0, 0), 12),
                          torus((0, 0.06, 0.05), 0.31, 0.022, mt["iron"], (math.radians(90), 0, 0), 14),
                          sph((0, 0.1, 0.05), 0.08, mt["iron"], (1, 0.6, 1), 8)])
    reset()
    save("shield_kite", [box((0, 0.06, 0.05), (0.5, 0.04, 0.75), mt["cloth_blue"], taper=(1.0, 1.0)),
                         box((0, 0.04, -0.4), (0.25, 0.035, 0.25), mt["cloth_blue"], (0, math.radians(45), 0)),
                         box((0, 0.085, 0.1), (0.08, 0.02, 0.6), mt["gold"]),
                         box((0, 0.085, 0.2), (0.4, 0.02, 0.08), mt["gold"])])


def build_items(mt):
    reset()
    p = []
    import random
    random.seed(3)
    for i in range(14):
        a = random.random() * math.pi * 2
        r = random.random() * 0.13
        p.append(cyl((math.cos(a) * r, math.sin(a) * r, 0.012 + 0.015 * (i % 4)), 0.045, 0.012, mt["gold"], (random.random() * 0.4, random.random() * 0.4, 0), 10))
    join(p, "gold", (0, 0, 0))
    export("item_gold")
    for nm, liquid in (("potion_red", mt["potion_red"]), ("potion_blue", mt["potion_blue"])):
        reset()
        join([sph((0, 0, 0.09), 0.08, liquid, (1, 1, 1), 12, True), cyl((0, 0, 0.19), 0.03, 0.08, mt["glass"], seg=8),
              cyl((0, 0, 0.24), 0.034, 0.03, mt["wood"], seg=8)], nm, (0, 0, 0))
        export("item_" + nm)
    reset()
    join([cyl((0, 0, 0.04), 0.04, 0.3, mt["paper"], (0, math.radians(90), 0), 10),
          cyl((0.16, 0, 0.04), 0.045, 0.02, mt["wood"], (0, math.radians(90), 0), 8),
          cyl((-0.16, 0, 0.04), 0.045, 0.02, mt["wood"], (0, math.radians(90), 0), 8),
          torus((0, 0, 0.04), 0.045, 0.008, mt["cloth_red"], (0, math.radians(90), 0), 10)], "scroll", (0, 0, 0))
    export("item_scroll")
    reset()
    join([box((0, 0, 0.3), (0.42, 0.24, 0.5), mt["iron"], taper=(1.15, 1.1)),
          box((0, 0, 0.6), (0.5, 0.26, 0.1), mt["iron"]),
          box((0, 0.13, 0.32), (0.1, 0.02, 0.4), mt["steel"])], "armor", (0, 0, 0))
    export("item_armor")
    reset()
    join([sph((0, 0, 0.12), 0.14, mt["iron"], (1, 1.1, 0.95), 10), box((0, 0.13, 0.08), (0.03, 0.04, 0.14), mt["iron"]),
          torus((0, 0, 0.06), 0.14, 0.02, mt["steel"], (0, 0, 0), 12)], "helm", (0, 0, 0))
    export("item_helm")
    reset()
    join([torus((0, 0, 0.05), 0.05, 0.012, mt["gold"], (math.radians(90), 0, 0), 14),
          sph((0, 0, 0.11), 0.022, mt["eye_red"], (1, 1, 1), 8)], "ring", (0, 0, 0))
    export("item_ring")
    reset()
    join([torus((0, 0, 0.003), 0.09, 0.006, mt["gold"], (0, 0, 0), 16),
          sph((0, 0.09, 0.012), 0.03, mt["potion_blue"], (1, 1, 0.5), 8)], "amulet", (0, 0, 0))
    export("item_amulet")


# ------------------------------------------------------------------- props
def build_props(mt):
    S = mt
    # pillar (cell is 4m, ceiling 5m)
    reset()
    join([box((0, 0, 0.25), (0.9, 0.9, 0.5), S["stone_dark"]), box((0, 0, 0.55), (0.75, 0.75, 0.1), S["stone"]),
          cyl((0, 0, 2.5), 0.3, 3.8, S["stone"], seg=8), box((0, 0, 4.5), (0.75, 0.75, 0.2), S["stone"]),
          box((0, 0, 4.8), (0.95, 0.95, 0.4), S["stone_dark"], taper=(1.3, 1.3))], "pillar", (0, 0, 0))
    export("pillar")
    # torch sconce (mounted on wall, extends toward +Y)
    reset()
    join([box((0, 0.02, 0), (0.12, 0.04, 0.22), S["iron"]), limb((0, 0.03, -0.05), (0, 0.22, 0.12), 0.015, 0.015, S["iron"], 4),
          torus((0, 0.22, 0.12), 0.05, 0.01, S["iron"], (0, 0, 0), 8),
          limb((0, 0.2, 0.0), (0, 0.24, 0.32), 0.025, 0.03, S["wood_dark"], 6),
          sph((0, 0.245, 0.34), 0.045, S["flame"], (1, 1, 1.4), 6)], "torch", (0, 0, 0))
    export("torch")
    # barrel
    reset()
    join([cyl((0, 0, 0.45), 0.34, 0.9, S["wood"], seg=12, r2=None), cyl((0, 0, 0.45), 0.37, 0.5, S["wood"], seg=12),
          torus((0, 0, 0.12), 0.35, 0.02, S["iron"], seg=14), torus((0, 0, 0.78), 0.35, 0.02, S["iron"], seg=14),
          cyl((0, 0, 0.9), 0.31, 0.02, S["wood_dark"], seg=12)], "barrel", (0, 0, 0))
    export("barrel")
    # chest: base + lid (lid hinge at back top)
    reset()
    base = join([box((0, 0, 0.25), (0.9, 0.55, 0.5), S["wood"]), box((0, 0, 0.25), (0.94, 0.58, 0.06), S["iron"]),
                 box((0, 0.29, 0.38), (0.1, 0.03, 0.14), S["gold"])], "base", (0, 0, 0))
    lid = join([box((0, 0, 0.6), (0.9, 0.55, 0.2), S["wood"]), cyl((0, 0, 0.7), 0.275, 0.92, S["wood"], (0, math.radians(90), 0), 10),
                box((-0.35, 0, 0.66), (0.06, 0.6, 0.28), S["iron"]), box((0.35, 0, 0.66), (0.06, 0.6, 0.28), S["iron"])], "lid", (0, -0.27, 0.5))
    export("chest")
    # sarcophagus
    reset()
    join([box((0, 0, 0.45), (1.0, 2.2, 0.9), S["stone"]), box((0, 0, 0.06), (1.12, 2.32, 0.12), S["stone_dark"])], "base", (0, 0, 0))
    join([box((0, 0, 1.0), (1.1, 2.3, 0.2), S["stone_dark"]), box((0, 0.2, 1.14), (0.5, 1.4, 0.1), S["stone"]),
          sph((0, 0.82, 1.18), 0.16, S["stone"], (1, 1, 0.7), 8)], "lid", (0, 0, 0.9))
    export("sarcophagus")
    # bones pile
    reset()
    import random
    random.seed(7)
    p = []
    for i in range(12):
        a = random.random() * math.pi
        x, y = random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4)
        p.append(limb((x - math.cos(a) * 0.2, y - math.sin(a) * 0.2, 0.03 + i * 0.006), (x + math.cos(a) * 0.2, y + math.sin(a) * 0.2, 0.03 + i * 0.006), 0.025, 0.025, S["bone"], 5))
    p.append(sph((0.1, 0.1, 0.1), 0.11, S["bone"], (0.9, 1.05, 1), 8))
    p.append(sph((0.1, 0.19, 0.08), 0.025, S["black"], (1, 1, 1), 5))
    join(p, "bones", (0, 0, 0))
    export("bones")
    # candelabra
    reset()
    p = [cyl((0, 0, 0.75), 0.03, 1.5, S["iron"], seg=6), cyl((0, 0, 0.03), 0.25, 0.06, S["iron"], seg=8, r2=0.1)]
    for k in range(3):
        a = k * 2.094
        tip = (math.cos(a) * 0.22, math.sin(a) * 0.22, 1.45)
        p.append(limb((0, 0, 1.3), tip, 0.012, 0.012, S["iron"], 4))
        p.append(cyl((tip[0], tip[1], tip[2] + 0.07), 0.025, 0.14, S["paper"], seg=6))
        p.append(sph((tip[0], tip[1], tip[2] + 0.17), 0.018, S["flame"], (1, 1, 1.8), 5))
    join(p, "candelabra", (0, 0, 0))
    export("candelabra")
    # altar / lectern with book
    reset()
    join([box((0, 0, 0.5), (1.6, 0.8, 1.0), S["stone"]), box((0, 0, 1.03), (1.8, 0.95, 0.08), S["stone_dark"]),
          box((0, 0, 1.1), (0.5, 0.36, 0.06), S["cloth_red"], (math.radians(-12), 0, 0)),
          box((0, 0.02, 1.13), (0.46, 0.32, 0.03), S["paper"], (math.radians(-12), 0, 0))], "altar", (0, 0, 0))
    export("altar")
    # table
    reset()
    p = [box((0, 0, 0.78), (1.6, 0.9, 0.08), S["wood"])]
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(box((sx * 0.7, sy * 0.36, 0.38), (0.08, 0.08, 0.76), S["wood_dark"]))
    join(p, "table", (0, 0, 0))
    export("table")
    # rack of spikes / cage
    reset()
    p = [box((0, 0, 0.05), (1.2, 1.2, 0.1), S["iron"]), box((0, 0, 2.4), (1.2, 1.2, 0.1), S["iron"])]
    for k in range(8):
        a = k / 8 * math.pi * 2
        p.append(cyl((math.cos(a) * 0.55, math.sin(a) * 0.55, 1.2), 0.02, 2.4, S["iron"], seg=4))
    p.append(limb((0, 0, 0.1), (0.2, 0.3, 0.5), 0.03, 0.03, S["bone"], 5))
    p.append(sph((0.1, -0.2, 0.18), 0.11, S["bone"], (0.9, 1.05, 1), 8))
    join(p, "cage", (0, 0, 0))
    export("cage")
    # meat hook chain (hangs from ceiling, origin at top)
    reset()
    p = []
    for k in range(10):
        p.append(torus((0, 0, -k * 0.12), 0.05, 0.012, S["iron"], (0, math.radians(90 * (k % 2)), math.radians(90 * (k % 2))), 6))
    p.append(torus((0, 0.05, -1.3), 0.08, 0.015, S["iron"], (math.radians(90), 0, 0), 8))
    p.append(box((0, 0.05, -1.65), (0.3, 0.22, 0.55), S["flesh"], taper=(0.7, 0.7)))
    join(p, "hook", (0, 0, 0))
    export("hook")
    # stairs down: occupies a 4x4 cell, top at z=0, goes down to -3
    reset()
    p = []
    n = 10
    for k in range(n):
        p.append(box((0, -1.6 + k * 0.32 + 0.16, -0.15 - k * 0.3), (2.6, 0.34, 0.3), S["stone"]))
    p.append(box((0, 1.6, -3.5), (3.0, 1.0, 1.0), S["black"]))
    for sx in (-1, 1):
        p.append(box((sx * 1.5, 0, -1.5), (0.4, 4.0, 3.0), S["stone_dark"]))
        p.append(box((sx * 1.5, -1.7, 0.4), (0.5, 0.5, 0.8), S["stone"]))
        p.append(sph((sx * 1.5, -1.7, 0.95), 0.22, S["stone"], (1, 1, 1), 8))
    p.append(box((0, 1.95, -1.5), (3.2, 0.1, 3.2), S["black"]))
    join(p, "stairs_down", (0, 0, 0))
    export("stairs_down")
    # stairs up: steps rising toward +Y into a dark archway in the wall
    reset()
    p = []
    for k in range(8):
        p.append(box((0, -1.2 + k * 0.38, 0.17 + k * 0.34), (2.4, 0.4, 0.34 + k * 0.68), S["stone"]))
    p.append(box((0, 2.0, 3.0), (2.4, 0.2, 6.0), S["black"]))
    for sx in (-1, 1):
        p.append(box((sx * 1.4, 0.6, 2.5), (0.4, 3.2, 5.0), S["stone_dark"]))
    join(p, "stairs_up", (0, 0, 0))
    export("stairs_up")
    # door: frame (static) + leaf (hinged at x=-1)
    reset()
    join([box((-1.2, 0, 1.6), (0.4, 0.5, 3.2), S["stone"]), box((1.2, 0, 1.6), (0.4, 0.5, 3.2), S["stone"]),
          box((0, 0, 3.4), (2.8, 0.5, 0.4), S["stone"]), box((0, 0, 4.4), (4.0, 0.5, 1.6), S["stone_dark"]),
          box((-1.6, 0, 1.6), (0.8, 0.5, 3.2), S["stone_dark"]), box((1.6, 0, 1.6), (0.8, 0.5, 3.2), S["stone_dark"])], "frame", (0, 0, 0))
    join([box((0, 0, 1.6), (2.0, 0.12, 3.2), S["wood"]), box((0, 0.07, 0.6), (2.0, 0.03, 0.12), S["iron"]),
          box((0, 0.07, 2.6), (2.0, 0.03, 0.12), S["iron"]), torus((0.7, 0.1, 1.5), 0.08, 0.012, S["iron"], (math.radians(90), 0, 0), 8)],
         "leaf", (-1.0, 0, 0))
    export("door")
    # skull pile on the wall / ornament: gargoyle head
    reset()
    join([box((0, 0, 0), (0.5, 0.3, 0.6), S["stone"]), sph((0, 0.25, 0.1), 0.24, S["stone"], (1, 1.1, 0.9), 8),
          cone((-0.15, 0.2, 0.36), 0.06, 0.25, S["stone"], (0, math.radians(-20), 0), 4),
          cone((0.15, 0.2, 0.36), 0.06, 0.25, S["stone"], (0, math.radians(20), 0), 4),
          sph((-0.08, 0.45, 0.16), 0.04, S["eye_red"], (1, 1, 1), 5), sph((0.08, 0.45, 0.16), 0.04, S["eye_red"], (1, 1, 1), 5)], "gargoyle", (0, 0, 0))
    export("gargoyle")
    # portal
    reset()
    join([torus((0, 0, 1.4), 0.9, 0.06, S["potion_blue"], (math.radians(90), 0, 0), 24)], "ring", (0, 0, 0))
    export("portal")


def build_town(mt):
    S = mt
    # house: 6x5 footprint, door on +Y
    def house(name, w, d, h, roof_col="roof"):
        reset()
        p = [box((0, 0, h / 2), (w, d, h), S["plaster"]), box((0, 0, 0.15), (w + 0.1, d + 0.1, 0.3), S["stone_dark"])]
        # timber frame
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.append(box((sx * w / 2, sy * d / 2, h / 2), (0.22, 0.22, h), S["wood_dark"]))
        p.append(box((0, d / 2, h - 0.1), (w, 0.2, 0.2), S["wood_dark"]))
        p.append(box((0, -d / 2, h - 0.1), (w, 0.2, 0.2), S["wood_dark"]))
        p.append(box((0, d / 2 + 0.02, h * 0.5), (w, 0.15, 0.15), S["wood_dark"]))
        for k in (-1, 1):
            p.append(box((k * w * 0.3, d / 2 + 0.02, h / 2), (0.14, 0.14, h), S["wood_dark"]))
            p.append(box((k * w * 0.15, d / 2 + 0.02, h * 0.72), (0.14, 0.14, h * 0.5), S["wood_dark"], (0, math.radians(35 * k), 0)))
        # door + windows
        p.append(box((0, d / 2 + 0.06, 1.1), (1.2, 0.1, 2.2), S["wood"]))
        p.append(box((0, d / 2 + 0.1, 1.1), (0.08, 0.04, 2.2), S["iron"]))
        for sx in (-1, 1):
            p.append(box((sx * w * 0.32, d / 2 + 0.05, h * 0.6), (0.8, 0.08, 0.7), S["flame"]))
            p.append(box((sx * w * 0.32, d / 2 + 0.1, h * 0.6), (0.85, 0.06, 0.08), S["wood_dark"]))
            p.append(box((sx * w * 0.32, d / 2 + 0.1, h * 0.6), (0.08, 0.06, 0.75), S["wood_dark"]))
        # roof (gable along x)
        rh = d * 0.6
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, h + rh / 2))
        r = bpy.context.active_object
        r.scale = (w + 0.8, d + 0.8, rh)
        bpy.ops.object.transform_apply(scale=True)
        for v in r.data.vertices:
            if v.co.z > 0:
                v.co.y = 0
        r.data.materials.append(S[roof_col])
        p.append(r)
        p.append(box((w * 0.3, -d * 0.15, h + rh * 0.9), (0.6, 0.6, 1.6), S["stone_dark"]))
        join(p, name, (0, 0, 0))
        export(name)

    house("house_a", 6, 5, 3.4)
    house("house_b", 8, 6, 3.8)
    # well
    reset()
    p = [cyl((0, 0, 0.45), 1.0, 0.9, S["stone"], seg=12), cyl((0, 0, 0.88), 0.82, 0.05, S["water"], seg=12)]
    for sx in (-1, 1):
        p.append(box((sx * 0.9, 0, 1.4), (0.15, 0.15, 2.0), S["wood_dark"]))
    p.append(box((0, 0, 2.5), (2.4, 1.6, 0.1), S["roof"], (math.radians(25), 0, 0)))
    p.append(box((0, 0, 2.5), (2.4, 1.6, 0.1), S["roof"], (math.radians(-25), 0, 0)))
    p.append(cyl((0, 0, 1.9), 0.06, 1.8, S["wood"], (0, math.radians(90), 0), 6))
    p.append(cyl((0.2, 0, 1.2), 0.15, 0.25, S["wood"], seg=8))
    join(p, "well", (0, 0, 0))
    export("well")
    # dead tree
    reset()
    import random
    random.seed(5)
    p = [limb((0, 0, 0), (0.1, 0.1, 3.0), 0.35, 0.18, S["wood_dark"], 7)]

    def branch(a, d, r, depth):
        if depth == 0:
            return
        for k in range(2):
            ang = random.uniform(0, math.pi * 2)
            up = random.uniform(0.3, 0.9)
            L = random.uniform(0.9, 1.5) * (0.75 ** (3 - depth))
            b = Vector(a) + Vector((math.cos(ang) * L, math.sin(ang) * L, up * L))
            p.append(limb(tuple(a), tuple(b), r, r * 0.6, S["wood_dark"], 5))
            branch(tuple(b), d, r * 0.6, depth - 1)
    branch((0.1, 0.1, 2.6), 0, 0.15, 3)
    join(p, "tree", (0, 0, 0))
    export("tree")
    # fence
    reset()
    p = [box((0, 0, 0.6), (3.0, 0.08, 0.12), S["wood"]), box((0, 0, 1.0), (3.0, 0.08, 0.12), S["wood"])]
    for k in (-1.4, 0, 1.4):
        p.append(box((k, 0, 0.6), (0.14, 0.14, 1.2), S["wood_dark"]))
    join(p, "fence", (0, 0, 0))
    export("fence")
    # gravestone
    reset()
    join([box((0, 0, 0.5), (0.6, 0.18, 1.0), S["stone"]), cyl((0, 0, 1.0), 0.3, 0.18, S["stone"], (math.radians(90), 0, 0), 10),
          box((0, 0.6, 0.05), (0.7, 1.4, 0.1), S["stone_dark"])], "grave", (0, 0, 0))
    export("grave")
    # lamp post
    reset()
    join([cyl((0, 0, 1.5), 0.06, 3.0, S["iron"], seg=6), box((0, 0.25, 2.9), (0.08, 0.6, 0.08), S["iron"]),
          box((0, 0.5, 2.65), (0.3, 0.3, 0.4), S["flame"]), cone((0, 0.5, 2.95), 0.25, 0.2, S["iron"], seg=4)], "lamp", (0, 0, 0))
    export("lamp")
    # anvil
    reset()
    join([box((0, 0, 0.35), (0.4, 0.4, 0.7), S["wood_dark"]), box((0, 0, 0.8), (0.9, 0.35, 0.2), S["iron"]),
          cone((0.6, 0, 0.82), 0.12, 0.35, S["iron"], (0, math.radians(90), 0), 6)], "anvil", (0, 0, 0))
    export("anvil")
    # cart
    reset()
    p = [box((0, 0, 0.9), (1.6, 2.6, 0.12), S["wood"]), box((0.8, 0, 1.15), (0.08, 2.6, 0.5), S["wood"]),
         box((-0.8, 0, 1.15), (0.08, 2.6, 0.5), S["wood"]), box((0, -1.3, 1.15), (1.6, 0.08, 0.5), S["wood"]),
         box((0, 0.4, 1.3), (1.1, 1.2, 0.6), S["straw"], taper=(0.6, 0.6)),
         limb((0.3, 1.3, 0.8), (0.3, 3.0, 0.4), 0.05, 0.05, S["wood_dark"], 5), limb((-0.3, 1.3, 0.8), (-0.3, 3.0, 0.4), 0.05, 0.05, S["wood_dark"], 5)]
    for sx in (-1, 1):
        p.append(cyl((sx * 0.95, -0.2, 0.55), 0.55, 0.1, S["wood_dark"], (0, math.radians(90), 0), 10))
    join(p, "cart", (0, 0, 0))
    export("cart")
    # cathedral facade: wide stone front with a dark arched entrance at the centre (faces +Y)
    reset()
    p = [box((0, 0, 5), (16, 6, 10), S["stone"]), box((0, 3.05, 2.2), (3.6, 0.2, 4.4), S["black"]),
         cyl((0, 3.05, 4.4), 1.8, 0.2, S["black"], (math.radians(90), 0, 0), 12),
         box((0, 0, 11.5), (10, 6, 3), S["stone_dark"])]
    # gable roof
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 14.5))
    r = bpy.context.active_object
    r.scale = (12, 6.5, 6)
    bpy.ops.object.transform_apply(scale=True)
    for v in r.data.vertices:
        if v.co.z > 0:
            v.co.x = 0
    r.data.materials.append(S["roof"])
    p.append(r)
    for sx in (-1, 1):
        p.append(box((sx * 7, 0, 9), (3.4, 6.4, 18), S["stone_dark"]))
        p.append(cone((sx * 7, 0, 20.5), 2.6, 5, S["roof"], seg=4))
        for k in range(3):
            p.append(box((sx * 7, 3.25, 4 + k * 4.5), (0.9, 0.1, 2.2), S["black"]))
        p.append(box((sx * 3.4, 3.2, 3), (0.6, 0.6, 6), S["stone_dark"]))
    p.append(cyl((0, 3.1, 8.0), 1.4, 0.15, S["potion_red"], (math.radians(90), 0, 0), 16))
    p.append(torus((0, 3.2, 8.0), 1.4, 0.15, S["stone_dark"], (math.radians(90), 0, 0), 16))
    for k in range(8):
        a = k / 8 * math.pi * 2
        p.append(limb((0, 3.2, 8.0), (math.cos(a) * 1.4, 3.2, 8.0 + math.sin(a) * 1.4), 0.06, 0.06, S["stone_dark"], 4))
    join(p, "cathedral", (0, 0, 0))
    export("cathedral")


mt = M()
build_ghoul(mt)
build_imp(mt)
build_skeleton(mt)
build_skeleton(mt, True)
build_cultist(mt)
build_brute(mt)
build_matron(mt)
for k in ("healer", "smith", "elder"):
    build_npc(mt, k)
build_fp(mt)
build_weapons(mt)
build_items(mt)
build_props(mt)
build_town(mt)
print("ALL DONE")
