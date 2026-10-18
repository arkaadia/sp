# 2D Sprite Sheet & Tileset Rules & Conventions (SPRITE_RULES.md)
> Standard specifications and design guidelines for 2D game animation assets.
> Follow these rules so you never need to rebuild pipelines or reconstruct coordinates from scratch.

---

## 1. Frame Count & Timing Standards

Every character animation state must adhere to standard frame counts and target framerates:

| Animation State | Standard Frame Count | Recommended FPS | Loop Mode | Kinematic Motion Phase Breakdown |
| :--- | :--- | :--- | :--- | :--- |
| **Idle** | **8 Frames** | 8 – 10 FPS | Loop (`infinite`) | Inhale (1-2), Apex (3-4), Exhale (5-6), Settle (7-8) |
| **Run / Walk** | **8 Frames** | 10 – 14 FPS | Loop (`infinite`) | Right Foot Contact (1), Push-Off (2-3), Left Foot Contact (5), Push-Off (6-7), Recov (8) |
| **Jump Arc** | **8 Frames** | 9 – 11 FPS | Play Once / Clamp | Crouch Prep (1), Takeoff (2), Ascent (3), Apex (4-5), Descent (6), Touchdown (7), Recov (8) |
| **Attack (Melee)** | **8 Frames** | 12 – 16 FPS | Play Once | Anticipation (1), Cleave Arc (2-4), Chain Flare (5-6), Sheath Recovery (7-8) |
| **Climb** | **8 Frames** | 8 – 10 FPS | Loop (`infinite`) | Alternate hand grasps (1-4), Alternate foot push & wing lift (5-8) |
| **Defense / Parry** | **8 Frames** | 8 – 10 FPS | Loop / Hold | Guard stance (1-2), Wing shield wrap (3-5), Parry buffer (6-8) |

---

## 2. Grid Geometry & Dimensions

### Standard Dimensions (Power of Two)
Always keep cell dimensions consistent within a single character pack:
- **Chibi / Low-Res Pixel Art**: `64×64 px` or `128×128 px`
- **HD Hand-Drawn / Vector Art**: `256×256 px` or `320×320 px` (Standard)
- **4K Master Sheets**: `512×512 px` per frame

### Matrix Slicing Convention:
- **Columns**: 8 columns (Frames 1 to 8 left-to-right)
- **Rows**:
  - Row 0: **Idle**
  - Row 1: **Run**
  - Row 2: **Jump**
  - Row 3: **Attack**
  - Row 4: **Climb**
  - Row 5: **Defense**
- **Padding**: 0px between cells (or uniform 2px padding for engine bilinear clamping if needed).
- **Origin / Top-Left**: `x = col * cellWidth`, `y = row * cellHeight`.

```
+-----------+-----------+-----------+-----------+-----------+-----------+-----------+-----------+
| Idle 01   | Idle 02   | Idle 03   | Idle 04   | Idle 05   | Idle 06   | Idle 07   | Idle 08   |  Row 0
+-----------+-----------+-----------+-----------+-----------+-----------+-----------+-----------+
| Run 01    | Run 02    | Run 03    | Run 04    | Run 05    | Run 06    | Run 07    | Run 08    |  Row 1
+-----------+-----------+-----------+-----------+-----------+-----------+-----------+-----------+
| Jump 01   | Jump 02   | Jump 03   | Jump 04   | Jump 05   | Jump 06   | Jump 07   | Jump 08   |  Row 2
+-----------+-----------+-----------+-----------+-----------+-----------+-----------+-----------+
| Attack 01 | Attack 02 | Attack 03 | Attack 04 | Attack 05 | Attack 06 | Attack 07 | Attack 08 |  Row 3
+-----------+-----------+-----------+-----------+-----------+-----------+-----------+-----------+
| Climb 01  | Climb 02  | Climb 03  | Climb 04  | Climb 05  | Climb 06  | Climb 07  | Climb 08  |  Row 4
+-----------+-----------+-----------+-----------+-----------+-----------+-----------+-----------+
| Def 01    | Def 02    | Def 03    | Def 04    | Def 05    | Def 06    | Def 07    | Def 08    |  Row 5
+-----------+-----------+-----------+-----------+-----------+-----------+-----------+-----------+
```

---

## 3. Anchor & Pivot Point Standard

Maintaining a uniform pivot point prevents "jittering" or sliding feet across frames:

- **Bottom-Center (Feet Anchor)**:
  - Normalized Coordinates: `Pivot X = 0.5` (Center), `Pivot Y = 0.9` (Ground Contact line)
  - Pixels in `256×256` cell: `Pivot = (128, 230)`
- **Rule**: Never change the ground contact Y-position between frames in an Idle or Run cycle. For Jump cycles, the character rises above the ground line while the coordinate system's ground line remains fixed.

---

## 4. Hitbox & Collision Conventions

To maintain cross-engine compatibility with Godot, Unity, and Unreal:

- **Root Collision (Physics Capsule / Box)**:
  - Width: ~35% - 45% of character cell width
  - Height: ~60% - 75% of character cell height
  - Anchored to ground contact line
- **Hurtbox (Damage Receiver)**:
  - Encloses torso and head, slightly smaller than the visual envelope to be forgiving for the player.
- **Hitbox (Weapon Strike Zone)**:
  - Active only on strike frames (e.g., Attack Frames 3-4), aligned to the blade/spell tip.

---

## 5. File & Asset Naming Conventions

Never use spaces or special characters in filenames:

### Clean Master Tileset:
```
{character_name}_tileset_8x3_{resolution}.png
Example: elysian_rogue_tileset_8x3_256.png
```

### Action Strips:
```
{character_name}_{action}_8frames_strip.png
Example: elysian_rogue_run_8frames_strip.png
```

### Individual Frames (for ZIP export):
```
{character_name}/{action}/{action}_frame_{01..08}.png
Example:
  elysian_rogue/idle/idle_frame_01.png
  elysian_rogue/idle/idle_frame_02.png
  ...
  elysian_rogue/run/run_frame_01.png
  ...
  elysian_rogue/jump/jump_frame_08.png
```

### Metadata Files:
```
{character_name}_atlas_phaser.json
{character_name}_spriteframes_godot.json
{character_name}_spritesheet_unity.json
{character_name}_animation.css
```

---

## 6. Alpha Masking & Color Rules

- **Format**: PNG-32 (RGB + Alpha 8-bit channel).
- **Background Extraction**:
  - Sample uniform solid color `#2a2c30` or custom chroma key.
  - Apply Euclidean distance threshold ($T \approx 32 - 40$).
  - Feather transition: $12 - 20\text{px}$ to retain soft luminescent edges, wings, and cloth fringes.
  - Despill: Dampen background tint bleeding onto edge pixels.
- **Pixel Art Filter Mode**:
  - Godot: `TextureFilter = Nearest`
  - Unity: `Filter Mode = Point (no filter)`
  - Web: `image-rendering: pixelated; image-rendering: crisp-edges;`
