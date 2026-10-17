class_name UITheme
extends RefCounted
## Builds the shared gothic UI theme in code.

const GOLD := Color(0.86, 0.72, 0.45)
const GOLD_DIM := Color(0.55, 0.45, 0.28)
const TEXT := Color(0.9, 0.86, 0.78)
const RED := Color(0.75, 0.12, 0.08)

static var _theme: Theme
static var title_font: Font
static var head_font: Font
static var body_font: Font


static func fonts() -> void:
	if title_font:
		return
	title_font = load("res://assets/fonts/CinzelDecorative-Bold.ttf")
	var cz := FontVariation.new()
	cz.base_font = load("res://assets/fonts/Cinzel.ttf")
	cz.variation_opentype = {"wght": 700}
	head_font = cz
	var al := FontVariation.new()
	al.base_font = load("res://assets/fonts/Alegreya.ttf")
	al.variation_opentype = {"wght": 500}
	body_font = al


static func panel_box(alpha := 0.94) -> StyleBox:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.055, 0.05, alpha)
	sb.border_color = GOLD_DIM
	sb.set_border_width_all(3)
	sb.set_corner_radius_all(6)
	sb.shadow_color = Color(0, 0, 0, 0.6)
	sb.shadow_size = 12
	sb.set_content_margin_all(18)
	return sb


static func get_theme() -> Theme:
	if _theme:
		return _theme
	fonts()
	var t := Theme.new()
	t.default_font = body_font
	t.default_font_size = 30
	t.set_color("font_color", "Label", TEXT)
	t.set_color("font_outline_color", "Label", Color(0, 0, 0, 1))
	t.set_constant("outline_size", "Label", 6)
	t.set_stylebox("panel", "PanelContainer", panel_box())
	t.set_stylebox("panel", "Panel", panel_box())
	for st in ["normal", "hover", "pressed", "disabled"]:
		var b := StyleBoxFlat.new()
		b.bg_color = Color(0.16, 0.11, 0.08, 0.96)
		if st == "hover":
			b.bg_color = Color(0.22, 0.15, 0.1, 0.96)
		if st == "pressed":
			b.bg_color = Color(0.35, 0.12, 0.08, 0.96)
		if st == "disabled":
			b.bg_color = Color(0.1, 0.09, 0.08, 0.8)
		b.border_color = GOLD_DIM if st != "pressed" else GOLD
		b.set_border_width_all(2)
		b.set_corner_radius_all(5)
		b.set_content_margin_all(12)
		b.content_margin_left = 22
		b.content_margin_right = 22
		t.set_stylebox(st, "Button", b)
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	t.set_font("font", "Button", head_font)
	t.set_font_size("font_size", "Button", 30)
	t.set_color("font_color", "Button", GOLD)
	t.set_color("font_hover_color", "Button", Color(1, 0.9, 0.65))
	t.set_color("font_pressed_color", "Button", Color(1, 0.95, 0.8))
	t.set_color("font_disabled_color", "Button", Color(0.45, 0.4, 0.35))
	t.set_color("default_color", "RichTextLabel", TEXT)
	t.set_font("normal_font", "RichTextLabel", body_font)
	t.set_font_size("normal_font_size", "RichTextLabel", 30)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.05, 0.04, 0.04, 0.9)
	bg.set_corner_radius_all(4)
	bg.border_color = Color(0, 0, 0, 1)
	bg.set_border_width_all(2)
	t.set_stylebox("background", "ProgressBar", bg)
	var fg := StyleBoxFlat.new()
	fg.bg_color = RED
	fg.set_corner_radius_all(4)
	t.set_stylebox("fill", "ProgressBar", fg)
	t.set_constant("separation", "VBoxContainer", 10)
	t.set_constant("separation", "HBoxContainer", 10)
	var sbv := StyleBoxFlat.new()
	sbv.bg_color = Color(0.3, 0.24, 0.16, 0.8)
	sbv.set_corner_radius_all(4)
	sbv.content_margin_left = 6
	t.set_stylebox("grabber", "VScrollBar", sbv)
	t.set_stylebox("grabber_highlight", "VScrollBar", sbv)
	t.set_stylebox("grabber_pressed", "VScrollBar", sbv)
	var sbs := StyleBoxFlat.new()
	sbs.bg_color = Color(0.05, 0.04, 0.03, 0.5)
	sbs.content_margin_left = 8
	t.set_stylebox("scroll", "VScrollBar", sbs)
	_theme = t
	return t


static func label(text: String, size := 30, color := TEXT, font: Font = null) -> Label:
	fonts()
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if font:
		l.add_theme_font_override("font", font)
	return l


static func button(text: String, cb: Callable, size := 30) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", size)
	b.pressed.connect(func():
		Sfx.play("click", -4.0, 0.05)
		cb.call())
	b.focus_mode = Control.FOCUS_NONE
	return b
