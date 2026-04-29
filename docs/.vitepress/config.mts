import { defineConfig } from 'vitepress'

const SITE_URL = 'https://docs.meshguard.app'
const SITE_TITLE = 'MeshGuard Docs'
const SITE_DESCRIPTION =
  'Official documentation for MeshGuard, the governance control plane for AI agents. Identity, policy, audit, and integrations for enterprise agent ecosystems.'

export default defineConfig({
  title: 'MeshGuard',
  description: SITE_DESCRIPTION,
  cleanUrls: true,
  ignoreDeadLinks: true,
  lastUpdated: true,

  // Auto-generates sitemap.xml from every built page
  sitemap: {
    hostname: SITE_URL,
    transformItems: (items) =>
      items.map((item) => ({
        ...item,
        changefreq: 'weekly',
        priority: item.url === '' || item.url === '/' ? 1.0 : 0.8,
      })),
  },

  head: [
    ['link', { rel: 'icon', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#00D4AA' }],
    ['meta', { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' }],
    ['meta', { name: 'googlebot', content: 'index, follow' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: SITE_TITLE }],
    ['meta', { property: 'og:image', content: 'https://meshguard.app/og-image.png' }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:site', content: '@MeshGuardApp' }],
    ['meta', { name: 'twitter:creator', content: '@MeshGuardApp' }],
    [
      'script',
      { type: 'application/ld+json' },
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        publisher: {
          '@type': 'Organization',
          name: 'MeshGuard',
          url: 'https://meshguard.app',
          logo: 'https://meshguard.app/logo.png',
        },
        about: 'AI agent governance, identity, policy, and audit',
        inLanguage: 'en-US',
      }),
    ],
  ],

  // Per-page canonical URL + OG title/description
  transformPageData(pageData) {
    const canonicalUrl = `${SITE_URL}/${pageData.relativePath}`
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '')
    const title = pageData.frontmatter.title || pageData.title || SITE_TITLE
    const description =
      pageData.frontmatter.description || pageData.description || SITE_DESCRIPTION

    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: canonicalUrl }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
    )
  },

  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'MeshGuard',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Integrations', link: '/integrations/overview' },
      { text: 'API', link: '/api/overview' },
      { text: 'Issues', link: 'https://github.com/meshguard/issues' },
      { text: 'Dashboard', link: 'https://dashboard.meshguard.app' },
      { text: 'Sign Up', link: 'https://meshguard.app' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is MeshGuard?', link: '/guide/what-is-meshguard' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Quick Start', link: '/guide/quickstart' },
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Agent Identity', link: '/guide/identity' },
            { text: 'Policies', link: '/guide/policies' },
            { text: 'Trust Scoring & Delegation', link: '/guide/trust-scoring' },
            { text: 'Anomaly Detection', link: '/guide/anomaly-detection' },
            { text: 'Role-Based Access Control', link: '/guide/rbac' },
            { text: 'Streaming Content Inspection', link: '/guide/streaming-security' },
            { text: 'Destructive Action Prevention', link: '/guide/destructive-prevention' },
            { text: 'Audit Logging', link: '/guide/audit' },
            { text: 'Compliance Reports', link: '/guide/compliance-reports' },
            { text: 'Analytics Dashboard', link: '/guide/analytics' },
            { text: 'Alerting', link: '/guide/alerting' },
            { text: 'Agent Discovery', link: '/guide/agent-discovery' },
            { text: 'OpenTelemetry Integration', link: '/guide/otel' },
            { text: 'CLI Reference', link: '/guide/cli' },
          ]
        },
        {
          text: 'Deployment',
          items: [
            { text: 'Self-Hosted', link: '/guide/self-hosted' },
            { text: 'Guardian Sidecar', link: '/guide/guardian-sidecar' },
            { text: 'Enterprise', link: '/guide/enterprise' },
          ]
        },
        {
          text: 'Account',
          items: [
            { text: 'SSO / OAuth Login', link: '/guide/sso' },
            { text: 'Billing & Subscriptions', link: '/guide/billing' },
          ]
        },
        {
          text: 'Release Notes',
          items: [
            { text: 'Changelog', link: '/guide/changelog' },
          ]
        }
      ],
      '/integrations/': [
        {
          text: 'SDKs',
          items: [
            { text: 'Overview', link: '/integrations/overview' },
            { text: 'Python SDK', link: '/integrations/python' },
            { text: 'JavaScript SDK', link: '/integrations/javascript' },
            { text: '.NET SDK', link: '/integrations/dotnet' },
            { text: 'Go SDK', link: '/integrations/go' },
            { text: 'Rust SDK', link: '/integrations/rust' },
          ]
        },
        {
          text: 'Frameworks',
          items: [
            { text: 'LangChain', link: '/integrations/langchain' },
            { text: 'CrewAI', link: '/integrations/crewai' },
            { text: 'AutoGPT', link: '/integrations/autogpt' },
            { text: 'OpenClaw', link: '/integrations/openclaw' },
            { text: 'Clawdbot', link: '/integrations/clawdbot' },
            { text: 'Claude Code', link: '/integrations/claude-code' },
            { text: 'OpenAI Agents', link: '/integrations/openai-agents' },
            { text: 'Semantic Kernel', link: '/integrations/semantic-kernel' },
            { text: 'AWS Bedrock', link: '/integrations/bedrock' },
            { text: 'Vertex AI', link: '/integrations/vertex-ai' },
            { text: 'Generic HTTP', link: '/integrations/http' },
          ]
        },
        {
          text: 'Tooling',
          items: [
            { text: 'Terraform Provider', link: '/integrations/terraform' },
            { text: 'GitHub Action', link: '/integrations/github-action' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/overview' },
            { text: 'Authentication', link: '/api/authentication' },
            { text: 'Gateway Endpoints', link: '/api/gateway' },
            { text: 'Admin Endpoints', link: '/api/admin' },
            { text: 'Analytics API', link: '/api/analytics' },
            { text: 'Billing API', link: '/api/billing' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/meshguard/issues' },
      { icon: 'x', link: 'https://x.com/MeshGuardApp' },
      { icon: 'linkedin', link: 'https://www.linkedin.com/company/meshguard/' },
    ],

    footer: {
      message: 'Governance Control Plane for AI Agents',
      copyright: 'Copyright © 2026 MeshGuard'
    },

    search: {
      provider: 'local'
    }
  }
})
