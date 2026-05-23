/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // The component server consumes images uploaded to WordPress — allow any
    // host so test setups with different WP URLs (gcblitewp.test, localhost,
    // etc.) work without re-configuring this file.
    remotePatterns: [{ protocol: 'http', hostname: '**' }, { protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
