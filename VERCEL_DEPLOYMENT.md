# Vercel Deployment Guide

This guide explains how to deploy the AI Manga Reader on Vercel.

## Prerequisites

- Node.js 20.x or higher
- npm or yarn package manager
- Git repository connected to GitHub
- Vercel account (https://vercel.com)

## Deployment Steps

### 1. Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Select the repository and click "Import"

### 2. Configure Environment Variables

In the Vercel project settings, add the following environment variables:

```
NEXT_PUBLIC_API_URL=https://mangadex.org/api/v5
```

Optional variables:
- `NEXT_PUBLIC_GA_ID` - Google Analytics ID
- `OCR_LANGUAGE` - Default OCR language (default: "en")

### 3. Deploy

Vercel will automatically deploy on every push to the main branch.

To manually deploy:
```bash
npm run build
```

## Project Configuration

The deployment is optimized using:

- **vercel.json** - Vercel-specific configuration
- **.vercelignore** - Files to exclude from deployment
- **next.config.ts** - Next.js optimization settings

## Performance Optimizations

### Image Optimization
- WebP and AVIF format support
- Responsive image sizes
- Automatic optimization of MangaDex images

### API Optimization
- Caching headers for API routes
- Memory limits configured for OCR processing
- 60-second timeout for complex OCR tasks

### Code Optimization
- CSS optimization enabled
- Package import optimization for lucide-react
- Turbopack for faster builds

## Serverless Functions

### OCR API Endpoint (`/api/readTextAndReplace`)

- **Max Duration:** 60 seconds
- **Memory:** 3008 MB

This endpoint handles:
- Image upload and processing
- Text extraction using OCR
- Multi-language support
- Image enhancement

## Deployment Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| Function Timeout | 60s | Standard with Vercel Pro |
| Memory per Function | 3008 MB | Standard allocation |
| Storage | Temporary /tmp | Cleaned up after each request |
| Build Cache | 200 MB | For faster rebuilds |

## Monitoring

### Vercel Analytics
- Visit your project's Analytics tab in Vercel Dashboard
- Monitor Core Web Vitals, performance metrics

### Logs
- View real-time logs in Vercel Dashboard
- Check function execution logs for OCR endpoint

## Troubleshooting

### Build Failing

1. Check Node version: `node -v` (must be 20.x)
2. Clear cache: Delete `.next/` folder
3. Check dependencies: `npm install`

### OCR Timeout Issues

If OCR processing times out:
1. Optimize image preprocessing
2. Consider breaking large images into chunks
3. Monitor function logs for memory usage

### Image Optimization Issues

Verify remote image domains in next.config.ts:
```typescript
remotePatterns: [
  {
    protocol: 'https',
    hostname: 'cmdxd98sb0x3yprd.mangadex.network',
  },
  // ... other domains
]
```

## Local Testing

To test the production build locally:

```bash
npm run build
npm run start
```

This runs the optimized production version.

## Environment-Specific Configuration

### Development
```bash
npm run dev
```

### Production (Local)
```bash
npm run build && npm run start
```

### Production (Vercel)
Automatic deployment on git push to main branch.

## Advanced Configuration

### Custom Domains

1. In Vercel Dashboard, go to Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### Caching Strategy

API routes use the following cache headers:

- **API endpoints:** `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`
- **Static assets:** `Cache-Control: public, max-age=31536000, immutable`

### Security Headers

Automatically configured:
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

## Performance Tips

1. **Monitor Web Vitals:** Check Vercel Analytics regularly
2. **Optimize Images:** Use MangaDex image CDN when possible
3. **Enable Caching:** API responses are cached for 1 hour
4. **Monitor Memory:** OCR processing can use up to 3GB

## Support

For deployment issues:
- Check Vercel documentation: https://vercel.com/docs
- Review project logs in Vercel Dashboard
- Check GitHub Issues in the repository
