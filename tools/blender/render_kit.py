# Renders art/3d/atom-robot.blend as a two-layer 3/4 puppet kit: one WebP atlas plus a generated TS module.
# Usage: Blender -b --factory-startup art/3d/atom-<body>.blend -P tools/blender/render_kit.py -- <repoRoot> <robot|cat> [preview [front]]
# Each part renders twice: the paint pass (only `layer == "paint"` surfaces, others held out) and the fixed
# pass (paint held out, so wear decals and metal remain). The game tints the paint and draws the fixed on top.
import json
import math
import os
import sys
import tempfile

import bpy
import numpy as np
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit_atlas import alpha_box, convex_hull, load_rgba, save_alpha_png, save_webp, shelf_pack  # noqa: E402
from kit_module import write_module                                              # noqa: E402

ARGS = sys.argv[sys.argv.index('--') + 1:]
REPO, BODY = os.path.abspath(ARGS[0]), ARGS[1]
W, H, PX_PER_M = 1600, 2400, 1000
YAW = math.radians(90 if 'front' in ARGS else 32)
ATLAS_URL = f'/assets/characters/kit/{BODY}.webp'
ROOT = {'robot': 'AtomRobot', 'cat': 'AtomCat'}[BODY]
SIDES = ('Front', 'Back')
AXES = {'head': ('head', None), 'torso': ('hip', 'neck'), 'pelvis': ('hip', 'neck'),
        **{f'{b}{s}': (f'{j0}{s}', f'{j1}{s}' if j1 else None) for s in SIDES for b, j0, j1 in (
            ('thigh', 'hip', 'knee'), ('shin', 'knee', 'ankle'), ('foot', 'ankle', None),
            ('upperArm', 'shoulder', 'elbow'), ('forearm', 'elbow', 'wrist'), ('hand', 'wrist', None),
            ('palm', 'grip', None))},
        **{f'hand{s}Grip': (f'grip{s}', None) for s in SIDES},
        'woundFlange': ('woundFlange', 'woundFlangeEnd'), 'tail': ('tailBase', None)}

scene = bpy.context.scene
root = bpy.data.collections[ROOT]
parts = {c.name[len('part_'):]: list(c.objects) for c in root.children}
ours = {o for objs in parts.values() for o in objs}
joints = {k: Vector(v) for k, v in json.loads(scene['atom_robot_joints']).items()}


