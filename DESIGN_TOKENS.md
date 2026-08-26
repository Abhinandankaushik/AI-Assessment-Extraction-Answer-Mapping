# VedaAI — Design tokens (extracted from Figma Properties panel, exact)

Source: figma.com/design/GEjt1rt1s7AXvkcr4t8muE  (Page 1 / "Extraction flow")

## Frames
| Frame | node-id | Size |
|---|---|---|
| Upload Screen - Empty State | 1-8744 | 1440 x 787 |
| Upload Screen - filled state | 1-8797 | 1440 x 787 |
| Loading state | 1-9959 | 1440 x 787 |
| Question - Answer mapping screen | 1-8861 | 1440 x 1580 |
| Upload Empty (phone) | 1-10442 | 390 |
| Upload filled (phone) | 3-956 | 390 |
| Loading (phone) | 3-791 | 390 |
| Mapping - Questions tab (phone) | 3-1192 | 390 |
| Mapping - Answer Sheet tab (phone) | 3-1576 | 390 |

## Colors (named tokens from the file)
| Token | Value |
|---|---|
| Primary/primary - Orange | #FF5623 |
| (selected row border) | #FF8D36 |
| Background/Dark-Grey | #2B2B2B |
| Background/Dark-Grey 80 | #2B2B2B @ 80% |
| Text/Primary | #303030 |
| Text/Secondary Muted | #5E5E5E @ 55% |
| Text/Inverse Primary | #FFFFFF |
| Buttons/Buttons Primary | #181818 |
| Background/white | #FFFFFF |
| Background/white 25 | #FFFFFF @ 25% |
| Background/bg-off white primary | #F6F6F6 |
| Background/bg-off white 20% | #F0F0F0 |
| Background/bg-off white 50% | #CECECE |
| Utilities/Sucess | #34AC15 |
| Utilities/Sucess - 10 | #45B529 @ 10% |
| (danger text) | #C0350A |
| (danger pill bg) | #FFE9E2 |
| (warning text) | #E3600F |
| (warning pill bg) | #FF9900 @ 10% |
| (highlight fill) | #5EFF35 @ 10% |
| (highlight border) | #3DD218 |

### Gradients
- Upload/Loading page bg: linear-gradient #F5F5F5 -> #E9E5E5
- Mapping page bg (Background/bg - Gradient): linear-gradient #EEEEEE -> #DADADA
- Upload page bottom vignette: Ellipse 1318x428 at (x227,y679), #171717 @ 40%, LAYER BLUR 400

## Typography — Bricolage Grotesque, letter-spacing -4% everywhere unless noted
| Token | Weight | Size | Line height |
|---|---|---|---|
| Headings/bold-700/H-1 | 700 | 40px | 120% |
| H-2 (mobile hero) | 700 | 24px | 120% |
| Paragraph-Primary-Regular-400/P-1 | 400 | 20px | 140% |
| Paragraph-Primary-Regular-400/P-3 | 400 | 16px | 140% |
| Paragraph-Primary-Bold-700/P-3 | 700 | 16px | 140% |
| Paragraph-Primary-Medium-500/P-4 | 500 | 14px | 140% |
| number badge | 800 ExtraBold | 20px | 100% |
| AI feedback body | 400 | 14px | 140% |
| "Max 10MB" | 400 | 14px | 22px, ls -6% |
| AI Teacher's Toolkit label | Inter 500 | 16px | 28px |

## Components
- **Side Bar**: 304x763, top/left 12, radius 16, padding 24, justify space-between, #FFF
  shadows: `0 32 48 0 rgba(0,0,0,.20)`, `0 16 48 0 rgba(0,0,0,.12)`; scroll position fixed
- **Top bar**: 1100x56, top 12 / left 327, radius 16, padding L24 R8, gap 10, #FFFFFF @ 75%
- **Nav item**: 254x40, radius 8, padding 9/12, gap 8; active bg #F0F0F0
- **School card**: 256x84(hug), radius 16, padding 12, gap 16, bg #F0F0F0
- **Upload dropzone**: fill x 181, radius 20, border 1.5px dashed (6,6) #CECECE, padding 10, gap 10, bg #FFF
  interaction: on click -> navigate to "Upload Screen - filled state" (instant)
- **Primary Button - Dark**: hug 44 tall, radius 64, border 2px #FFFFFF@15%, padding 12/20/12/24,
  gap 8, bg Text/Primary #303030. DISABLED = same button at **opacity 25%**
- **Expand All button**: Primary Button - Dark variant, bg #FFFFFF, radius 64, padding 12/20/12/16, text #181818
- **Question row (default)**: fill 640 x hug 56, radius 16, padding 12, gap 24, bg #FFF
- **Question row (selected)**: fill 640 x hug 184, radius 16, **border 2px #FF8D36**, padding 12, gap 12, bg #FFF
- **Number badge**: 32x32, radius 100, border 2px #FFFFFF@25%, bg #2B2B2B@80%
  shadows: `0 4 16 0 #434343@10%`, `0 8 8.8 0 #868686@10%`
- **Number badge (selected)**: bg #FF5623, shadow `0 8 8.8 0 #FF7950@10%`
- **Score pill**: hug ~54x30, radius 100, padding 4/12, gap 4
  green bg #45B529@10% / text #34AC15 · red bg #FFE9E2 / text #C0350A · amber bg #FF9900@10% / text #E3600F
- **AI Feedback card**: fill 616 x hug 104, radius 16, padding 16/24, gap 24, bg #F6F6F6
- **Answer Sheet header**: fill x 64, padding 12/24, space-between, bg #303030,
  border-bottom 1.25px #000000@10%
- **Answer highlight rect**: radius 16, border 2px #3DD218, fill #5EFF35 @ 10%
- **Q-tag chip**: hug 45x30, radius top-left 12 / top-right 12 (bottom 0), padding 4/12,
  bg #34AC15, text #FFF 700/16px  — sits on top edge of the highlight rect
- **Teacher illustration**: 138x138 frame; outer ring #FF5623@10%, inner Ellipse 108px #FF5623@26%,
  photo group with 1.6px #F6F6F6@97% border

## Open / approximate
- Hero peach highlight behind "Question Paper & Answer Sheets": measured ~#FFDECB.
  Likely #FF5623 at low opacity (file uses @10% and @26% elsewhere). Verify visually.
