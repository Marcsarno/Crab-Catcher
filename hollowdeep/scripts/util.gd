class_name Util
extends RefCounted
## Shared helpers: model loading, materials, effects.

const LAYER_WORLD := 1
const LAYER_PLAYER := 2
const LAYER_MONSTER := 4

static var _models := {}
static var _tex := {}
static var _mats := {}
static var _grime: Texture2D


static func tex(name: String) -> Texture2D:
	if not _tex.has(name):
		var p := "res://assets/textures/%s.png" % name
		if not ResourceLoader.exists(p):
			p = "res://assets/ui/%s.png" % name
		if not ResourceLoader.exists(p):
			p = "res://assets/icons/%s.png" % name
		_tex[name] = load(p) if ResourceLoader.exists(p) else null
	return _tex[name]


static func icon(name: String) -> Texture2D:
	return tex(name)


static func model(name: String) -> Node3D:
	if name == "":
		return Node3D.new()
	if not _models.has(name):
		_models[name] = load("res://assets/models/%s.glb" % name)
	var scene: PackedScene = _models[name]
	var n: Node3D = scene.instantiate()
	_dress(n)
	return n


## Gives imported flat-colour materials a subtle triplanar grime texture.
static func _dress(n: Node) -> void:
	if _grime == null:
		_grime = tex("grime")
	if n is MeshInstance3D:
		var mi: MeshInstance3D = n
		if mi.mesh:
			for s in mi.mesh.get_surface_count():
				var m := mi.mesh.surface_get_material(s)
				if m is StandardMaterial3D and not m.has_meta("dressed"):
					m.set_meta("dressed", true)
					if not m.emission_enabled:
						m.albedo_texture = _grime
						m.uv1_triplanar = true
						m.uv1_scale = Vector3(1.6, 1.6, 1.6)
						m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
						m.albedo_color = m.albedo_color * 1.15
					else:
						m.emission_energy_multiplier = 2.5
	for c in n.get_children():
		_dress(c)


static func set_layers(n: Node, visible_layers: int) -> void:
	if n is VisualInstance3D:
		n.layers = visible_layers
	for c in n.get_children():
		set_layers(c, visible_layers)


static func set_vis_range(n: Node, dist: float) -> void:
	if n is GeometryInstance3D:
		n.visibility_range_end = dist
		n.visibility_range_end_margin = 2.0
		n.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_DISABLED
	for c in n.get_children():
		set_vis_range(c, dist)


static func world_mat(name: String, uv_scale := 1.0) -> StandardMaterial3D:
	var key := "%s_%s" % [name, uv_scale]
	if not _mats.has(key):
		var m := StandardMaterial3D.new()
		m.albedo_texture = tex(name)
		m.roughness = 0.92
		m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
		m.uv1_scale = Vector3(uv_scale, uv_scale, 1)
		_mats[key] = m
	return _mats[key]


static func additive_mat(color: Color, texname := "glow") -> StandardMaterial3D:
	var key := "add_%s_%s" % [color.to_html(), texname]
	if not _mats.has(key):
		var m := StandardMaterial3D.new()
		m.albedo_texture = tex(texname)
		m.albedo_color = color
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		m.vertex_color_use_as_albedo = true
		m.no_depth_test = false
		m.disable_receive_shadows = true
		_mats[key] = m
	return _mats[key]


static func flame_particles(amount := 14, scale := 1.0) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = amount
	p.lifetime = 0.55
	p.preprocess = 0.6
	var q := QuadMesh.new()
	q.size = Vector2(0.28, 0.28) * scale
	q.material = additive_mat(Color(1.0, 0.55, 0.18))
	p.mesh = q
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 0.05 * scale
	p.direction = Vector3.UP
	p.spread = 12
	p.gravity = Vector3(0, 1.2, 0)
	p.initial_velocity_min = 0.3 * scale
	p.initial_velocity_max = 0.7 * scale
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.1
	var curve := Curve.new()
	curve.add_point(Vector2(0, 0.6))
	curve.add_point(Vector2(0.3, 1.0))
	curve.add_point(Vector2(1, 0.0))
	p.scale_amount_curve = curve
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 0.9, 0.5, 1))
	grad.set_color(1, Color(0.8, 0.1, 0.0, 0))
	p.color_ramp = grad
	return p


static func burst(parent: Node, pos: Vector3, color: Color, amount := 16, speed := 3.0, size := 0.12, gravity := -9.0, life := 0.6, additive := false) -> void:
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.explosiveness = 0.95
	p.amount = amount
	p.lifetime = life
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	if additive:
		q.material = additive_mat(Color.WHITE)
	else:
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.vertex_color_use_as_albedo = true
		m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		q.material = m
	p.mesh = q
	p.direction = Vector3.UP
	p.spread = 70
	p.initial_velocity_min = speed * 0.4
	p.initial_velocity_max = speed
	p.gravity = Vector3(0, gravity, 0)
	p.color = color
	var grad := Gradient.new()
	grad.set_color(0, color)
	grad.set_color(1, Color(color.r, color.g, color.b, 0))
	p.color_ramp = grad
	p.scale_amount_min = 0.5
	p.scale_amount_max = 1.2
	parent.add_child(p)
	p.global_position = pos
	p.emitting = true
	parent.get_tree().create_timer(life + 0.3).timeout.connect(p.queue_free)


static func blood_splat(parent: Node, pos: Vector3, size := 1.2) -> void:
	var mi := MeshInstance3D.new()
	var q := PlaneMesh.new()
	q.size = Vector2(size, size)
	mi.mesh = q
	var key := "blood_decal"
	if not _mats.has(key):
		var m := StandardMaterial3D.new()
		m.albedo_texture = tex("blood")
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.roughness = 0.3
		_mats[key] = m
	mi.material_override = _mats[key]
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	mi.global_position = Vector3(pos.x, 0.02 + randf() * 0.01, pos.z)
	mi.rotation.y = randf() * TAU


static func float_text(parent: Node, pos: Vector3, text: String, color: Color, size := 64) -> void:
	var l := Label3D.new()
	l.text = text
	l.font = preload("res://assets/fonts/Cinzel.ttf")
	l.font_size = size
	l.pixel_size = 0.004
	l.modulate = color
	l.outline_modulate = Color(0, 0, 0, 0.9)
	l.outline_size = 12
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = false
	parent.add_child(l)
	l.global_position = pos + Vector3(randf_range(-0.2, 0.2), 0, randf_range(-0.2, 0.2))
	var tw := l.create_tween().set_parallel(true)
	tw.tween_property(l, "global_position", l.global_position + Vector3(0, 0.9, 0), 0.9).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.tween_property(l, "modulate:a", 0.0, 0.5).set_delay(0.45)
	tw.chain().tween_callback(l.queue_free)
