const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
  },
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    // Allowing any site to frame the app enables clickjacking: an attacker can overlay
    // an invisible WedOps iframe and trick a signed-in planner into clicking destructive
    // actions. Default to same-origin framing; set FRAME_ANCESTORS to opt specific
    // partners in (e.g. "https://embed.example.com").
    const frameAncestors = process.env.FRAME_ANCESTORS || "'self'";

    const securityHeaders = [
      { key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors};` },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ];

    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    const headers = [{ source: "/(.*)", headers: securityHeaders }];

    // Cross-origin API access is opt-in. A wildcard ACAO on an app that relies on cookie
    // auth is a bad default, so only emit CORS headers when origins are configured.
    if (process.env.CORS_ORIGINS) {
      headers.push({
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS },
          { key: "Vary", value: "Origin" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      });
    }

    return headers;
  },
};

module.exports = nextConfig;
