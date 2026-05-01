# Wire format

`POST /fb` carries exactly **163,200 bytes**: the panel's native 2-bit-per-pixel layout, row-major, 960 columns × 680 rows.

Each byte holds 4 pixels, MSB first:

```
bit7..6  bit5..4  bit3..2  bit1..0
 px0      px1      px2      px3
```

Pixel values:

| Bits | Color  |
|------|--------|
| 00   | black  |
| 01   | white  |
| 10   | yellow |
| 11   | red    |

The firmware does no decoding, no quantization, no dithering. The client is responsible for converting whatever source it has (RGB image, vector drawing, text) down to this 4-color, 2bpp representation.

## Why client-side rendering

- Keeps the firmware tiny: no PNG decoder, no font, no graphics library, no allocator pressure beyond a single framebuffer.
- Matches the panel's native data layout exactly — the body streams straight to SPI.
- Clients have orders of magnitude more CPU and memory; a Python or JS script can do high-quality dithering in milliseconds.

## Size math

```
960 cols × 680 rows × 2 bits/pixel = 1,305,600 bits
                                   = 163,200 bytes
                                   ≈ 159 KiB
```

This is exact and fixed. Anything other than 163,200 bytes is rejected with `400 Bad Request`.
