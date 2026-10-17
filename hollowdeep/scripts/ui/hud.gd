extends CanvasLayer
## In-game overlay: orbs, bars, messages, target info, flashes, map and the menu layer.

const TouchControls = preload("res://scripts/ui/touch_controls.gd")
const Orb = preload("res://scripts/ui/orb.gd")
const Automap = preload("res://scripts/ui/automap.gd")
const Menus = preload("res://scripts/ui/menus.gd")

var main
var root: Control
var controls
var hp_orb
var mana_orb
var flash_rect: ColorRect
var fade_rect: ColorRect
var area_label: Label
var gold_label: Label
var xp_bar: ProgressBar
var target_box: VBoxContainer
var target_name: Label
var target_bar: ProgressBar
var boss_box: VBoxContainer
var boss_name: Label
var boss_bar: ProgressBar
var boss_ref = null
var target_ref = null
var msg_box: VBoxContainer
var banner: Label
var banner_sub: Label
var automap
var menus
var gameplay_visible := false


func _ready() -> void:
	layer = 5
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UITheme.get_theme()
	add_child(root)

	var vig := TextureRect.new()
	vig.texture = Util.tex("vignette")
	vig.set_anchors_preset(Control.PRESET_FULL_RECT)
	vig.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	vig.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vig.modulate = Color(1, 1, 1, 0.85)
	root.add_child(vig)

	flash_rect = ColorRect.new()
	flash_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	flash_rect.color = Color(0.8, 0, 0, 0)
	flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(flash_rect)

	automap = Automap.new()
	automap.visible = false
	root.add_child(automap)

	# --- top-left area info
	var top := VBoxContainer.new()
	top.position = Vector2(18, 16)
	top.add_theme_constant_override("separation", 2)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(top)
	area_label = UITheme.label("", 28, UITheme.GOLD, UITheme.head_font)
	top.add_child(area_label)
	gold_label = UITheme.label("", 21, Color(1, 0.85, 0.4), UITheme.head_font)
	top.add_child(gold_label)
	xp_bar = ProgressBar.new()
	xp_bar.custom_minimum_size = Vector2(240, 10)
	xp_bar.show_percentage = false
	var xf := StyleBoxFlat.new()
	xf.bg_color = Color(0.85, 0.7, 0.3)
	xf.set_corner_radius_all(3)
	xp_bar.add_theme_stylebox_override("fill", xf)
	top.add_child(xp_bar)

	# --- target info (top centre, under the bar)
	target_box = _bar_box(Vector2(0, 128))
	target_name = target_box.get_child(0)
	target_bar = target_box.get_child(1)
	boss_box = _bar_box(Vector2(0, 205))
	boss_name = boss_box.get_child(0)
	boss_bar = boss_box.get_child(1)
	boss_name.add_theme_color_override("font_color", Color(1, 0.55, 0.3))
	boss_box.visible = false

	# --- messages
	msg_box = VBoxContainer.new()
	msg_box.set_anchors_preset(Control.PRESET_CENTER_TOP)
	msg_box.position = Vector2(-330, 290)
	msg_box.custom_minimum_size = Vector2(660, 0)
	msg_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	msg_box.add_theme_constant_override("separation", 2)
	root.add_child(msg_box)

	# --- level banner
	banner = UITheme.label("", 56, UITheme.GOLD, UITheme.title_font)
	banner.set_anchors_preset(Control.PRESET_CENTER)
	banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.custom_minimum_size = Vector2(700, 0)
	banner.position = Vector2(-350, -250)
	banner.modulate.a = 0
	banner.autowrap_mode = TextServer.AUTOWRAP_WORD
	root.add_child(banner)
	banner_sub = UITheme.label("", 30, UITheme.TEXT, UITheme.head_font)
	banner_sub.set_anchors_preset(Control.PRESET_CENTER)
	banner_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner_sub.custom_minimum_size = Vector2(700, 0)
	banner_sub.position = Vector2(-340, -160)
	banner_sub.custom_minimum_size = Vector2(680, 0)
	banner_sub.autowrap_mode = TextServer.AUTOWRAP_WORD
	banner_sub.modulate.a = 0
	root.add_child(banner_sub)

	# --- orbs
	hp_orb = Orb.new()
	hp_orb.liquid_color = Color(0.85, 0.06, 0.04)
	hp_orb.size = Vector2(190, 190)
	root.add_child(hp_orb)
	mana_orb = Orb.new()
	mana_orb.liquid_color = Color(0.12, 0.25, 0.95)
	mana_orb.size = Vector2(190, 190)
	root.add_child(mana_orb)

	controls = TouchControls.new()
	controls.hud = self
	root.add_child(controls)
	controls.button_pressed.connect(_on_button)

	menus = Menus.new()
	menus.hud = self
	root.add_child(menus)

	fade_rect = ColorRect.new()
	fade_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade_rect.color = Color(0, 0, 0, 1)
	fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(fade_rect)

	Game.message.connect(show_message)
	Game.leveled_up.connect(_on_level_up)
	get_viewport().size_changed.connect(_relayout)
	_relayout()
	set_gameplay_visible(false)


func _bar_box(pos: Vector2) -> VBoxContainer:
	var b := VBoxContainer.new()
	b.set_anchors_preset(Control.PRESET_CENTER_TOP)
	b.position = Vector2(-200, pos.y)
	b.custom_minimum_size = Vector2(400, 0)
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_theme_constant_override("separation", 4)
	var l := UITheme.label("", 28, UITheme.TEXT, UITheme.head_font)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.add_child(l)
	var bar := ProgressBar.new()
	bar.custom_minimum_size = Vector2(400, 16)
	bar.show_percentage = false
	b.add_child(bar)
	b.visible = false
	root.add_child(b)
	return b


