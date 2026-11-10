# Builds the atompunk robot (the owner's T-pose concept) from primitives, one collection per game part.
# Run headless: Blender -b --factory-startup -P build_atom_robot.py -- [--check]
# or live in the owner's Blender: python3 -I blender_live.py build_atom_robot.py
# Arms hang down so every limb lies in the profile plane. The robot faces +X, up +Z, right side (-Y) is near.
import json
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, globals().get('TOOLS_DIR') or os.path.dirname(os.path.abspath(__file__)))
from atom_check import check            # noqa: E402
from atom_geometry import W, Builder    # noqa: E402
from atom_hands import build_hands      # noqa: E402
from atom_materials import palette      # noqa: E402

ROOT = 'AtomRobot'


def fresh_root() -> bpy.types.Collection:
    root = bpy.data.collections.get(ROOT)
    if root is None:
        root = bpy.data.collections.new(ROOT)
        bpy.context.scene.collection.children.link(root)
        return root
    for coll in list(root.children):
        for obj in list(coll.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(coll)
    return root


def build_head(b, m, joints):
    c = b.part('head')
    b.box(c, 'head_box', W(626, 268), (0.4, 0.52, 0.47), m['paint'], bevel=0.05)
    b.rod(c, 'head_knob', W(626, 155), W(626, 132), 0.075, m['metal'])
    for side, x, sign in (('R', 470, 1), ('L', 782, -1)):
        b.rod(c, f'head_ear_{side}', W(x - 12 * sign, 270), W(x + 25 * sign, 270), 0.06, m['metal'])
        b.rod(c, f'head_earcap_{side}', W(x - 24 * sign, 270), W(x - 12 * sign, 270), 0.045, m['metal'])
    for side, x in (('R', 571), ('L', 690)):
        b.rod(c, f'head_eyering_{side}', W(x, 262, 95), W(x, 262, 113), 0.1, m['metal'])
        b.ball(c, f'head_eye_{side}', W(x, 262, 105), 0.07, m['eye'])
    b.box(c, 'head_mouth', W(611, 344, 101), (0.02, 0.17, 0.04), m['dark'], bevel=0.006)
    for i in range(4):
        b.box(c, f'head_tooth{i}', W(585 + i * 17, 344, 104), (0.012, 0.012, 0.034), m['metal'], bevel=0.003)
    b.rivets(c, 'head', [W(x, y, 101) for x, y in ((515, 175), (735, 175), (515, 365), (735, 365))], m['metal'])
    joints['head'] = W(626, 388)


def build_trunk(b, m, joints):
    c = b.part('torso')
    for i, (y0, y1, r) in enumerate(((386, 403, 0.07), (403, 415, 0.078), (415, 430, 0.07))):
        b.rod(c, f'torso_neck{i}', W(626, y1), W(626, y0), r, m['metal'])
    b.box(c, 'torso_chest', W(626, 520), (0.36, 0.48, 0.38), m['paint'], bevel=0.04)
    b.box(c, 'torso_patch', W(624, 490, 92), (0.01, 0.16, 0.16), m['red'], bevel=0.01)
    b.rivets(c, 'torso', [W(x, y, 92) for x, y in ((540, 455), (712, 455), (540, 590), (712, 590))], m['metal'])
    for i, (y0, y1, r) in enumerate(((615, 640, 0.085), (640, 655, 0.095), (655, 672, 0.085))):
        b.rod(c, f'torso_waist{i}', W(626, y1), W(626, y0), r, m['metal'])
    joints['hip'], joints['neck'] = W(626, 725), W(626, 425)
    c = b.part('pelvis')
    b.box(c, 'pelvis_shorts', W(626, 708), (0.36, 0.5, 0.15), m['red'], bevel=0.035)
    b.box(c, 'pelvis_crotch', W(626, 760), (0.3, 0.2, 0.1), m['red'], bevel=0.03)
    b.box(c, 'pelvis_plate', W(626, 712, 92), (0.01, 0.09, 0.08), m['metal'], bevel=0.008)


def build_legs(b, m, joints):
    for side, sx, slot in (('R', 545, 'Front'), ('L', 708, 'Back')):
        hip, knee, boot_top = W(sx, 725), W(sx, 900), W(sx, 1095)
        # The ankle pivot sits inside the boot, about 3 rig units above the drawn sole like the painted
        # bases: corpse physics rests a foot on that ankle height (corpseRadii JOINT_RADII anF/anB = 3)
        ankle = boot_top + Vector((0, 0, -0.12))
        b.rod(b.part(f'thigh{slot}'), f'thigh_{side}', hip, knee, 0.072, m['metal'])
        c = b.part(f'shin{slot}')
        b.ball(c, f'knee_{side}', knee, 0.1, m['metal'])
        guard = Vector((knee.x, knee.y, (knee.z - 0.07 + boot_top.z) / 2))
        tall = knee.z - 0.07 - boot_top.z + 0.02
        b.box(c, f'shin_frame_{side}', guard, (0.16, 0.2, tall), m['paint'], bevel=0.025)
        b.box(c, f'shin_guard_{side}', guard + Vector((0.012, 0, 0)), (0.16, 0.17, tall - 0.03), m['red'], bevel=0.025)
        b.rivets(c, f'shin_{side}', [guard + Vector((0.093, dy, dz)) for dy in (-0.06, 0.06) for dz in (0.11, -0.11)],
                 m['metal'])
        c = b.part(f'foot{slot}')
        b.box(c, f'boot_{side}', boot_top + Vector((0.07, 0, -0.105)), (0.4, 0.3, 0.2), m['paint'], bevel=0.06)
        b.box(c, f'boot_sole_{side}', boot_top + Vector((0.07, 0, -0.19)), (0.42, 0.32, 0.03), m['metal'], bevel=0.01)
        joints[f'hip{slot}'], joints[f'knee{slot}'], joints[f'ankle{slot}'] = hip, knee, ankle
        joints[f'sole{slot}'] = boot_top + Vector((0.07, 0, -0.205))


def build_arms(b, m, joints):
    for side, sx, slot in (('R', 468, 'Front'), ('L', 786, 'Back')):
        shoulder = W(sx, 467)
        elbow = shoulder + Vector((0, 0, -0.28))
        wrist = elbow + Vector((0, 0, -0.24))
        c = b.part(f'upperArm{slot}')
        b.ball(c, f'shoulder_{side}', shoulder, 0.095, m['metal'])
        b.rod(c, f'uparm_{side}', shoulder, elbow, 0.042, m['metal'])
        c = b.part(f'forearm{slot}')
        b.ball(c, f'elbow_{side}', elbow, 0.066, m['metal'])
        b.rod(c, f'forearm_{side}', elbow, wrist + Vector((0, 0, 0.06)), 0.04, m['metal'])
        b.rod(c, f'cuff_{side}', wrist + Vector((0, 0, 0.12)), wrist, 0.08, m['paint'], bevel=0.01)
        b.rod(c, f'cuffband_{side}', wrist + Vector((0, 0, 0.03)), wrist + Vector((0, 0, -0.005)), 0.084, m['red'])
        joints[f'shoulder{slot}'], joints[f'elbow{slot}'], joints[f'wrist{slot}'] = shoulder, elbow, wrist


def main() -> list[str]:
    mats = palette()
    b = Builder(fresh_root(), mats['outline'], mats['wear'])
    joints: dict = {}
    for step in (build_head, build_trunk, build_legs, build_arms):
        step(b, mats, joints)
    build_hands(b, mats, joints)
    bpy.context.scene['atom_robot_joints'] = json.dumps({k: list(v) for k, v in joints.items()})
    return check(ROOT)


problems = main()
if 'result' in globals():
    result['parts'] = [c.name for c in bpy.data.collections[ROOT].children]
    result['problems'] = problems
if '--check' in sys.argv:
    if problems:
        raise SystemExit('CHECK FAILED:\n' + '\n'.join(problems))
    print('CHECK OK')
