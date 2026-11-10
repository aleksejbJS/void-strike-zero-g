# Turns a generated, rigged .glb (Meshy, Tripo, Rodin, Mixamo...) into a kit source .blend like
# art/3d/atom-robot.blend: posed (facing +X, arms down), cut into part collections, joints stored.
# Usage: Blender -b --factory-startup -P tools/blender/import_generated.py -- <model.glb> <body> <out.blend>
import json
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from atom_check import check                                   # noqa: E402
from atom_materials import flat                                # noqa: E402
from gen_rig import chain, face_plus_x, hang_arms, joint       # noqa: E402
from gen_split import split                                    # noqa: E402

GLB, BODY, OUT = sys.argv[sys.argv.index('--') + 1:][:3]
ROOT = f"Atom{BODY.title().replace('-', '')}"
SIDES = {'Front': None, 'Back': None}


def bake_pose(meshes) -> None:
    """Applies the armature, so the cut pieces keep the posed shape as plain meshes."""
    for obj in meshes:
        for mod in [m for m in obj.modifiers if m.type == 'ARMATURE']:
            with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
                bpy.ops.object.modifier_apply(modifier=mod.name)


def normalize(arm, meshes) -> None:
    """Robot scale: hip-to-neck 0.6 m (19 rig units), soles on z = 0, hip over the origin."""
    hip, neck = joint(arm, 'pelvis', None), joint(arm, 'neck', None)
    scale = 0.6 / (neck - hip).length
    low = min((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
    move = Matrix.Translation(Vector((-hip.x * scale, -hip.y * scale, -low * scale))) @ Matrix.Scale(scale, 4)
    for obj in [arm, *meshes]:
        obj.matrix_world = move @ obj.matrix_world
    bpy.context.view_layer.update()


def store_joints(arm, sides: dict, has_tail: bool) -> None:
    j = {'hip': joint(arm, 'pelvis', None), 'neck': joint(arm, 'neck', None), 'head': joint(arm, 'head', None)}
    for slot, side in sides.items():
        j[f'shoulder{slot}'], j[f'elbow{slot}'] = joint(arm, 'upperArm', side), joint(arm, 'forearm', side)
        j[f'wrist{slot}'] = joint(arm, 'hand', side)
        j[f'hip{slot}'], j[f'knee{slot}'], j[f'ankle{slot}'] = joint(arm, 'thigh', side), joint(arm, 'shin', side), joint(arm, 'foot', side)
        j[f'sole{slot}'] = j[f'ankle{slot}'].copy()  # render_kit measures the real sole from the silhouette
    if has_tail:
        j['tailBase'] = joint(arm, 'tail', None)
    bpy.context.scene['atom_robot_joints'] = json.dumps({k: list(v) for k, v in j.items()})


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(GLB))
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if arm is None:
        raise SystemExit('The model has no skeleton: generate it with auto-rig enabled')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
    if not meshes:
        raise SystemExit('No skinned mesh found')
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o not in meshes]:
        bpy.data.objects.remove(o)
    if arm.animation_data:
        arm.animation_data.action = None
    face_plus_x(arm, meshes)
    hang_arms(arm)
    # Facing +X, the character's right side is at -Y: the camera's near ("Front") side
    shoulder_y = {s: joint(arm, 'upperArm', s).y for s in ('L', 'R')}
    near = min(shoulder_y, key=shoulder_y.get)
    sides = {'Front': near, 'Back': 'R' if near == 'L' else 'L'}
    has_tail = bool(chain(arm, 'tail', None))
    bake_pose(meshes)
    normalize(arm, meshes)
    store_joints(arm, sides, has_tail)
    root = bpy.data.collections.new(ROOT)
    bpy.context.scene.collection.children.link(root)
    outline = flat(f'{BODY}_outline', 'fixed', '#1f1612', rough=1.0)
    outline.use_backface_culling = True
    counts = {}
    for obj in meshes:
        for part, n in split(obj, root, outline, near).items():
            counts[part] = counts.get(part, 0) + n
        obj.hide_render = True
        obj.hide_set(True)
    arm.hide_render = True
    print('PARTS', json.dumps(counts))
    problems = check(ROOT, skip=('palmFront', 'palmBack', 'handFrontGrip', 'handBackGrip', 'woundFlange', 'gripFront', 'gripBack'),
                     extra_joints=('tailBase',) if has_tail else ())
    if problems:
        raise SystemExit('CHECK FAILED:\n' + '\n'.join(problems))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT))
    print('SAVED', OUT)


main()
