extends Node3D
## An item lying on the floor, with a floating name and a light beam for magic items.

var item: Dictionary
var level
var t := 0.0
var model: Node3D
var name_label: Label3D


func setup(it: Dictionary, lvl) -> void:
	item = it
	level = lvl


func _ready() -> void:
	add_to_group("interactable")
	add_to_group("pickups")
	model = Util.model(item.get("model", "item_gold"))
	var sc: float = item.get("scale", 1.0)
	if item.kind == "weapon":
		model.rotation = Vector3(PI / 2.0, randf() * TAU, 0)
		model.position.y = 0.06
		sc *= 0.9
	elif item.kind == "shield":
		model.rotation = Vector3(-PI / 2.0, 0, randf() * TAU)
		model.position.y = 0.08
	model.scale = Vector3.ONE * sc
	add_child(model)
	var rar: int = item.get("rarity", 0)
	var col: Color = Game.Items.RARITY_COLORS[rar]
	name_label = Label3D.new()
	name_label.text = item.name if item.kind != "gold" else "%d Gold" % item.amount
	name_label.font = preload("res://assets/fonts/Cinzel.ttf")
	name_label.font_size = 40
	name_label.pixel_size = 0.004
	name_label.outline_size = 10
	name_label.modulate = col if item.kind != "gold" else Color(1, 0.85, 0.4)
	name_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	name_label.no_depth_test = true
	name_label.position.y = 0.75
	name_label.visibility_range_end = 9.0
	add_child(name_label)
	if rar > 0 or item.kind == "gold":
		var beam := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.size = Vector2(0.5, 2.2)
		var m := StandardMaterial3D.new()
		m.albedo_texture = Util.tex("glow")
		m.albedo_color = Color(col.r, col.g, col.b, 0.5) if item.kind != "gold" else Color(1, 0.8, 0.3, 0.25)
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y
		q.material = m
		beam.mesh = q
		beam.position.y = 0.9
		add_child(beam)


func _process(delta: float) -> void:
	t += delta
	if name_label:
		name_label.position.y = 0.75 + sin(t * 2.0) * 0.04


func interact_pos() -> Vector3:
	return global_position + Vector3(0, 0.3, 0)


func interact_label() -> String:
	return "Take %s" % (item.name if item.kind != "gold" else "gold")


func can_interact() -> bool:
	return true


func interact(_player) -> void:
	if Game.add_item(item):
		Sfx.play("gold" if item.kind == "gold" else "pickup")
		if item.kind == "gold":
			Game.message.emit("+%d gold" % item.amount, Color(1, 0.85, 0.4))
		else:
			Game.message.emit(item.name, Game.Items.RARITY_COLORS[item.get("rarity", 0)])
		level.item_taken(self)
		queue_free()
