extends Control
## Full-screen menus: title, inventory, character sheet, shops, dialogue, pause, death and victory.

var hud
var current: Control = null
var current_kind := ""
var selected := {}  # {"from": "inv"|"equip"|"shop", "index"/"slot", "item"}
var shop_kind := ""
var shop_tab := "buy"

const NPC_INFO := {
	"healer": {"title": "Maera the Healer", "greeting": [
		"Mind the blood on your boots, stranger. Most who go into that cathedral come back to me in pieces, if at all.",
		"Sit a moment. Herbs for the body, prayers for the rest — and I'll take your coin for both.",
		"The bells have been silent for a month. I sleep worse without them than I ever did with them."]},
	"smith": {"title": "Brannoc the Smith", "greeting": [
		"Steel's honest. It does what you make it do. Can't say the same for whatever's under that church.",
		"Bring me what you pry off the dead down there and I'll pay fair. Need an edge? I've got edges.",
		"Forge has been hungry since the mines closed. You keep me busy and I'll keep you breathing."]},
	"elder": {"title": "Elder Corwin", "greeting": [
		"Hollowmere was a pilgrim's town once. Now the pilgrims are the ones we bury."]},
}


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	Game.inventory_changed.connect(_refresh)
	Game.stats_changed.connect(_refresh)


func is_open() -> bool:
	return current != null


func close() -> void:
	if current:
		current.queue_free()
		current = null
		current_kind = ""
		selected = {}
		Sfx.play("click", -6.0)
	get_tree().paused = false
	hud.main.on_menu_closed()


func _refresh() -> void:
	if current == null:
		return
	match current_kind:
		"inventory": open_inventory()
		"character": open_character()
		"shop": open_shop(shop_kind)


func _frame(title: String, kind: String, closable := true) -> VBoxContainer:
	if current:
		current.queue_free()
	current_kind = kind
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.6)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(shade)
	current = shade
	var s := get_viewport_rect().size
	var panel := PanelContainer.new()
	panel.position = Vector2(14, 70)
	panel.size = Vector2(s.x - 28, s.y - 140)
	shade.add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	panel.add_child(v)
	if title == "" and not closable:
		return v
	var head := HBoxContainer.new()
	v.add_child(head)
	var t := UITheme.label(title, 40, UITheme.GOLD, UITheme.title_font)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(t)
	if closable:
		head.add_child(UITheme.button("✕", close, 34))
	var sep := ColorRect.new()
	sep.color = UITheme.GOLD_DIM
	sep.custom_minimum_size = Vector2(0, 2)
	v.add_child(sep)
	return v


# ----------------------------------------------------------------- inventory
func _slot_button(it, cb: Callable, sz := 112.0, highlight := false, caption := "") -> Control:
	var b := Button.new()
	b.custom_minimum_size = Vector2(sz, sz)
	b.focus_mode = Control.FOCUS_NONE
	var sb := StyleBoxTexture.new()
	sb.texture = Util.tex("slot")
	sb.set_texture_margin_all(10)
	for st in ["normal", "hover", "pressed", "focus"]:
		b.add_theme_stylebox_override(st, sb)
	if it:
		var ic := TextureRect.new()
		ic.texture = Util.icon(it.icon)
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.set_anchors_preset(Control.PRESET_FULL_RECT)
		ic.offset_left = 10
		ic.offset_top = 10
		ic.offset_right = -10
		ic.offset_bottom = -10
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(ic)
		var rar: int = it.get("rarity", 0)
		if rar > 0 or not Game.can_equip(it):
			var glow := ColorRect.new()
			glow.color = Color(0.8, 0.1, 0.1, 0.25) if not Game.can_equip(it) else Color(Game.Items.RARITY_COLORS[rar], 0.18)
			glow.set_anchors_preset(Control.PRESET_FULL_RECT)
			glow.offset_left = 6
			glow.offset_top = 6
			glow.offset_right = -6
			glow.offset_bottom = -6
			glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
			b.add_child(glow)
	elif caption != "":
		var l := UITheme.label(caption, 18, UITheme.GOLD_DIM, UITheme.head_font)
		l.set_anchors_preset(Control.PRESET_FULL_RECT)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		l.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(l)
	if highlight:
		var hl := ReferenceRect.new()
		hl.border_color = Color(1, 0.85, 0.4)
		hl.border_width = 4
		hl.editor_only = false
		hl.set_anchors_preset(Control.PRESET_FULL_RECT)
		hl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(hl)
	b.pressed.connect(func():
		Sfx.play("click", -6.0, 0.05)
		cb.call())
	return b


