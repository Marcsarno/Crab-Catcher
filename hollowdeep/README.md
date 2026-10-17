# Hollowdeep

An original first-person gothic dungeon crawler in the classic ARPG mould, built with Godot 4.5 for phone browsers (portrait).

- Town hub (Hollowmere) with a healer, a smith and the elder's quests
- 3 procedurally generated dungeon levels, a boss on level 2 (the Flayer) and the finale on level 3 (the Hollow Matron)
- Random magic loot, potion belt, stat points, Firebolt/Healing, town portal scrolls, automap, saving

Play build: `../play/hollowdeep/index.html` (single-threaded web export, no special headers needed).

## Rebuilding assets
```
python3 tools/gen_textures.py
python3 tools/gen_icons.py
python3 tools/gen_audio.py
blender -b --python tools/blender_models.py
godot --headless --export-release "Web" ../play/hollowdeep/index.html
```
Fonts: Cinzel, Cinzel Decorative, Alegreya (SIL OFL, licenses in assets/fonts).
