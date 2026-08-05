/** @type {import('next').NextConfig} */
const API =
  process.env.API_PROXY_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost";
const isExport = process.env.NEXT_EXPORT === "true";

const nextConfig = {
  output: isExport ? "export" : "standalone",
  async rewrites() {
    if (isExport) {
      return [];
    }
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

export default nextConfig;