func open_inventory() -> void:
	get_tree().paused = true
	var v := _frame("Inventory", "inventory")
	# equipment
	var eq := GridContainer.new()
	eq.columns = 6
	eq.add_theme_constant_override("h_separation", 8)
	var center := CenterContainer.new()
	center.add_child(eq)
	v.add_child(center)
	for slot in ["helm", "amulet", "weapon", "armor", "shield", "ring"]:
		var it = Game.equip[slot]
		var sel: bool = selected.get("from", "") == "equip" and selected.get("slot", "") == slot
		var sl: String = slot
		eq.add_child(_slot_button(it, func(): _select({"from": "equip", "slot": sl, "item": Game.equip[sl]}), 104.0, sel, slot.capitalize()))
	var dr := Game.damage_range()
	var stats := UITheme.label("Damage %d-%d   ·   Armor %d   ·   Gold %d" % [dr.x, dr.y, Game.armor_class(), Game.gold], 26, UITheme.TEXT, UITheme.head_font)
	stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(stats)
	# pack
	var grid := GridContainer.new()
	grid.columns = 6
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	var gc := CenterContainer.new()
	gc.add_child(grid)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	gc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(gc)
	v.add_child(scroll)
	for i in Game.INV_SIZE:
		var idx := i
		var sel: bool = selected.get("from", "") == "inv" and selected.get("index", -1) == i
		grid.add_child(_slot_button(Game.inventory[i], func(): _select({"from": "inv", "index": idx, "item": Game.inventory[idx]}), 104.0, sel))
	v.add_child(_detail_panel())


func _select(sel: Dictionary) -> void:
	if sel.item == null:
		selected = {}
	else:
		selected = sel
	_refresh()


func _detail_panel() -> Control:
	var box := PanelContainer.new()
	var sb: StyleBoxFlat = UITheme.panel_box(0.9)
	sb.bg_color = Color(0.11, 0.085, 0.07, 0.95)
	box.add_theme_stylebox_override("panel", sb)
	box.custom_minimum_size = Vector2(0, 300)
	var v := VBoxContainer.new()
	box.add_child(v)
	if selected.is_empty() or selected.item == null:
		var hint := UITheme.label("Tap an item to inspect it.", 28, UITheme.GOLD_DIM)
		hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(hint)
		return box
	var it: Dictionary = selected.item
	var name_l := UITheme.label(it.name, 34, Game.Items.RARITY_COLORS[it.get("rarity", 0)], UITheme.head_font)
	name_l.autowrap_mode = TextServer.AUTOWRAP_WORD
	v.add_child(name_l)
	var desc := UITheme.label(Game.Items.describe(it), 27)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD
	desc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	if not Game.can_equip(it):
		desc.add_theme_color_override("font_color", Color(1, 0.55, 0.45))
	v.add_child(desc)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_END
	v.add_child(row)
	var from: String = selected.from
	if from == "inv":
		var idx: int = selected.index
		if it.kind in ["potion", "scroll"]:
			row.add_child(UITheme.button("Use", func():
				if Game.use_consumable(it):
					Game.inventory[idx] = null
					selected = {}
					Game.inventory_changed.emit()
					if it.get("effect", "") == "portal":
						close()))
		elif Game.Items.slot_for(it) != "":
			row.add_child(UITheme.button("Equip", func():
				if Game.equip_from_inventory(idx):
					Sfx.play("pickup")
					selected = {}
					_refresh()))
		if current_kind == "shop":
			row.add_child(UITheme.button("Sell %d" % Game.Items.sell_price(it), func():
				Game.gold += Game.Items.sell_price(it)
				Game.inventory[idx] = null
				selected = {}
				Sfx.play("gold")
				Game.inventory_changed.emit()
				Game.stats_changed.emit()))
		else:
			row.add_child(UITheme.button("Drop", func():
				Game.inventory[idx] = null
				selected = {}
				hud.main.drop_at_player(it)
				Game.inventory_changed.emit()))
	elif from == "equip":
		var slot: String = selected.slot
		row.add_child(UITheme.button("Unequip", func():
			if Game.unequip(slot):
				selected = {}
				_refresh()))
	elif from == "shop":
		var price: int = Game.Items.buy_price(it)
		var b := UITheme.button("Buy %d" % price, func(): _buy(selected.index))
		b.disabled = Game.gold < price
		row.add_child(b)
	return box


