/**
 * PWA Manifest
 * Web App Manifest configuration
 */

import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Central Hub - Railway Management',
    short_name: 'Central Hub',
    description: 'Enterprise-grade Railway management platform with AI-powered automation',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    orientation: 'portrait',
    scope: '/',
    icons: [
      {
        src: '/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
      },
      {
        src: '/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
      },
      {
        src: '/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
      },
      {
        src: '/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
      },
      {
        src: '/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Services',
        short_name: 'Services',
        description: 'View all services',
        url: '/dashboard/services',
        icons: [{ src: '/icon-96x96.png', sizes: '96x96' }],
      },
      {
        name: 'AI Hub',
        short_name: 'AI',
        description: 'AI insights and recommendations',
        url: '/dashboard/ai-hub',
        icons: [{ src: '/icon-96x96.png', sizes: '96x96' }],
      },
    ],
  };
}
