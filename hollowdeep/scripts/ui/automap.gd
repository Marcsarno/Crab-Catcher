extends Control
## Translucent overlay map of explored dungeon cells, centred on the hero (north up).

var level
var player
var scale_px := 13.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


func _process(_d: float) -> void:
	if visible:
		queue_redraw()


func _draw() -> void:
	if level == null or level.gen == null or player == null:
		return
	var gen = level.gen
	var s := get_viewport_rect().size
	draw_rect(Rect2(Vector2.ZERO, s), Color(0, 0, 0, 0.35))
	var center := Vector2(s.x / 2.0, s.y * 0.42)
	var pp: Vector2 = Vector2(player.global_position.x, player.global_position.z) / level.CELL
	var line := Color(0.85, 0.7, 0.45, 0.85)
	var floor_col := Color(0.4, 0.33, 0.24, 0.35)
	for y in gen.h:
		for x in gen.w:
			if level.explored[y * gen.w + x] == 0 or not gen.floor_at(x, y):
				continue
			var o: Vector2 = center + (Vector2(x, y) - pp) * scale_px
			if o.x < -20 or o.y < -20 or o.x > s.x + 20 or o.y > s.y + 20:
				continue
			draw_rect(Rect2(o, Vector2(scale_px, scale_px)), floor_col)
			if not gen.floor_at(x, y - 1):
				draw_line(o, o + Vector2(scale_px, 0), line, 2.0)
			if not gen.floor_at(x, y + 1):
				draw_line(o + Vector2(0, scale_px), o + Vector2(scale_px, scale_px), line, 2.0)
			if not gen.floor_at(x - 1, y):
				draw_line(o, o + Vector2(0, scale_px), line, 2.0)
			if not gen.floor_at(x + 1, y):
				draw_line(o + Vector2(scale_px, 0), o + Vector2(scale_px, scale_px), line, 2.0)
	for d in gen.doors:
		var c: Vector2i = d.cell
		if level.explored[c.y * gen.w + c.x] == 0:
			continue
		var o: Vector2 = center + (Vector2(c) + Vector2(0.5, 0.5) - pp) * scale_px
		draw_rect(Rect2(o - Vector2(3, 3), Vector2(6, 6)), Color(0.7, 0.45, 0.2))
	_marker(gen.stairs_up, center, pp, Color(0.5, 0.8, 1.0), "Up")
	if gen.stairs_down.x >= 0:
		_marker(gen.stairs_down, center, pp, Color(1.0, 0.4, 0.3), "Down")
	# hero arrow
	var yaw: float = player.yaw
	var dir := Vector2(-sin(yaw), -cos(yaw))
	var side := Vector2(dir.y, -dir.x)
	var tip := center + dir * 12
	draw_colored_polygon(PackedVector2Array([tip, center - dir * 7 + side * 7, center - dir * 3, center - dir * 7 - side * 7]), Color(1, 0.9, 0.4))


func _marker(c: Vector2i, center: Vector2, pp: Vector2, col: Color, txt: String) -> void:
	if level.explored[c.y * level.gen.w + c.x] == 0:
		return
	var o: Vector2 = center + (Vector2(c) + Vector2(0.5, 0.5) - pp) * scale_px
	draw_circle(o, 7, col)
	draw_string(UITheme.head_font, o + Vector2(10, 7), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, col)
