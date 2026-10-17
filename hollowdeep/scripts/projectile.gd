extends Node3D
## Arrows, fire bolts and dark bolts. Moves in a straight line and checks walls and targets each frame.

var kind := "arrow"
var dir := Vector3.FORWARD
var speed := 16.0
var owner_node  # monster or player
var from_player := false
var damage := 1
var tohit := 50
var level
var life := 3.0
var light: OmniLight3D


func setup(k: String, origin: Vector3, direction: Vector3, owner_ref, dmg: int, hit: int, lvl) -> void:
	kind = k
	dir = direction.normalized()
	owner_node = owner_ref
	damage = dmg
	tohit = hit
	level = lvl
	from_player = owner_ref == lvl.player
	position = origin
	match kind:
		"arrow":
			speed = 17.0
		"bolt":
			speed = 11.0
		"bolt_green":
			speed = 10.0
		"fire":
			speed = 19.0


func _ready() -> void:
	match kind:
		"arrow":
			var mi := MeshInstance3D.new()
			var bm := BoxMesh.new()
			bm.size = Vector3(0.03, 0.03, 0.7)
			var m := StandardMaterial3D.new()
			m.albedo_color = Color(0.55, 0.42, 0.28)
			bm.material = m
			mi.mesh = bm
			add_child(mi)
			look_at(global_position + dir, Vector3.UP)
		_:
			var col := Color(1.0, 0.5, 0.15)
			if kind == "bolt":
				col = Color(0.85, 0.25, 1.0)
			elif kind == "bolt_green":
				col = Color(0.35, 1.0, 0.45)
			var core := MeshInstance3D.new()
			var q := QuadMesh.new()
			q.size = Vector2(0.9, 0.9)
			q.material = Util.additive_mat(col)
			core.mesh = q
			add_child(core)
			var core2 := MeshInstance3D.new()
			var q2 := QuadMesh.new()
			q2.size = Vector2(0.4, 0.4)
			q2.material = Util.additive_mat(Color(1, 1, 0.9))
			core2.mesh = q2
			add_child(core2)
			var trail := Util.flame_particles(20, 1.2)
			trail.local_coords = false
			trail.color = col
			var grad := Gradient.new()
			grad.set_color(0, col)
			grad.set_color(1, Color(col.r * 0.3, col.g * 0.1, col.b * 0.1, 0))
			trail.color_ramp = grad
			trail.preprocess = 0.0
			trail.gravity = Vector3.ZERO
			add_child(trail)
			light = OmniLight3D.new()
			light.light_color = col
			light.omni_range = 6.0
			light.light_energy = 2.2
			add_child(light)
			Util.set_layers(self, 1)


func _physics_process(delta: float) -> void:
	life -= delta
	if life <= 0.0:
		queue_free()
		return
	var step := dir * speed * delta
	var from := global_position
	var to := from + step
	# world collision
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(from, to, Util.LAYER_WORLD)
	var res := space.intersect_ray(q)
	if res:
		_impact(res.position, null)
		return
	global_position = to
	if from_player:
		for m in get_tree().get_nodes_in_group("hittable"):
			if m.has_method("hit_center") and m.hit_center().distance_to(to) < 0.9:
				_impact(to, m)
				return
	else:
		var p = level.player
		if p and p.alive and p.eye_position().distance_to(to + Vector3(0, 0.2, 0)) < 0.75:
			_impact(to, p)
			return


func _impact(pos: Vector3, target) -> void:
	if kind != "arrow":
		var col := Color(1.0, 0.55, 0.2) if kind == "fire" else (Color(0.85, 0.3, 1.0) if kind == "bolt" else Color(0.4, 1.0, 0.5))
		Util.burst(level, pos, col, 26, 5.0, 0.2, -2.0, 0.5, true)
		Sfx.play_at("explode" if kind == "fire" else "magic_bolt", pos, -3.0)
		level.flash_light(pos, col)
	if target:
		if from_player:
			target.take_hit(damage, owner_node, true)
		else:
			target.receive_attack(owner_node, damage, tohit, owner_node.mlvl if is_instance_valid(owner_node) else 5, kind != "arrow")
	queue_free()