# ----------------------------------------------------------------- character
func open_character() -> void:
	get_tree().paused = true
	var v := _frame("The Wanderer", "character")
	var info := UITheme.label("Warrior   ·   Level %d" % Game.clvl, 32, UITheme.GOLD, UITheme.head_font)
	v.add_child(info)
	v.add_child(UITheme.label("Experience %d   /   next %d" % [Game.xp, Game.xp_for_next()], 26))
	var pts := UITheme.label("Points to spend: %d" % Game.stat_points, 30, Color(1, 0.6, 0.4) if Game.stat_points > 0 else UITheme.GOLD_DIM, UITheme.head_font)
	v.add_child(pts)
	for row in [["Strength", "str", Game.base_str, Game.strength()], ["Magic", "mag", Game.base_mag, Game.magic()],
			["Dexterity", "dex", Game.base_dex, Game.dexterity()], ["Vitality", "vit", Game.base_vit, Game.vitality()]]:
		var h := HBoxContainer.new()
		var l := UITheme.label(row[0], 32, UITheme.TEXT, UITheme.head_font)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(l)
		var val := UITheme.label(str(row[3]) if row[3] == row[2] else "%d (%+d)" % [row[3], row[3] - row[2]], 32, Color(0.6, 0.75, 1) if row[3] != row[2] else UITheme.TEXT, UITheme.head_font)
		h.add_child(val)
		var key: String = row[1]
		var b := UITheme.button("+", func(): Game.spend_point(key), 34)
		b.disabled = Game.stat_points <= 0
		b.custom_minimum_size = Vector2(80, 70)
		h.add_child(b)
		v.add_child(h)
	var sep := ColorRect.new()
	sep.color = UITheme.GOLD_DIM
	sep.custom_minimum_size = Vector2(0, 2)
	v.add_child(sep)
	var dr := Game.damage_range()
	var lines := [
		"Life: %d / %d" % [ceili(Game.hp), int(Game.max_hp())],
		"Mana: %d / %d" % [int(Game.mana), int(Game.max_mana())],
		"Armor class: %d" % Game.armor_class(),
		"Chance to hit: %d%%" % clampi(Game.to_hit(), 0, 999),
		"Damage: %d - %d" % [dr.x, dr.y],
		"Block (vs. level-equal foes): %d%%" % Game.block_chance(Game.clvl),
		"Firebolt: %d - %d   ·   Healing: %d" % [Game.spell_damage().x, Game.spell_damage().y, int(Game.heal_amount())],
	]
	for t in lines:
		v.add_child(UITheme.label(t, 28))
	var tip := UITheme.label("Strength raises damage. Dexterity sharpens aim, armor and blocking. Vitality grants life. Magic fuels your spells.", 24, UITheme.GOLD_DIM)
	tip.autowrap_mode = TextServer.AUTOWRAP_WORD
	v.add_child(tip)


