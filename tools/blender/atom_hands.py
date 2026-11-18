# Hand poses of the atom robot. The robot faces +X; its near (camera) side is -Y.
# open:  handFront/handBack, relaxed, pivot at the wrist (used when weaponless).
# grip:  palm<Side> (drawn under the weapon: palm and thumb on the far side of the handle) and
#        hand<Side>Grip (drawn over it: back of the hand and curled fingers on the near side).
#        Pivot at the handle centre; the game turns them with the gun, barrel along +X.
import math

from mathutils import Vector

FINGER_R = 0.017
GRIP_TILT = math.radians(12)   # a pistol grip leans back toward its bottom


def open_hand(b, mats, slot: str, wrist: Vector) -> None:
    c = b.part(f'hand{slot}')
    b.box(c, f'palm_open_{slot}', wrist + Vector((0.0, 0, -0.09)), (0.14, 0.09, 0.17), mats['paint'], bevel=0.025)
    for i, dx in enumerate((-0.045, 0.0, 0.045)):
        # Fingers bend a little toward the front instead of hanging dead straight
        b.rod(c, f'finger_open_{slot}{i}', wrist + Vector((dx, 0, -0.16)), wrist + Vector((dx + 0.035, 0, -0.29)),
              0.022, mats['paint'])
    b.rod(c, f'thumb_open_{slot}', wrist + Vector((0.08, 0, -0.07)), wrist + Vector((0.15, 0, -0.14)), 0.022, mats['paint'])


def _tilted(v: Vector) -> Vector:
    """Offset in the pistol grip's frame (handle along -Z, leaning back) -> world offset."""
    c, s = math.cos(GRIP_TILT), math.sin(GRIP_TILT)
    return Vector((v.x * c - v.z * s, v.y, v.x * s + v.z * c))


def pistol_grip(b, mats, grip: Vector) -> None:
    """Front hand on the pistol grip: fingers wrap the front of a vertical handle."""
    under, over = b.part('palmFront'), b.part('handFrontGrip')
    b.box(under, 'palm_grip_Front', grip + _tilted(Vector((-0.015, 0.045, 0.0))), (0.09, 0.03, 0.12),
          mats['paint'], bevel=0.012, rot=(0, -GRIP_TILT, 0))
    b.rod(under, 'thumb_grip_Front', grip + _tilted(Vector((-0.035, 0.04, 0.055))), grip + _tilted(Vector((0.04, 0.03, 0.05))),
          FINGER_R, mats['paint'])
    b.box(over, 'back_grip_Front', grip + _tilted(Vector((-0.03, -0.05, 0.0))), (0.06, 0.03, 0.125),
          mats['paint'], bevel=0.012, rot=(0, -GRIP_TILT, 0))
    for i in range(4):
        z = 0.045 - i * 0.03
        b.rod(over, f'finger_grip_Front{i}', grip + _tilted(Vector((-0.02, -0.05, z))), grip + _tilted(Vector((0.04, -0.022, z))),
              FINGER_R, mats['paint'])


def foregrip(b, mats, grip: Vector) -> None:
    """Back hand under the barrel: palm below the foregrip, fingers curl up over its near side."""
    under, over = b.part('palmBack'), b.part('handBackGrip')
    b.box(under, 'palm_grip_Back', grip + Vector((0.0, 0.015, -0.045)), (0.12, 0.08, 0.035), mats['paint'], bevel=0.012)
    b.rod(under, 'thumb_grip_Back', grip + Vector((-0.05, 0.045, 0.0)), grip + Vector((0.03, 0.045, 0.02)), FINGER_R, mats['paint'])
    for i in range(4):
        x = -0.045 + i * 0.03
        b.rod(over, f'finger_grip_Back{i}', grip + Vector((x, -0.03, -0.045)), grip + Vector((x, -0.04, 0.02)),
              FINGER_R, mats['paint'])


def build_hands(b, mats, joints: dict) -> None:
    for slot in ('Front', 'Back'):
        open_hand(b, mats, slot, joints[f'wrist{slot}'])
    joints['gripFront'] = joints['wristFront'] + Vector((0.12, 0, -0.12))
    joints['gripBack'] = joints['wristBack'] + Vector((0.12, 0, -0.12))
    pistol_grip(b, mats, joints['gripFront'])
    foregrip(b, mats, joints['gripBack'])
