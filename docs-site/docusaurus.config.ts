import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Echo Alexandria',
  tagline: 'OpenLibrary Data Source API Documentation',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.echo-alexandria.com',
  baseUrl: '/',

  organizationName: 'aikenahac',
  projectName: 'echo-data-source',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/aikenahac/echo-data-source/edit/master/docs-site/',
        },
        blog: false, // Disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  themeConfig: {
    image: 'img/echo-alexandria-social-card.jpg',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Echo Alexandria',
      logo: {
        alt: 'Echo Alexandria Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'doc',
          docId: 'api/overview',
          position: 'left',
          label: 'API Reference',
        },
        {
          href: 'https://github.com/aikenahac/echo-data-source',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
            {
              label: 'API Reference',
              to: '/docs/api/overview',
            },
            {
              label: 'Architecture',
              to: '/docs/architecture/system-design',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'OpenLibrary',
              href: 'https://openlibrary.org',
            },
            {
              label: 'OpenLibrary Data Dumps',
              href: 'https://openlibrary.org/developers/dumps',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/aikenahac/echo-data-source',
            },
            {
              label: 'Report Issues',
              href: 'https://github.com/aikenahac/echo-data-source/issues',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Echo. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript', 'yaml', 'docker', 'sql'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
