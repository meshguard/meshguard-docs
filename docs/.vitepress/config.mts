import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'MeshGuard',
  description: 'Governance Control Plane for AI Agents',
  ignoreDeadLinks: true,
  
  head: [
    ['link', { rel: 'icon', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#00D4AA' }],
  ],

  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'MeshGuard',
    
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Integrations', link: '/integrations/overview' },
      { text: 'API', link: '/api/overview' },
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
            { text: 'Audit Logging', link: '/guide/audit' },
            { text: 'Alerting', link: '/guide/alerting' },
          ]
        },
        {
          text: 'Deployment',
          items: [
            { text: 'Enterprise', link: '/guide/enterprise' },
          ]
        }
      ],
      '/integrations/': [
        {
          text: 'SDKs',
          items: [
            { text: 'Overview', link: '/integrations/overview' },
            { text: 'Python SDK', link: '/integrations/python' },
          ]
        },
        {
          text: 'Frameworks',
          items: [
            { text: 'LangChain', link: '/integrations/langchain' },
            { text: 'CrewAI', link: '/integrations/crewai' },
            { text: 'AutoGPT', link: '/integrations/autogpt' },
            { text: 'Generic HTTP', link: '/integrations/http' },
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
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/meshguard/meshguard-python' },
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
