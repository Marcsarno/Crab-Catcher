extends Control
## Multi-touch gameplay controls: floating joystick, look-drag, action buttons, belt and top-bar buttons.
## Everything is hit-tested here (not with Control buttons) so several fingers work at once.

signal button_pressed(id: String)

var move := Vector2.ZERO
var attack_held := false
var enabled := true
var _look_acc := Vector2.ZERO
var _joy_index := -1
var _joy_center := Vector2.ZERO
var _joy_pos := Vector2.ZERO
var _look_index := -1
var _look_last := Vector2.ZERO
var _btn_touch := {}  # touch index -> button id
var _pressed := {}  # button id -> true
var interact_visible := false
var interact_text := ""
var cooldowns := {}
var hud

var tex := {}
const JOY_R := 105.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	for n in ["joy_base", "joy_knob", "btn_attack", "btn_spell", "btn_action", "btn_heal", "slot"]:
		tex[n] = Util.tex(n)
	for n in ["attack", "spell_firebolt", "spell_heal", "hand", "bag", "map", "char", "menu"]:
		tex[n] = Util.icon(n)


func layout() -> Dictionary:
	var s := get_viewport_rect().size
	var W := s.x
	var H := s.y
	return {
		"attack": [Vector2(W - 138, H - 345), 96.0],
		"fire": [Vector2(W - 300, H - 262), 60.0],
		"heal": [Vector2(W - 278, H - 448), 52.0],
		"interact": [Vector2(W - 138, H - 545), 64.0],
		"joy_home": Vector2(165, H - 330),
		"belt": [Vector2(W / 2.0 - 2 * 92 + 4, H - 112), 84.0, 92.0],
		"top": [Vector2(W - 4 * 96 - 8, 18), 84.0, 96.0],
	}


func consume_look() -> Vector2:
	var v := _look_acc
	_look_acc = Vector2.ZERO
	return v


func release_all() -> void:
	_joy_index = -1
	_look_index = -1
	move = Vector2.ZERO
	attack_held = false
	_btn_touch.clear()
	_pressed.clear()
	queue_redraw()


func _hit_button(p: Vector2) -> String:
	var L := layout()
	for id in ["attack", "fire", "heal"]:
		if p.distance_to(L[id][0]) <= L[id][1] + 14:
			return id
	if interact_visible and p.distance_to(L.interact[0]) <= L.interact[1] + 16:
		return "interact"
	var b: Array = L.belt
	for i in 4:
		var r := Rect2(b[0] + Vector2(i * b[2], 0), Vector2(b[1], b[1]))
		if r.grow(4).has_point(p):
			return "belt%d" % i
	var t: Array = L.top
	var ids := ["map", "bag", "char", "menu"]
	for i in 4:
		var r := Rect2(t[0] + Vector2(i * t[2], 0), Vector2(t[1], t[1]))
		if r.grow(6).has_point(p):
			return ids[i]
	return ""


