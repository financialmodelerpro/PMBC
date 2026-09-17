/**
 * How the founder portrait is framed, everywhere it appears: the home founder
 * card, the founder profile hero, the tool results partner card and the PDF
 * report's closing page.
 *
 * One rule for all four. The frame is a fixed 4:5 portrait box, and the image
 * is cropped to cover it, never stretched or squeezed into it. The crop is
 * anchored on the face, which in a head and shoulders portrait sits in the
 * upper part of the picture, so a file whose proportions differ from the frame
 * loses its edges and the bottom of the shoulders, not the top of the head.
 *
 * The stored portrait is 1240 by 1560 (0.795), so today the crop removes less
 * than one percent. The rule matters for the next file uploaded.
 *
 * Pure and dependency free, so the PDF renderer and the verifiers can use it.
 */

/** Width over height of the portrait frame. */
export const PORTRAIT_RATIO = 4 / 5;

/** Where the crop is anchored, as fractions of the spare width and height. */
export const PORTRAIT_FOCUS = { x: 0.5, y: 0.3 } as const;

/** The same anchor as a CSS `object-position`. */
export const PORTRAIT_OBJECT_POSITION = `${PORTRAIT_FOCUS.x * 100}% ${PORTRAIT_FOCUS.y * 100}%`;

/**
 * The cover crop for a source image drawn into an output box: scale so the box
 * is covered, then take the box from the scaled image at the focus point.
 */
export function portraitCrop(sourceWidth: number, sourceHeight: number, outWidth: number, outHeight: number) {
  const scale = Math.max(outWidth / sourceWidth, outHeight / sourceHeight);
  const width = Math.max(outWidth, Math.round(sourceWidth * scale));
  const height = Math.max(outHeight, Math.round(sourceHeight * scale));
  return {
    width,
    height,
    left: Math.round((width - outWidth) * PORTRAIT_FOCUS.x),
    top: Math.round((height - outHeight) * PORTRAIT_FOCUS.y),
  };
}