func _relayout() -> void:
	var s := root.get_viewport_rect().size
	hp_orb.position = Vector2(6, s.y - 200)
	mana_orb.position = Vector2(s.x - 196, s.y - 200)


func set_gameplay_visible(v: bool) -> void:
	gameplay_visible = v
	for n in [hp_orb, mana_orb, controls, area_label.get_parent(), msg_box]:
		n.visible = v
	if not v:
		target_box.visible = false
		boss_box.visible = false
		automap.visible = false


func menu_open() -> bool:
	return menus.is_open()


func _process(_delta: float) -> void:
	if not gameplay_visible:
		return
	var mh := Game.max_hp()
	var mm := Game.max_mana()
	hp_orb.fill = clampf(Game.hp / mh, 0.0, 1.0)
	mana_orb.fill = clampf(Game.mana / max(mm, 1.0), 0.0, 1.0)
	hp_orb.value_text = "%d/%d" % [ceili(Game.hp), int(mh)]
	mana_orb.value_text = "%d/%d" % [int(Game.mana), int(mm)]
	area_label.text = Game.DEPTH_NAMES[Game.depth]
	gold_label.text = ("Level %d   ·   " % Game.depth if Game.depth > 0 else "") + "Hero lv %d   ·   %d gold" % [Game.clvl, Game.gold]
	var lo: int = Game.XP_TABLE[Game.clvl]
	var hi: int = Game.xp_for_next()
	xp_bar.value = 100.0 * (Game.xp - lo) / max(1, hi - lo)
	if target_ref and is_instance_valid(target_ref) and target_ref.is_alive() and target_ref != boss_ref:
		target_box.visible = true
		target_name.text = target_ref.display_name
		target_name.add_theme_color_override("font_color", Color(0.55, 0.65, 1.0) if target_ref.champion else UITheme.TEXT)
		target_bar.value = 100.0 * target_ref.hp / target_ref.max_hp
	else:
		target_box.visible = false
	if boss_ref and is_instance_valid(boss_ref) and boss_ref.is_alive():
		boss_box.visible = true
		boss_bar.value = 100.0 * boss_ref.hp / boss_ref.max_hp
	else:
		boss_box.visible = false
	controls.enabled = not menus.is_open()


func set_target(m) -> void:
	target_ref = m


func show_boss(m) -> void:
	boss_ref = m
	boss_name.text = m.display_name


func set_interact(t) -> void:
	controls.interact_visible = t != null
	controls.interact_text = t.interact_label() if t else ""


func flash(col: Color) -> void:
	flash_rect.color = col
	var tw := create_tween()
	tw.tween_property(flash_rect, "color:a", 0.0, 0.45)


func fade(to_black: bool, time := 0.35) -> Tween:
	var tw := create_tween()
	tw.tween_property(fade_rect, "color:a", 1.0 if to_black else 0.0, time)
	return tw


func show_banner(title: String, sub := "") -> void:
	banner.text = title
	banner_sub.text = sub
	var tw := create_tween()
	tw.tween_property(banner, "modulate:a", 1.0, 0.6)
	tw.parallel().tween_property(banner_sub, "modulate:a", 1.0, 0.8)
	tw.tween_interval(2.0)
	tw.tween_property(banner, "modulate:a", 0.0, 0.9)
	tw.parallel().tween_property(banner_sub, "modulate:a", 0.0, 0.9)


func show_message(text: String, color := UITheme.TEXT) -> void:
	var l := UITheme.label(text, 28, color, UITheme.head_font)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.custom_minimum_size = Vector2(660, 0)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD
	msg_box.add_child(l)
	while msg_box.get_child_count() > 4:
		msg_box.get_child(0).queue_free()
		msg_box.remove_child(msg_box.get_child(0))
	var tw := l.create_tween()
	tw.tween_interval(3.0)
	tw.tween_property(l, "modulate:a", 0.0, 0.8)
	tw.tween_callback(l.queue_free)


func _on_level_up(lvl: int) -> void:
	Sfx.play("levelup")
	flash(Color(1, 0.85, 0.4, 0.3))
	show_banner("Level %d" % lvl, "+5 stat points — tap the hero button")


func _on_button(id: String) -> void:
	if menus.is_open():
		return
	match id:
		"fire":
			main.player.cast_firebolt()
		"heal":
			main.player.cast_heal()
		"interact":
			main.player.do_interact()
		"map":
			if Game.depth == 0:
				show_message("Hollowmere — the cathedral lies to the north.", UITheme.GOLD)
			else:
				automap.visible = not automap.visible
				Sfx.play("click", -4.0)
		"bag":
			controls.release_all()
			menus.open_inventory()
		"char":
			controls.release_all()
			menus.open_character()
		"menu":
			controls.release_all()
			menus.open_pause()
		_:
			if id.begins_with("belt"):
				Game.use_belt(int(id.substr(4)))


func open_npc(npc: String) -> void:
	controls.release_all()
	menus.open_npc(npc)


func _unhandled_input(event: InputEvent) -> void:
	if not gameplay_visible:
		return
	if event.is_action_pressed("inventory"):
		if menus.is_open():
			menus.close()
		else:
			menus.open_inventory()
	elif event.is_action_pressed("character"):
		if menus.is_open():
			menus.close()
		else:
			menus.open_character()
	elif event.is_action_pressed("map") and Game.depth > 0:
		automap.visible = not automap.visible
	elif event.is_action_pressed("pause"):
		if menus.is_open():
			menus.close()
		else:
			menus.open_pause()