func _input(event: InputEvent) -> void:
	if not enabled or not visible:
		return
	if event is InputEventScreenTouch:
		var p: Vector2 = event.position
		if event.pressed:
			var id := _hit_button(p)
			if id != "":
				_btn_touch[event.index] = id
				_pressed[id] = true
				if id == "attack":
					attack_held = true
				else:
					button_pressed.emit(id)
				queue_redraw()
				get_viewport().set_input_as_handled()
				return
			var s := get_viewport_rect().size
			if p.x < s.x * 0.5 and p.y > s.y * 0.45 and _joy_index == -1:
				_joy_index = event.index
				_joy_center = p
				_joy_pos = p
				move = Vector2.ZERO
			elif _look_index == -1:
				_look_index = event.index
				_look_last = p
			queue_redraw()
		else:
			if _btn_touch.has(event.index):
				var id: String = _btn_touch[event.index]
				_pressed.erase(id)
				_btn_touch.erase(event.index)
				if id == "attack":
					attack_held = false
			if event.index == _joy_index:
				_joy_index = -1
				move = Vector2.ZERO
			if event.index == _look_index:
				_look_index = -1
			queue_redraw()
	elif event is InputEventScreenDrag:
		if event.index == _joy_index:
			_joy_pos = event.position
			var v: Vector2 = (_joy_pos - _joy_center)
			if v.length() > JOY_R:
				# drag the base along so the stick never "sticks"
				_joy_center = _joy_pos - v.normalized() * JOY_R
				v = v.normalized() * JOY_R
			move = v / JOY_R
			if move.length() < 0.12:
				move = Vector2.ZERO
			queue_redraw()
		elif event.index == _look_index:
			_look_acc += event.position - _look_last
			_look_last = event.position
		elif _btn_touch.has(event.index) and _btn_touch[event.index] == "attack":
			# sliding off the attack button also turns the view, so you can swing and aim
			_look_acc += event.relative * 0.8


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	if not enabled:
		return
	var L := layout()
	var font: Font = UITheme.head_font
	# joystick
	var jc: Vector2 = _joy_center if _joy_index >= 0 else L.joy_home
	var jp: Vector2 = _joy_pos if _joy_index >= 0 else L.joy_home
	var a := 1.0 if _joy_index >= 0 else 0.45
	draw_texture_rect(tex.joy_base, Rect2(jc - Vector2(JOY_R + 20, JOY_R + 20), Vector2(JOY_R + 20, JOY_R + 20) * 2), false, Color(1, 1, 1, a))
	draw_texture_rect(tex.joy_knob, Rect2(jp - Vector2(52, 52), Vector2(104, 104)), false, Color(1, 1, 1, a))
	# action buttons
	_btn(L.attack, "btn_attack", "attack", "attack", "")
	var fire_ok: bool = Game.mana >= 6.0
	_btn(L.fire, "btn_spell", "spell_firebolt", "fire", "", fire_ok)
	_btn(L.heal, "btn_heal", "spell_heal", "heal", "", Game.mana >= 5.0)
	if interact_visible:
		_btn(L.interact, "btn_action", "hand", "interact", "")
		var tw := font.get_string_size(interact_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 28).x
		var pos: Vector2 = L.interact[0] + Vector2(-tw / 2.0, -L.interact[1] - 18)
		pos.x = clampf(pos.x, 10, get_viewport_rect().size.x - tw - 10)
		draw_string_outline(font, pos, interact_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 28, 8, Color(0, 0, 0, 0.9))
		draw_string(font, pos, interact_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 28, Color(1, 0.88, 0.6))
	# belt
	var b: Array = L.belt
	for i in 4:
		var r := Rect2(b[0] + Vector2(i * b[2], 0), Vector2(b[1], b[1]))
		draw_texture_rect(tex.slot, r, false)
		var it = Game.belt[i]
		if it:
			var ic: Texture2D = Util.icon(it.icon)
			if ic:
				draw_texture_rect(ic, r.grow(-8), false, Color(1, 1, 1, 0.6 if _pressed.has("belt%d" % i) else 1.0))
		draw_string_outline(font, r.position + Vector2(8, 26), str(i + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 20, 6, Color.BLACK)
		draw_string(font, r.position + Vector2(8, 26), str(i + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 20, UITheme.GOLD_DIM)
	# top buttons
	var t: Array = L.top
	var ids := ["map", "bag", "char", "menu"]
	for i in 4:
		var r := Rect2(t[0] + Vector2(i * t[2], 0), Vector2(t[1], t[1]))
		draw_texture_rect(tex.slot, r, false, Color(1, 1, 1, 0.9))
		var ic: Texture2D = tex[ids[i]]
		draw_texture_rect(ic, r.grow(-12), false, Color(1, 1, 1, 0.6 if _pressed.has(ids[i]) else 1.0))
		if ids[i] == "char" and Game.stat_points > 0:
			draw_circle(r.position + Vector2(r.size.x - 10, 10), 14, Color(0.9, 0.2, 0.1))
			draw_string(font, r.position + Vector2(r.size.x - 18, 19), "+", HORIZONTAL_ALIGNMENT_LEFT, -1, 26, Color.WHITE)


func _btn(spec: Array, base: String, icon: String, id: String, _label: String, usable := true) -> void:
	var c: Vector2 = spec[0]
	var r: float = spec[1]
	var pressed := _pressed.has(id)
	var s := r * (0.92 if pressed else 1.0)
	var mod := Color(1, 1, 1, 0.92) if usable else Color(0.5, 0.5, 0.5, 0.7)
	draw_texture_rect(tex[base], Rect2(c - Vector2(s, s), Vector2(s, s) * 2), false, mod)
	var ic: Texture2D = tex[icon]
	var isz := s * 1.05
	draw_texture_rect(ic, Rect2(c - Vector2(isz, isz) / 2.0 - Vector2(0, 2), Vector2(isz, isz)), false, mod)
