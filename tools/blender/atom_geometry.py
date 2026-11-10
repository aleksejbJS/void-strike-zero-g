# Primitive builders for the atom robot: rounded boxes, balls and rods with an ink outline.
# Paint surfaces also get a slightly larger "wear" twin that carries rust and chips (fixed layer).
import bmesh
import bpy
from mathutils import Vector

S = 1 / 500                      # metres per concept pixel
CX, FLOOR = 627, 1200            # concept centre column and sole row


def W(x_px: float, y_px: float, depth_px: float = 0.0) -> Vector:
    """Concept pixel (column, row) plus forward depth -> world point (faces +X, up +Z, right side -Y)."""
    return Vector((depth_px * S, (x_px - CX) * S, (FLOOR - y_px) * S))


class Builder:
    """Creates part collections under `root` and dresses every mesh with outline and wear."""

    def __init__(self, root: bpy.types.Collection, outline: bpy.types.Material, wear: bpy.types.Material):
        self.root, self.outline, self.wear = root, outline, wear

    def part(self, name: str) -> bpy.types.Collection:
        coll = bpy.data.collections.new(f'part_{name}')
        self.root.children.link(coll)
        return coll

    def _finish(self, obj, coll, mat, bevel: float, outline: float = 0.006):
        coll.objects.link(obj)
        obj.data.materials.append(mat)
        obj.data.materials.append(self.outline)
        if bevel > 0:
            b = obj.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 4; b.limit_method = 'NONE'
        sol = obj.modifiers.new('outline', 'SOLIDIFY')
        sol.thickness = outline; sol.offset = 1; sol.use_flip_normals = True; sol.material_offset = 1
        for p in obj.data.polygons:
            p.use_smooth = True
        if mat.get('layer') == 'paint':
            self._wear_twin(obj, coll, bevel)
        return obj

    def _wear_twin(self, obj, coll, bevel: float):
        """A 2 mm larger copy whose material is transparent except for rust spots and chipped edges."""
        twin = bpy.data.objects.new(f'{obj.name}_wear', obj.data.copy())
        twin.data.materials.clear(); twin.data.materials.append(self.wear)
        twin.location, twin.rotation_euler = obj.location.copy(), obj.rotation_euler.copy()
        dims = [max(hi - lo, 0.01) for lo, hi in zip(*[[min(v.co[i] for v in obj.data.vertices) for i in range(3)],
                                                       [max(v.co[i] for v in obj.data.vertices) for i in range(3)]])]
        twin.scale = tuple(1 + 0.004 / d for d in dims)
        if bevel > 0:
            b = twin.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 4; b.limit_method = 'NONE'
        twin['decal'] = True
        coll.objects.link(twin)

    def box(self, coll, name, center, size, mat, bevel=0.03, rot=None):
        me = bpy.data.meshes.new(name); bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
        bm.to_mesh(me); bm.free()
        obj = bpy.data.objects.new(name, me); obj.location = center
        if rot:
            obj.rotation_euler = rot
        return self._finish(obj, coll, mat, bevel)

    def ball(self, coll, name, center, radius, mat):
        me = bpy.data.meshes.new(name); bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=radius)
        bm.to_mesh(me); bm.free()
        obj = bpy.data.objects.new(name, me); obj.location = center
        return self._finish(obj, coll, mat, 0.0)

    def rod(self, coll, name, a, b, r1, mat, r2=None, bevel=0.0):
        a, b = Vector(a), Vector(b)
        me = bpy.data.meshes.new(name); bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=r1, radius2=r1 if r2 is None else r2,
                              depth=(b - a).length)
        bm.to_mesh(me); bm.free()
        obj = bpy.data.objects.new(name, me)
        obj.location = (a + b) / 2
        obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
        return self._finish(obj, coll, mat, bevel)

    def rivets(self, coll, name, points, mat, r=0.011):
        for i, p in enumerate(points):
            self.ball(coll, f'{name}_rivet{i}', p, r, mat)