# --------------------------------------------------------------------- shops
func open_shop(kind: String) -> void:
	get_tree().paused = true
	shop_kind = kind
	var v := _frame("Brannoc's Forge" if kind == "smith" else "Maera's Remedies", "shop")
	var tabs := HBoxContainer.new()
	tabs.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(tabs)
	var bb := UITheme.button("Buy", func():
		shop_tab = "buy"
		selected = {}
		_refresh())
	var sb := UITheme.button("Sell", func():
		shop_tab = "sell"
		selected = {}
		_refresh())
	bb.disabled = shop_tab == "buy"
	sb.disabled = shop_tab == "sell"
	tabs.add_child(bb)
	tabs.add_child(sb)
	tabs.add_child(UITheme.label("   %d gold" % Game.gold, 30, Color(1, 0.85, 0.4), UITheme.head_font))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(list)
	if shop_tab == "buy":
		var stock: Array = Game.smith_stock if kind == "smith" else Game.healer_stock
		for i in stock.size():
			var it: Dictionary = stock[i]
			var idx := i
			list.add_child(_shop_row(it, Game.Items.buy_price(it), func(): _select({"from": "shop", "index": idx, "item": stock[idx]}), selected.get("from", "") == "shop" and selected.get("index", -1) == i))
	else:
		var any := false
		for i in Game.INV_SIZE:
			var it = Game.inventory[i]
			if it == null:
				continue
			if kind == "healer" and not (it.kind in ["potion", "scroll"]):
				continue
			any = true
			var idx := i
			list.add_child(_shop_row(it, Game.Items.sell_price(it), func(): _select({"from": "inv", "index": idx, "item": Game.inventory[idx]}), selected.get("from", "") == "inv" and selected.get("index", -1) == i))
		if not any:
			list.add_child(UITheme.label("Nothing here I'd buy." if kind == "healer" else "Your pack is empty.", 28, UITheme.GOLD_DIM))
	v.add_child(_detail_panel())


func _shop_row(it: Dictionary, price: int, cb: Callable, sel: bool) -> Control:
	var b := Button.new()
	b.custom_minimum_size = Vector2(0, 96)
	b.focus_mode = Control.FOCUS_NONE
	if sel:
		var s := StyleBoxFlat.new()
		s.bg_color = Color(0.3, 0.18, 0.1, 0.95)
		s.border_color = UITheme.GOLD
		s.set_border_width_all(3)
		s.set_corner_radius_all(5)
		b.add_theme_stylebox_override("normal", s)
	var h := HBoxContainer.new()
	h.set_anchors_preset(Control.PRESET_FULL_RECT)
	h.offset_left = 10
	h.offset_right = -14
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(h)
	var ic := TextureRect.new()
	ic.texture = Util.icon(it.icon)
	ic.custom_minimum_size = Vector2(80, 80)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(ic)
	var n := UITheme.label(it.name, 27, Game.Items.RARITY_COLORS[it.get("rarity", 0)], UITheme.head_font)
	n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	n.autowrap_mode = TextServer.AUTOWRAP_WORD
	n.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(n)
	var p := UITheme.label("%d g" % price, 27, Color(1, 0.85, 0.4), UITheme.head_font)
	p.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(p)
	b.pressed.connect(func():
		Sfx.play("click", -6.0, 0.05)
		cb.call())
	return b


func _buy(idx: int) -> void:
	var stock: Array = Game.smith_stock if shop_kind == "smith" else Game.healer_stock
	var it: Dictionary = stock[idx]
	var price: int = Game.Items.buy_price(it)
	if Game.gold < price:
		Sfx.play("error")
		return
	var copy: Dictionary = it.duplicate(true)
	if Game.add_item(copy):
		Game.gold -= price
		Sfx.play("gold")
		if shop_kind == "smith":
			stock.remove_at(idx)
			selected = {}
		Game.stats_changed.emit()


