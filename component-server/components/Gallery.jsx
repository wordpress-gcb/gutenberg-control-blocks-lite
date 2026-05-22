// Tailwind needs to see all the column classes literally so they're emitted.
const COLUMN_CLASSES = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
};

export default function Gallery({ attributes = {} }) {
  const { heading = '', images = [], columns = 3 } = attributes;
  const list = Array.isArray(images) ? images : [];
  const columnClass = COLUMN_CLASSES[columns] || COLUMN_CLASSES[3];

  return (
    <section className="max-w-6xl mx-auto p-6">
      {heading && (
        <h2 className="text-2xl font-semibold text-neutral-900 mb-6">{heading}</h2>
      )}

      {list.length === 0 ? (
        <div className="aspect-[16/4] w-full bg-neutral-100 border border-dashed border-neutral-300 rounded-lg grid place-items-center text-neutral-400 text-sm">
          Add images in the Inspector →
        </div>
      ) : (
        <div className={`grid grid-cols-2 ${columnClass} gap-4`}>
          {list.map((img) => (
            <figure key={img.id} className="overflow-hidden rounded-md bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt || ''}
                className="w-full h-full object-cover aspect-square"
                loading="lazy"
              />
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
