# Saves the owner's open scene as a copy at art/3d/atom-robot.blend (their own file stays untouched).
import os
import bpy

out = os.path.join(TOOLS_DIR, '..', '..', 'art', '3d', 'atom-robot.blend')
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out), copy=True)
result['saved'] = os.path.abspath(out)