# ------------------------------------------------------------------ dialogue
func open_npc(npc: String) -> void:
	get_tree().paused = true
	var info: Dictionary = NPC_INFO[npc]
	var v := _frame(info.title, "npc")
	var portrait_row := HBoxContainer.new()
	v.add_child(portrait_row)
	var text := RichTextLabel.new()
	text.bbcode_enabled = true
	text.fit_content = true
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.add_theme_font_size_override("normal_font_size", 30)
	text.add_theme_font_override("italics_font", UITheme.body_font)
	var lines: Array = info.greeting
	text.text = "[i]\"%s\"[/i]" % lines[randi() % lines.size()]
	v.add_child(text)
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(spacer)
	match npc:
		"healer":
			v.add_child(UITheme.button("Heal my wounds", func():
				Game.hp = Game.max_hp()
				Game.stats_changed.emit()
				Sfx.play("heal")
				text.text = "[i]\"There. Try to keep it inside you this time.\"[/i]"))
			v.add_child(UITheme.button("Buy remedies", func(): open_shop("healer")))
		"smith":
			v.add_child(UITheme.button("Trade arms and armor", func(): open_shop("smith")))
		"elder":
			v.add_child(UITheme.button("Tell me of the cathedral", func(): text.text = _elder_lore()))
			v.add_child(UITheme.button("Any word on what I face?", func(): text.text = _elder_quest()))
	v.add_child(UITheme.button("Farewell", close))


func _elder_lore() -> String:
	return "[i]\"Saint Aldric's was built over older stones — far older. The monks said the lower vaults were sealed for a reason. When the bells stopped, the dead stopped staying buried. Three levels down lies the old ossuary, and whatever has woken there.\"[/i]"


func _elder_quest() -> String:
	var q: Dictionary = Game.quests
	if q.flayer < 2:
		if q.flayer == 0:
			q.flayer = 1
		return "[i]\"A lad crawled out of the cathedral three nights ago, babbling of a great hulk below the first halls — an iron-masked brute with a cleaver, who hangs the fallen like meat. The [b]Flayer[/b], he called it. It dwells in the second level. End it, and Hollowmere will owe you.\"[/i]"
	if q.flayer == 2:
		q.flayer = 3
		var ring := Game.Items.make_unique("wardens_band")
		Game.add_item(ring)
		Game.gold += 500
		Game.stats_changed.emit()
		Sfx.play("gold")
		if q.matron == 0:
			q.matron = 1
		return "[i]\"The Flayer, slain? Then the lad's screams can finally rest. Take this — the warden's band, my father's. And 500 gold from the town purse.\n\nBut hear me: the brute was only a butcher for something worse. Deep in the ossuary a voice sings the dead awake. The [b]Hollow Matron[/b]. Silence her.\"[/i]"
	if q.matron < 2:
		if q.matron == 0:
			q.matron = 1
		return "[i]\"The [b]Hollow Matron[/b] waits in the ossuary, the third level. She raises the bones faster than we can bury them. Go carefully.\"[/i]"
	return "[i]\"The singing has stopped. For the first time in a month, I hear the wind and nothing else. Hollowmere is in your debt, Wanderer.\"[/i]"


# --------------------------------------------------------------------- pause
func open_pause() -> void:
	get_tree().paused = true
	var v := _frame("Paused", "pause")
	var c := VBoxContainer.new()
	c.alignment = BoxContainer.ALIGNMENT_CENTER
	c.size_flags_vertical = Control.SIZE_EXPAND_FILL
	c.add_theme_constant_override("separation", 22)
	v.add_child(c)
	c.add_child(UITheme.button("Resume", close, 36))
	c.add_child(UITheme.button("Music: %s" % ("On" if Game.music_on else "Off"), func():
		Sfx.set_music_enabled(not Game.music_on)
		open_pause(), 32))
	c.add_child(UITheme.button("Sound: %s" % ("On" if Game.sfx_on else "Off"), func():
		Game.sfx_on = not Game.sfx_on
		open_pause(), 32))
	c.add_child(UITheme.button("Save & return to title", func():
		Game.save_game()
		close()
		hud.main.to_title(), 32))
	var help := UITheme.label("Left thumb: move.  Drag anywhere else: look.\nHold the sword to fight. Fire and cross buttons cast spells.\nPotions sit on your belt — tap to drink.", 26, UITheme.GOLD_DIM)
	help.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	help.autowrap_mode = TextServer.AUTOWRAP_WORD
	c.add_child(help)


