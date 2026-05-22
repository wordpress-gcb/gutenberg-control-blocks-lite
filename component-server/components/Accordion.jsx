import * as RadixAccordion from '@radix-ui/react-accordion';
import Repeater from './Repeater';

/**
 * Accordion parent. Owns the Radix root; children render themselves as
 * Radix items inside it.
 *
 * The parent does NOT iterate innerBlocks itself. Instead it delegates to
 * <Repeater>, which:
 *
 *   - In the editor preview path (innerBlocks is empty because the editor
 *     manages the live tree separately), emits a <repeater> marker that
 *     gcb-lite's parse-preview.js swaps for the real InnerBlocks UI.
 *
 *   - On the public frontend, receives the parsed innerBlocks and recurses
 *     via BlockRenderer, which looks each child up in WP_BLOCK_REGISTRY and
 *     renders it. Each accordion-test-item then renders itself as a Radix
 *     item inside our Accordion.Root above.
 *
 * That single-place rendering is what prevents the "double render" we saw
 * when the parent iterated AND emitted the marker simultaneously.
 */
export default function Accordion({ attributes = {}, innerBlocks = [] }) {
  const { heading = '' } = attributes;
  const hasItems = (innerBlocks || []).some(
    (b) => b?.blockName === 'gcb/accordion-test-item',
  );

  return (
    <section className="max-w-2xl mx-auto p-6">
      {heading && <h2 className="text-2xl font-semibold mb-4">{heading}</h2>}

      <RadixAccordion.Root
        type="single"
        collapsible
        className={
          hasItems
            ? 'divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden'
            : ''
        }
      >
        <Repeater
          blocks={innerBlocks}
          allowedBlocks={['gcb/accordion-test-item']}
          addButtonLabel="Add FAQ item"
          min={1}
          defaultChildren={3}
        />
      </RadixAccordion.Root>
    </section>
  );
}
