OVERDUB SPRITES

Every picture in the game except the ground blocks is a PNG in this folder. Edit them in any image editor
(Aseprite, Piskel, Krita, Photoshop...) and keep the file name. Transparency is kept.

Size: each sprite has a size in game pixels (1 tile = 20). The shipped files are drawn at 2x that size.
You can redraw a file at 1x (pixel art) or 2x; the game works out which from the width and shows 1x art
with crisp, unsmoothed pixels. Keep the same proportions (width : height).

Stretchable sprites (nine-slice): the corner squares of the given border size stay as drawn; the edges and
the middle stretch (or repeat, for gate_open). Keep borders within that many game pixels.
White sprites are tinted by the game; draw them in white and grey.

To regenerate the original art for a file, delete it and run:  npm run sprites
(it only writes files that are missing; add -- --force to reset all of them).

file                 game px    2x file     notes
paper.png            640x420    1280x840    background behind every room and menu
hud_bar.png          640x60     1280x120    strip under the room (HUD)
live_idle.png        26x28      52x56       you, standing (faces right; mirrored for left); body box at 4,5
live_blink.png       26x28      52x56       you, blinking (also used during count-in); body box at 4,5
live_jump.png        26x28      52x56       you, rising; body box at 4,5
live_fall.png        26x28      52x56       you, falling; body box at 4,5
drone.png            26x28      52x56       a Drone (track number drawn on top); body box at 4,5
loop.png             26x28      52x56       a Loop (track number drawn on top); body box at 4,5
digit_1.png          3x5        6x10        track number 1 (white, tinted in game)
digit_2.png          3x5        6x10        track number 2 (white, tinted)
digit_3.png          3x5        6x10        track number 3 (white, tinted)
digit_4.png          3x5        6x10        track number 4 (white, tinted)
ghost.png            20x22      40x44       outline of a failed take in the Mixdown (shown at 35% opacity); body box at 1,1
loop_dot.png         2x2        4x4         one dot of a Loop's path (shown at 45% opacity)
static_top.png       20x20      40x40       red hazard tile, top row
static_fill.png      20x20      40x40       red hazard tile under another hazard
drum.png             20x20      40x40       drumhead tile
pad.png              40x20      80x40       spawn pad (2 tiles wide)
out.png              20x40      40x80       the Out door (1 x 2 tiles)
mute.png             20x20      40x40       mute-zone tile (tiles seamlessly)
emitter.png          20x20      40x40       beam emitter nozzle, pointing right (rotated in game)
beam_on.png          20x8       40x16       live beam, repeats along its length
beam_off.png         20x8       40x16       resting beam, repeats along its length
switch_up.png        40x20      80x40       switch plate, up (stretches to the switch width); border 6px
switch_down.png      40x20      80x40       switch plate, pressed (stretches); border 6px
glyph_0.png          8x8        16x16       switch/gate glyph 0 (white, tinted)
glyph_1.png          8x8        16x16       glyph 1 (white, tinted)
glyph_2.png          8x8        16x16       glyph 2 (white, tinted)
glyph_3.png          8x8        16x16       glyph 3 (white, tinted)
gate_closed.png      20x20      40x40       closed gate, repeats over the gate area
gate_open.png        20x20      40x40       open gate outline (nine-slice, edges repeat); border 5px
particle.png         4x4        8x8         one particle (white, tinted)
slot.png             24x24      48x48       empty track slot in the HUD
slot_full.png        24x24      48x48       used track slot
slot_locked.png      24x24      48x48       slot this room does not offer
beat_on.png          10x10      20x20       current beat dot
beat_off.png         10x10      20x20       other beat dots
ff.png               16x12      32x24       fast-forward icon
medal.png            20x20      40x40       Clean Take medal
tick.png             18x4       36x8        cleared mark in room select
keycap.png           16x14      32x28       key hint bubble (stretches); border 4px
panel.png            32x32      64x64       menu and banner panel (stretches); border 10px
button.png           24x16      48x32       highlighted menu item (stretches); border 6px
cell.png             84x40      168x80      room select cell; border 8px
cell_on.png          84x40      168x80      selected room cell; border 8px
cell_locked.png      84x40      168x80      locked room cell; border 8px
