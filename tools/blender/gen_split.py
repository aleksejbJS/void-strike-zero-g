# Cuts a generated model's single skinned mesh into the game's rigid parts, one collection per part.
# A face belongs to every part that carries at least OVERLAP of its skin weight, so neighbouring parts
# overlap at the joints and no gap opens when the game bends them.
import bmesh
import bpy

from gen_rig import part_of, side_of

OVERLAP = 0.2
LIMBS = ('upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot')


def game_part(bone_name: str, near_side: str) -> str | None:
    part = part_of(bone_name)
    if part is None:
        return None
    if part == 'neck':
        return 'torso'
    if part in LIMBS:
        side = side_of(bone_name)
        if side is None:
            return None
        return part + ('Front' if side == near_side else 'Back')
    return part


def _vertex_parts(obj, near_side: str) -> list[dict]:
    names = {g.index: game_part(g.name, near_side) for g in obj.vertex_groups}
    out = []
    for v in obj.data.vertices:
        weights: dict = {}
        total = sum(g.weight for g in v.groups) or 1.0
        for g in v.groups:
            part = names.get(g.group)
            if part:
                weights[part] = weights.get(part, 0.0) + g.weight / total
        out.append(weights)
    return out


def split(obj, root, outline, near_side: str) -> dict:
    """Creates part_<id> collections under `root`; returns {part id: face count}."""
    per_vertex = _vertex_parts(obj, near_side)
    faces: dict = {}
    for poly in obj.data.polygons:
        share: dict = {}
        for vi in poly.vertices:
            for part, w in per_vertex[vi].items():
                share[part] = share.get(part, 0.0) + w / len(poly.vertices)
        if not share:
            continue
        dominant = max(share, key=share.get)
        for part, w in share.items():
            if w >= OVERLAP or part == dominant:
                faces.setdefault(part, set()).add(poly.index)
    counts = {}
    for part, keep in faces.items():
        coll = bpy.data.collections.get(f'part_{part}') or bpy.data.collections.new(f'part_{part}')
        if coll.name not in root.children:
            root.children.link(coll)
        piece = bpy.data.objects.new(f'{obj.name}_{part}', obj.data.copy())
        piece.matrix_world = obj.matrix_world.copy()
        bm = bmesh.new(); bm.from_mesh(piece.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(piece.data); bm.free()
        coll.objects.link(piece)
        _dress(piece, outline)
        counts[part] = len(keep)
    return counts


def _dress(piece, outline) -> None:
    """The generated texture is fixed art; add the same inked inverted-hull outline as the robot."""
    for mat in piece.data.materials:
        if mat is not None:
            mat['layer'] = 'fixed'
    piece.data.materials.append(outline)
    sol = piece.modifiers.new('outline', 'SOLIDIFY')
    sol.thickness = 0.006; sol.offset = 1; sol.use_flip_normals = True
    sol.material_offset = len(piece.data.materials) - 1
