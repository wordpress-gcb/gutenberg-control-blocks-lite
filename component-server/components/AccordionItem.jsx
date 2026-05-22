import * as RadixAccordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import InnerBlocks from './InnerBlocks';

/**
 * One accordion entry.
 *
 * The body is a free InnerBlocks slot: authors drop any blocks they want
 * inside (paragraphs, lists, images, embedded videos…). Only the question
 * lives as a typed attribute; the rest is content authored as blocks.
 *
 * Wrapped in its own RadixAccordion.Root so the editor preview of the child
 * block (rendered standalone) doesn't crash from a missing Root context.
 * On the public frontend each item gets its own Root inside the parent
 * accordion's Root — Radix scopes context per Root, so the inner one is
 * effectively a single-item nested accordion. Functionally equivalent.
 *
 * forceMount on Content keeps the body in the DOM while closed. The editor
 * preview is static SSR with no client hydration; without forceMount the
 * answer area would be hidden until the user clicks (which they can't, in
 * the static preview).
 */
export default function AccordionItem({ attributes = {}, innerBlocks = [] }) {
  const { question = '' } = attributes;
  const value = 'item';

  return (
    <RadixAccordion.Root
      type="single"
      collapsible
      className="border border-neutral-200 rounded-md bg-white"
    >
      <RadixAccordion.Item value={value}>
        <RadixAccordion.Header>
          <RadixAccordion.Trigger
            className={cn(
              'group w-full flex items-center justify-between',
              'px-4 py-3 text-left text-base font-medium',
              'hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            )}
          >
            <span>
              {question || (
                <span className="text-neutral-400 italic">Untitled question</span>
              )}
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </RadixAccordion.Trigger>
        </RadixAccordion.Header>
        <RadixAccordion.Content
          forceMount
          className="overflow-hidden data-[state=closed]:hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
        >
          <div className="px-4 pb-4 text-sm text-neutral-700 prose prose-sm max-w-none">
            <InnerBlocks blocks={innerBlocks} />
          </div>
        </RadixAccordion.Content>
      </RadixAccordion.Item>
    </RadixAccordion.Root>
  );
}
