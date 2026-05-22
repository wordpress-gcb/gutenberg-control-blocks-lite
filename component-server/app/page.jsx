export default function Home() {
  return (
    <main className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-2">GCB Lite Component Server</h1>
      <p className="text-neutral-600 mb-6">
        Block-rendering endpoint for the <code className="font-mono text-sm">gcb-lite</code> plugin.
      </p>
      <p className="text-sm">
        Blocks render at{' '}
        <code className="font-mono">/wordpress/render/&#123;slug&#125;?attrs=&#123;json&#125;</code>
      </p>
    </main>
  );
}
