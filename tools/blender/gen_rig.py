# Rig helpers for generated (AI / downloaded) skinned models: find the game's joints among the model's bones
# whatever its naming (Rigify, Mixamo, Meshy, Tripo...), turn it to face +X, and hang its arms straight down.
import math
import re

import bpy
from mathutils import Matrix, Vector

# Game part -> bone-name patterns (lower case, side markers removed), most specific first
PART_PATTERNS = {
    'hand': (r'hand', r'wrist', r'palm', r'f_', r'finger', r'thumb', r'index', r'middle', r'ring', r'pinky'),
    'forearm': (r'fore_?arm', r'lower_?arm', r'lowerarm', r'elbow'),
    'upperArm': (r'upper_?arm', r'^arm', r'shoulder', r'clavicle'),
    'foot': (r'foot', r'toe', r'ball', r'heel'),
    'shin': (r'shin', r'calf', r'lower_?leg', r'^leg', r'knee'),
    'thigh': (r'thigh', r'up_?leg', r'upper_?leg'),
    'tail': (r'tail',),
    'head': (r'head', r'jaw', r'eye', r'ear', r'spine\.00[56]'),
    'neck': (r'neck', r'spine\.004'),
    'pelvis': (r'hip', r'pelvis', r'root', r'^spine$', r'spine\.001'),
    'torso': (r'spine', r'chest', r'torso', r'breast'),
}
SIDE = re.compile(r'(^|[._\s-])(l|r|left|right)($|[._\s-])|^(left|right)|(left|right)$', re.I)


def side_of(name: str) -> str | None:
    m = SIDE.search(name.replace('mixamorig:', ''))
    if not m:
        return None
    word = next(g for g in m.groups() if g and g.lower() in ('l', 'r', 'left', 'right')).lower()
    return 'L' if word.startswith('l') else 'R'


def part_of(name: str) -> str | None:
    bare = SIDE.sub('', name.lower().replace('mixamorig:', '')).strip('._ -')
    for part, patterns in PART_PATTERNS.items():
        if any(re.search(p, bare) for p in patterns):
            return part
    return None


def chain(arm, part: str, side: str | None):
    """The model's bones for one game part and side, root first."""
    bones = [b for b in arm.pose.bones if part_of(b.name) == part and side_of(b.name) == side]
    return sorted(bones, key=lambda b: len(b.parent_recursive))


def face_plus_x(arm, meshes) -> None:
    """Turns model and rig so the toes point to +X (generated models usually face -Y)."""
    feet = chain(arm, 'foot', 'L') + chain(arm, 'foot', 'R')
    if not feet:
        raise SystemExit('No foot bones: cannot tell which way the model faces')
    toe = sum(((arm.matrix_world @ b.tail) - (arm.matrix_world @ b.head) for b in feet), Vector())
    angle = -math.atan2(toe.y, toe.x)
    turn = Matrix.Rotation(angle, 4, 'Z')
    for obj in [arm, *[m for m in meshes if m.parent is None]]:
        obj.matrix_world = turn @ obj.matrix_world
    bpy.context.view_layer.update()


def _aim(arm, pb, direction: Vector) -> None:
    head = arm.matrix_world @ pb.head
    current = (arm.matrix_world @ pb.tail) - head
    rot = current.rotation_difference(direction).to_matrix().to_4x4()
    world = arm.matrix_world @ pb.matrix
    pb.matrix = arm.matrix_world.inverted() @ Matrix.Translation(head) @ rot @ Matrix.Translation(-head) @ world
    bpy.context.view_layer.update()


def hang_arms(arm) -> None:
    """Upper arm, forearm and hand point straight down, so every limb lies in the profile plane."""
    down = Vector((0, 0, -1))
    for side in ('L', 'R'):
        for part in ('upperArm', 'forearm'):
            bones = [b for b in chain(arm, part, side) if not re.search('shoulder|clavicle', b.name.lower())]
            for pb in bones[:1]:
                _aim(arm, pb, down)
        for pb in chain(arm, 'hand', side)[:1]:
            _aim(arm, pb, down)


def joint(arm, part: str, side: str | None, end: str = 'head') -> Vector:
    """World position of a part's root bone head (or its last bone's tail)."""
    bones = chain(arm, part, side)
    if part in ('upperArm',):
        bones = [b for b in bones if not re.search('shoulder|clavicle', b.name.lower())] or bones
    if not bones:
        raise SystemExit(f'No {part} bone on side {side}')
    pb = bones[0] if end == 'head' else bones[-1]
    return arm.matrix_world @ (pb.head if end == 'head' else pb.tail)
