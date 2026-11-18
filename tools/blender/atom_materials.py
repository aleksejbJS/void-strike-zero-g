# Materials of the atom robot. Each carries a `layer` tag: "paint" pixels are tinted by the builder colour
# in the game, "fixed" pixels never are (metal, eyes, red accents, rust, chips, outline).
import bpy


def hexc(h: str, a: float = 1.0):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)) + (a,)


def _fresh(name: str, layer: str):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat['layer'] = layer
    nt = mat.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat, nt, bsdf


def _noise(nt, scale: float):
    coord = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 9
    noise.inputs['Roughness'].default_value = 0.62
    nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])
    return noise


def _ramp(nt, stops):
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = stops[0]
    e[1].position, e[1].color = stops[-1]
    for pos, col in stops[1:-1]:
        el = e.new(pos); el.color = col
    return ramp


def flat(name: str, layer: str, color: str, metal=0.0, rough=0.7, glow=None):
    mat, _, bsdf = _fresh(name, layer)
    bsdf.inputs['Base Color'].default_value = hexc(color)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    if glow:
        bsdf.inputs['Emission Color'].default_value = hexc(glow)
        bsdf.inputs['Emission Strength'].default_value = 2.5
    return mat


def mottled(name: str, base: str, spot: str, rim: str, cut=0.6, scale=7.0, metal=0.0, rough=0.7):
    """A fixed surface with its own worn spots (red accents, metal)."""
    mat, nt, bsdf = _fresh(name, 'fixed')
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    ramp = _ramp(nt, [(0.0, hexc(base)), (cut, hexc(base)), (cut + 0.03, hexc(rim)), (1.0, hexc(spot))])
    nt.links.new(_noise(nt, scale).outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def wear():
    """Decal over paint: rust spots with dark rims, plus dark chips where the surface turns away (edges)."""
    mat, nt, bsdf = _fresh('ar_wear', 'fixed')
    bsdf.inputs['Roughness'].default_value = 0.8
    spots = _noise(nt, 7.0)
    color = _ramp(nt, [(0.0, hexc('#5a2c18')), (0.6, hexc('#5a2c18')), (0.64, hexc('#c05a26')), (1.0, hexc('#d77a3c'))])
    alpha = _ramp(nt, [(0.0, (0, 0, 0, 1)), (0.595, (0, 0, 0, 1)), (0.6, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
    nt.links.new(spots.outputs['Fac'], color.inputs['Fac']); nt.links.new(spots.outputs['Fac'], alpha.inputs['Fac'])
    edge = nt.nodes.new('ShaderNodeLayerWeight'); edge.inputs['Blend'].default_value = 0.35
    grit = _noise(nt, 42.0)
    chips = nt.nodes.new('ShaderNodeMath'); chips.operation = 'MULTIPLY'
    nt.links.new(edge.outputs['Facing'], chips.inputs[0]); nt.links.new(grit.outputs['Fac'], chips.inputs[1])
    chip_mask = _ramp(nt, [(0.0, (0, 0, 0, 1)), (0.36, (0, 0, 0, 1)), (0.4, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
    nt.links.new(chips.outputs['Value'], chip_mask.inputs['Fac'])
    tint = nt.nodes.new('ShaderNodeMix'); tint.data_type = 'RGBA'
    tint.inputs['B'].default_value = hexc('#6b4a33')
    nt.links.new(chip_mask.outputs['Color'], tint.inputs['Factor'])
    nt.links.new(color.outputs['Color'], tint.inputs['A'])
    nt.links.new(tint.outputs['Result'], bsdf.inputs['Base Color'])
    both = nt.nodes.new('ShaderNodeMath'); both.operation = 'MAXIMUM'
    nt.links.new(alpha.outputs['Color'], both.inputs[0]); nt.links.new(chip_mask.outputs['Color'], both.inputs[1])
    nt.links.new(both.outputs['Value'], bsdf.inputs['Alpha'])
    return mat


def palette():
    """Every material the robot uses, keyed by role."""
    outline = flat('ar_outline', 'fixed', '#24160f', rough=1.0)
    outline.use_backface_culling = True
    return {
        'paint': flat('ar_cream', 'paint', '#f4f1ec'),
        'red': mottled('ar_red', '#c94a2a', '#e8cfa8', '#8f3a22', cut=0.64),
        'metal': mottled('ar_metal', '#8a6a52', '#b08868', '#5e4433', cut=0.55, scale=11, metal=0.55, rough=0.42),
        'dark': flat('ar_dark', 'fixed', '#2b1f18', rough=0.9),
        'eye': flat('ar_eye', 'fixed', '#ffd23a', rough=0.2, glow='#ffc21a'),
        'outline': outline,
        'wear': wear(),
    }
