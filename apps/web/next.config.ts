import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: [
    '@wikly/api-contracts',
    '@wikly/domain',
    '@wikly/validation',
  ],
  experimental: {
    // Avoid the TypeScript CLI's captured-output path; normal project checking
    // remains enforced by `pnpm typecheck` and Next's compiler API.
    useTypeScriptCli: false,
  },
}

export default nextConfig
