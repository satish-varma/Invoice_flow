import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // cacheOnFrontEndNav: true,
  // aggressiveFrontEndNavCaching: true,
  // reloadOnOnline: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    /* config options here */
    output: 'standalone',
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'placehold.co',
                port: '',
                pathname: '/**',
            },
        ],
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        // Allow framing from Google services.
                        value: "frame-ancestors 'self' https://*.google.com",
                    },
                ],
            },
        ];
    },
};

export default withPWA(nextConfig);
