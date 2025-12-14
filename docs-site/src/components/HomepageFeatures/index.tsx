import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'OpenLibrary Integration',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Import and search through <strong>5M+ books (editions)</strong>, <strong>40M+ works</strong>, and <strong>15M+ authors</strong> from
        OpenLibrary. Monthly automated updates keep your data fresh.
      </>
    ),
  },
  {
    title: 'Lightning Fast Search',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Elasticsearch-powered full-text search with <strong>4-tier relevance boosting</strong>.
        Get results in under 100ms with accent-insensitive matching and phrase search.
      </>
    ),
  },
  {
    title: 'Production Ready',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Built with <strong>Bun</strong>, <strong>PostgreSQL 17</strong>, and <strong>Elasticsearch 8.11</strong>.
        Deploy with Docker Compose in 5 minutes. Comprehensive API documentation included.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
