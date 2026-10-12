import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  // disable: process.env.NODE_ENV === "development", // Temporarily enable in dev for testing
  // cacheOnFrontEndNav: true,
  // aggressiveFrontEndNavCaching: true,
  // reloadOnOnline: true,
});

const nextConfig: NextConfig = {
    /* config options here */
    output: 'standalone',
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
        allowedDevOrigins: [
            '192.168.29.101',
            'localhost:9002',
            '192.168.29.101:9002',
            '10.0.2.2:9002',
        ],
    } as any,
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https' as const,
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
