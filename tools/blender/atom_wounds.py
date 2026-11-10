# The torn socket flange of the atom robot: a short metal collar with a dark hollow and jagged shards.
# One picture serves every torn joint; the game scales and turns it along the socket and draws cables from it.
# Its axis runs from the attached base (woundFlange) out to the open end (woundFlangeEnd), along -Z.
import math
import random

from mathutils import Vector

RADIUS, DEPTH = 0.075, 0.035
CENTER = Vector((0.0, 0.0, 0.6))   # anywhere inside the camera frame: the flange renders on its own


def build_flange(b, mats, joints: dict) -> None:
    c = b.part('woundFlange')
    base, end = CENTER, CENTER + Vector((0, 0, -DEPTH))
    b.rod(c, 'flange_collar', base, end, RADIUS, mats['metal'])
    b.rod(c, 'flange_hollow', end + Vector((0, 0, 0.006)), end - Vector((0, 0, 0.002)), RADIUS * 0.72, mats['dark'])
    rng = random.Random(7)   # stable shards: the picture must not change between renders
    for i in range(8):
        angle = i / 8 * math.tau + rng.uniform(-0.2, 0.2)
        rim = end + Vector((math.cos(angle) * RADIUS * 0.92, math.sin(angle) * RADIUS * 0.92, 0))
        tip = rim + Vector((math.cos(angle) * rng.uniform(0.005, 0.02), math.sin(angle) * rng.uniform(0.005, 0.02),
                            -rng.uniform(0.015, 0.04)))
        b.rod(c, f'flange_shard{i}', rim, tip, rng.uniform(0.008, 0.013), mats['metal'], r2=0.002)
    joints['woundFlange'], joints['woundFlangeEnd'] = base, end
