/** @type {import('next').NextConfig} */
// Statische export: de hele demo draait in de browser (geen server, geen containers, geen LLM).
// Zet NEXT_PUBLIC_BASE_PATH (bijv. "/ov-credential-demo") bij hosting in een submap, zoals GitHub Pages.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  output: 'export',
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

module.exports = nextConfig;
