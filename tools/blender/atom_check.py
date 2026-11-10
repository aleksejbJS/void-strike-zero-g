# Self-check for the procedural atom robot: every game part, joint and material layer tag must exist.
import json

import bpy

PARTS = (
    'head', 'torso', 'pelvis',
    'thighFront', 'shinFront', 'footFront', 'thighBack', 'shinBack', 'footBack',
    'upperArmFront', 'forearmFront', 'upperArmBack', 'forearmBack',
    'handFront', 'handBack', 'palmFront', 'palmBack', 'handFrontGrip', 'handBackGrip',
)
JOINTS = (
    'head', 'hip', 'neck',
    'hipFront', 'kneeFront', 'ankleFront', 'soleFront', 'hipBack', 'kneeBack', 'ankleBack', 'soleBack',
    'shoulderFront', 'elbowFront', 'wristFront', 'shoulderBack', 'elbowBack', 'wristBack',
    'gripFront', 'gripBack',
)
LAYERS = ('paint', 'fixed')


def check(root_name: str = 'AtomRobot') -> list[str]:
    """Return every problem found; an empty list means the model is complete."""
    problems: list[str] = []
    root = bpy.data.collections.get(root_name)
    if root is None:
        return [f'collection {root_name} is missing']
    children = {c.name: c for c in root.children}
    for part in PARTS:
        coll = children.get(f'part_{part}')
        if coll is None or not coll.objects:
            problems.append(f'part_{part} is missing or empty')
    joints = json.loads(bpy.context.scene.get('atom_robot_joints', '{}'))
    problems += [f'joint {name} is missing' for name in JOINTS if name not in joints]
    for coll in root.children:
        for obj in coll.objects:
            for mat in obj.data.materials:
                if mat is None or mat.get('layer') not in LAYERS:
                    problems.append(f'{obj.name}: material {mat.name if mat else None} has no layer tag')
    return problems
