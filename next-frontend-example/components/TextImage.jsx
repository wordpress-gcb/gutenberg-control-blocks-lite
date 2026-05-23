import { cn } from '@/lib/utils';
import InnerBlocks from './InnerBlocks';

/**
 * Text + image side-by-side. Eyebrow and heading are typed Inspector
 * attributes (short atoms, schema-constrained). The body is a free
 * InnerBlocks slot — authors drop paragraphs, lists, buttons, or any
 * other block, and gcb-lite swaps the marker for a real InnerBlocks
 * UI in the editor.
 *
 * Image lives in the image control; layout flips left/right based on
 * the imageSide button-group attribute.
 */
export default function TextImage({ attributes = {}, innerBlocks = [] }) {
  const {
    eyebrow = '',
    heading = '',
    image,
    imageSide = 'right',
  } = attributes;

  return (
    <section className="max-w-6xl mx-auto p-6">
      <div
        className={cn(
          'grid grid-cols-1 md:grid-cols-2 gap-8 items-center',
          imageSide === 'left' && 'md:[&>*:first-child]:order-2',
        )}
      >
        <div>
          {eyebrow && (
            <p className="text-sm font-medium uppercase tracking-wider text-blue-600 mb-2">
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2 className="text-3xl md:text-4xl font-semibold text-neutral-900 mb-4">
              {heading}
            </h2>
          )}
          <div className="prose prose-neutral max-w-none text-neutral-700">
            <InnerBlocks blocks={innerBlocks} />
          </div>
        </div>

        <div>
          {image?.url ? <Image image={image} /> : (
            <div className="aspect-video w-full bg-neutral-100 border border-dashed border-neutral-300 rounded-lg grid place-items-center text-neutral-400 text-sm">
              Add an image in the Inspector →
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Honour the full ImageField surface documented in src/controls/image.js:
 *
 *   - url, alt            → standard <img>
 *   - focalPoint {x, y}   → object-position so cover/contain crop sensibly
 *   - size                → object-fit (cover | contain | auto)
 *   - customWidth         → inline width override (e.g. "320px", "50%")
 *
 * `repeat` and `isFixed` are background-only features (background-repeat,
 * background-attachment). TextImage uses a foreground <img>, so they don't
 * apply here. A future BackgroundImage block would honour them via CSS
 * background-* properties.
 */
function Image({ image }) {
  const {
    url,
    alt = '',
    focalPoint,
    size = 'cover',
    customWidth = '',
  } = image;

  // FocalPointPicker stores {x, y} as 0..1 numbers. Default to centre.
  const fpx = typeof focalPoint?.x === 'number' ? focalPoint.x : 0.5;
  const fpy = typeof focalPoint?.y === 'number' ? focalPoint.y : 0.5;

  // Auto = let the image be its intrinsic size (no fit). Cover/contain crop
  // and the focal point decides which part of the image stays in view.
  const objectFit = size === 'auto' ? undefined : size;
  const objectPosition = objectFit ? `${fpx * 100}% ${fpy * 100}%` : undefined;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="rounded-lg shadow-sm"
      style={{
        width: customWidth || '100%',
        height: 'auto',
        objectFit,
        objectPosition,
      }}
    />
  );
}