def setup_scene():
    for o in scene.objects:
        o.hide_render = o not in ours
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = W, H, 100
    scene.render.film_transparent = True
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 64
    scene.view_settings.view_transform, scene.view_settings.look = 'Standard', 'None'
    world = bpy.data.worlds.new('kit_world'); world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.52, 0.5, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.55
    scene.world = world
    for name, rot, energy, angle in (('key', (40, 0, -55), 3.2, 0.6), ('fill', (70, 0, 160), 0.8, 1.2),
                                     ('rim', (110, 0, 20), 1.1, 0.6)):
        light = bpy.data.objects.new(f'kit_{name}', bpy.data.lights.new(f'kit_{name}', 'SUN'))
        light.data.energy, light.data.angle = energy, angle
        light.rotation_euler = [math.radians(a) for a in rot]
        scene.collection.objects.link(light)
    cam = bpy.data.objects.new('kit_cam', bpy.data.cameras.new('kit_cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type, cam.data.ortho_scale = 'ORTHO', H / PX_PER_M
    target = Vector((0.0, 0.0, 1.12))
    cam.location = target + Vector((math.sin(YAW), -math.cos(YAW), 0.0)) * 10
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    return cam


def holdout_material():
    mat = bpy.data.materials.new('kit_holdout'); mat.use_nodes = True
    # Like the outline it may replace: an inside-out shell must not hide the surface it surrounds
    mat.use_backface_culling = True
    nt = mat.node_tree; nt.nodes.clear()
    nt.links.new(nt.nodes.new('ShaderNodeHoldout').outputs[0], nt.nodes.new('ShaderNodeOutputMaterial').inputs['Surface'])
    return mat


def render_pass(objs, layer: str, path: str, holdout) -> np.ndarray:
    """Renders `objs` showing only `layer` surfaces; the other layer is held out (cuts its pixels away)."""
    swapped = []
    for o in ours:
        o.hide_render = o not in objs or bool(layer == 'paint' and o.get('decal'))
    for o in objs:
        for i, mat in enumerate(o.data.materials):
            if mat is not None and mat.get('layer') != layer:
                swapped.append((o.data, i, mat)); o.data.materials[i] = holdout
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for data, i, mat in swapped:
        data.materials[i] = mat
    return load_rgba(path, W, H)


def main():
    cam = setup_scene()

    def px(p):
        v = world_to_camera_view(scene, cam, p)
        return [round(v.x * W, 2), round((1 - v.y) * H, 2)]

    if 'preview' in ARGS:
        scene.render.filepath = os.path.join(REPO, f"art/3d/atom-{BODY}-preview{'-front' if 'front' in ARGS else ''}.png")
        bpy.ops.render.render(write_still=True)
        return
    holdout, tmp = holdout_material(), tempfile.mkdtemp(prefix='kit-')
    crops, sizes = {}, {}
    for part, (origin, axis_end) in AXES.items():
        if part not in parts:
            continue  # this body has no such part (the robot has no tail, the cat no flange)
        paint = render_pass(parts[part], 'paint', f'{tmp}/{part}-paint.png', holdout)
        fixed = render_pass(parts[part], 'fixed', f'{tmp}/{part}-fixed.png', holdout)
        box, mask = alpha_box(paint, fixed)
        if box is None:
            raise SystemExit(f'part {part} rendered empty')
        x0, y0, x1, y1 = box
        has_paint = bool((paint[:, :, 3] > 0.02).any())
        crops[part] = dict(box=box, hull=convex_hull(mask), union=mask[y0:y1, x0:x1].astype(np.float32),
                           origin=px(joints[origin]),
                           axisEnd=px(joints[axis_end]) if axis_end else None,
                           fixed=fixed[y0:y1, x0:x1], paint=paint[y0:y1, x0:x1] if has_paint else None)
        sizes[(part, 'fixed')] = (x1 - x0, y1 - y0)
        if has_paint:
            sizes[(part, 'paint')] = (x1 - x0, y1 - y0)
    slots, height = shelf_pack(sizes)
    atlas = np.zeros((height, 2048, 4), dtype=np.float32)
    for (part, layer), (sx, sy) in slots.items():
        img = crops[part][layer]
        atlas[sy:sy + img.shape[0], sx:sx + img.shape[1]] = img
    out_img = os.path.join(REPO, 'public' + ATLAS_URL)
    os.makedirs(os.path.dirname(out_img), exist_ok=True)
    save_webp(atlas, out_img)
    # The served atlas is WebP; the contact tests read this PNG silhouette (paint + fixed) instead
    silhouette = np.zeros((height, 2048), dtype=np.float32)
    for (part, layer), (sx, sy) in slots.items():
        if layer == 'fixed':
            u = crops[part]['union']; silhouette[sy:sy + u.shape[0], sx:sx + u.shape[1]] = u
    save_alpha_png(silhouette, os.path.join(REPO, f'art/3d/kit-alpha/{BODY}.png'))
    sole = {s: px(joints[f'sole{s}']) for s in SIDES}
    write_module(os.path.join(REPO, f'src/game/render/characters/data/{BODY}Kit.ts'), crops, slots, BODY,
                 frame=[W, H], atlas=(ATLAS_URL, [2048, height]), hip=px(joints['hip']), neck=px(joints['neck']), sole=sole)
    print('KIT', os.path.getsize(out_img), 'bytes', 2048, height)


main()