# ---------------------------------------------------------------- title etc
func open_title() -> void:
	var v := _frame("", "title", false)
	current.color = Color(0, 0, 0, 0.0)
	var panel: PanelContainer = v.get_parent()
	panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 120)
	v.add_child(spacer)
	var t := UITheme.label("Hollowdeep", 92, Color(0.85, 0.15, 0.1), UITheme.title_font)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_constant_override("outline_size", 16)
	v.add_child(t)
	var sub := UITheme.label("Beneath the cathedral of Hollowmere", 30, UITheme.GOLD, UITheme.head_font)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(sub)
	var sp2 := Control.new()
	sp2.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(sp2)
	var c := VBoxContainer.new()
	c.add_theme_constant_override("separation", 24)
	var cc := CenterContainer.new()
	cc.add_child(c)
	v.add_child(cc)
	if Game.has_save():
		var b := UITheme.button("Continue", func():
			if Game.load_game():
				close()
				hud.main.start_game(false), 40)
		b.custom_minimum_size = Vector2(420, 100)
		c.add_child(b)
	var nb := UITheme.button("New Game", func():
		close()
		Game.new_game()
		hud.main.start_game(true), 40)
	nb.custom_minimum_size = Vector2(420, 100)
	c.add_child(nb)
	var sp3 := Control.new()
	sp3.custom_minimum_size = Vector2(0, 80)
	v.add_child(sp3)
	var cr := UITheme.label("Best played in portrait with headphones", 22, UITheme.GOLD_DIM)
	cr.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(cr)


func open_death() -> void:
	var v := _frame("", "death", false)
	current.color = Color(0.25, 0, 0, 0.55)
	var panel: PanelContainer = v.get_parent()
	panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	var sp := Control.new()
	sp.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(sp)
	var t := UITheme.label("You have fallen", 64, Color(0.9, 0.15, 0.1), UITheme.title_font)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.autowrap_mode = TextServer.AUTOWRAP_WORD
	v.add_child(t)
	var s := UITheme.label("Maera drags you back to Hollowmere.\nSome of your gold did not survive the trip.", 28, UITheme.TEXT)
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	s.autowrap_mode = TextServer.AUTOWRAP_WORD
	v.add_child(s)
	var cc := CenterContainer.new()
	var b := UITheme.button("Rise again", func():
		close()
		hud.main.respawn(), 38)
	b.custom_minimum_size = Vector2(380, 96)
	cc.add_child(b)
	v.add_child(cc)
	var sp2 := Control.new()
	sp2.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(sp2)


func open_victory() -> void:
	get_tree().paused = true
	var v := _frame("Victory", "victory", false)
	var t := RichTextLabel.new()
	t.bbcode_enabled = true
	t.fit_content = true
	t.add_theme_font_size_override("normal_font_size", 30)
	t.text = "The Hollow Matron's song breaks into silence. Her bones scatter across the ossuary floor and, far above, a single cathedral bell sways and tolls.\n\nHollowmere will sleep tonight.\n\n[color=#c9a96e]Yet the stair beyond her altar winds deeper still, into a dark no lantern has touched...[/color]\n\nThank you for playing this first chapter of [b]Hollowdeep[/b]. Your hero remains — keep hunting for treasure, or return to the elder for his thanks."
	v.add_child(t)
	var sp := Control.new()
	sp.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(sp)
	v.add_child(UITheme.button("Continue", close, 36))
