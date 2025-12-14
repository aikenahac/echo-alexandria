import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'intro',
        'quick-start',
        'installation',
        'configuration',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'concepts/overview',
        'concepts/data-model',
        'concepts/import-pipeline',
        'concepts/search-architecture',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/overview',
        {
          type: 'category',
          label: 'Search Endpoints',
          items: [
            'api/search/editions',
            'api/search/authors',
          ],
        },
        {
          type: 'category',
          label: 'Catalog Endpoints',
          items: [
            'api/catalog/authors',
            'api/catalog/works',
            'api/catalog/editions',
          ],
        },
        {
          type: 'category',
          label: 'Admin Endpoints',
          items: [
            'api/admin/import-trigger',
            'api/admin/import-status',
          ],
        },
        'api/health',
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      items: [
        'operations/deployment',
        'operations/docker-setup',
        'operations/environment-variables',
        'operations/database-migrations',
        'operations/data-import',
        'operations/monitoring',
        'operations/troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/system-design',
        'architecture/database-schema',
        'architecture/elasticsearch-indices',
        'architecture/technology-stack',
        'architecture/data-flow',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      items: [
        'development/local-setup',
        'development/project-structure',
        'development/bun-guide',
        'development/database-management',
        'development/testing',
        'development/contributing',
      ],
    },
    {
      type: 'category',
      label: 'OpenLibrary Integration',
      items: [
        'openlibrary/data-dumps',
        'openlibrary/data-format',
        'openlibrary/relationships',
        'openlibrary/update-schedule',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Topics',
      items: [
        'advanced/performance-tuning',
        'advanced/scaling',
        'advanced/custom-search',
        'advanced/batch-processing',
      ],
    },
  ],
};

export default sidebars;
