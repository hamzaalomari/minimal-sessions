# Minimal Sessions — Brand

The logo is **"Stack"**: three overlapping rounded panels stepping toward the front, with a spark on the front panel — a stack of Claude sessions you're viewing.

## Files

| File | Use |
|---|---|
| `minimal-sessions-icon.svg` | **Primary app icon.** Terracotta tile, white panels, terracotta spark. Use as the app/launcher/dock icon. |
| `minimal-sessions-mark.svg` | **Logomark on light surfaces.** Transparent background, terracotta-toned panels + white spark. |
| `minimal-sessions-mono.svg` | **Single-color** version (`currentColor`, spark knocked out). For stamps, watermarks, monochrome contexts. |
| `minimal-sessions-wordmark.svg` | **Horizontal lockup** for light backgrounds: mark + "Minimal Sessions" + tagline. |
| `minimal-sessions-wordmark-dark.svg` | Wordmark for **dark** backgrounds. |
| `favicon.svg` | Browser **favicon** (tighter corner radius for small sizes). |
| `png/icon-{16,32,64,128,256,512}.png` | Rasterized app icon at standard sizes (favicons, installers, store listings). |

SVGs are resolution-independent — prefer them. The PNGs are provided for places that require raster (favicons, OS icons, app stores).

## Construction
- Tile: 48×48 grid, corner radius 13 (favicon uses 11 for crisper small sizes).
- Panels: 24×24, corner radius 7, stepped at (18,8) → (12,14) → (6,20), back-to-front.
- On the color tile, panels are white at 40% / 70% / 100% opacity; the spark is terracotta, centered in the front panel.
- On light surfaces, panels use the terracotta tonal ramp (`#ECC9B8` / `#D98A63` / `#C4663F`) with a white spark.
- Clear space: keep at least one panel-corner-radius (≈ tile/3.7) of empty space on all sides.
- Minimum size: 16px (favicon), 20px for the wordmark mark.

## Palette
| Token | Hex | Use |
|---|---|---|
| Terracotta (primary) | `#C4663F` | brand accent, tile, front panel |
| Terracotta deep | `#A94F2C` | pressed/active accent |
| Terracotta mid | `#D98A63` | secondary panel, dark-bg wordmark name |
| Terracotta soft | `#ECC9B8` | tertiary panel, subtle fills |
| Ink | `#2A2018` | primary text |
| Cream | `#FAF6EF` | light background |

Accent is also offered as a user tweak in the app (blue `#2F6DD0`, green `#1F8A5B`, violet `#7A5AE0`, graphite `#3B3B3B}`) — the mark accepts any single accent.

## Typography
- **Wordmark**: system sans (`ui-sans-serif, system-ui, …`). "Minimal" in **bold** terracotta, "Sessions" in regular ink, tight tracking (-0.4).
- **Tagline**: JetBrains Mono, "Claude coding sessions".

## Don'ts
- Don't recolor the spark to anything but the accent (color tile) or white (light surfaces).
- Don't add gradients or drop shadows to the mark.
- Don't reorder or re-space the panels.
- Don't stretch — scale uniformly.
