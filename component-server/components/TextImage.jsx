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

  // The image control may yield an empty object {} when nothing's selected.
  const imageUrl = image?.url || '';
  const imageAlt = image?.alt || '';

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
          {imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={imageAlt}
              className="w-full h-auto rounded-lg shadow-sm"
              loading="lazy"
            />
          ) : (
            <div className="aspect-video w-full bg-neutral-100 border border-dashed border-neutral-300 rounded-lg grid place-items-center text-neutral-400 text-sm">
              Add an image in the Inspector →
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
