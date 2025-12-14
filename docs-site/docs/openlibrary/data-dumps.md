---
title: Data Dumps
---

# OpenLibrary Data Dumps

OpenLibrary publishes complete monthly snapshots of their entire library catalog as compressed data dumps. Echo Alexandria uses these dumps as the primary source for importing bibliographic data on an efficient, large-scale basis.

## Overview

OpenLibrary data dumps are comprehensive exports of the complete OpenLibrary database, published monthly as gzipped text files. Rather than making millions of individual API calls, Echo Alexandria streams these dumps directly into PostgreSQL and Elasticsearch for efficient batch processing.

### Why Use Dumps Over API Calls?

- **Efficiency**: Import millions of records in hours, not days
- **Consistency**: Atomic snapshots ensure data consistency
- **Cost-effective**: No API rate limits or quota concerns
- **Reproducibility**: Same dump always produces identical results
- **Bandwidth**: Pre-compressed files minimize transfer size

## Available Dumps

OpenLibrary publishes three main data dumps, each representing different levels of bibliographic detail:

### Authors Dump

**URL**: [https://openlibrary.org/data/ol_dump_authors_latest.txt.gz](https://openlibrary.org/data/ol_dump_authors_latest.txt.gz)

Contains metadata for all authors in OpenLibrary, including biographical information and references to their works.

- **Compressed size**: ~500 MB
- **Uncompressed size**: ~2 GB
- **Approximate record count**: 3-4 million authors
- **Typical download time**: 5-15 minutes (depending on connection)

**Contains**: Author names, alternate names, birth/death dates, biographical information, photo references

### Works Dump

**URL**: [https://openlibrary.org/data/ol_dump_works_latest.txt.gz](https://openlibrary.org/data/ol_dump_works_latest.txt.gz)

Contains work records, which represent unique intellectual works (as opposed to specific publications or editions). A work may have multiple editions across different publishers and formats.

- **Compressed size**: ~2 GB
- **Uncompressed size**: ~8 GB
- **Approximate record count**: 1.8 million works
- **Typical download time**: 30-60 minutes (depending on connection)

**Contains**: Work titles, descriptions, subject classifications, author keys, first publication dates, cover images

### Editions Dump

**URL**: [https://openlibrary.org/data/ol_dump_editions_latest.txt.gz](https://openlibrary.org/data/ol_dump_editions_latest.txt.gz)

Contains edition records, which represent specific publications. A single work may have multiple editions (hardcover, paperback, different publishers, etc.). This is the largest dump.

- **Compressed size**: ~10 GB
- **Uncompressed size**: ~45 GB
- **Approximate record count**: 33+ million editions
- **Typical download time**: 2-4 hours (depending on connection)

**Contains**: Edition titles, ISBN identifiers, publishers, publication dates, language information, physical format details, work and author key references

## File Size and Download Estimates

The following table provides estimated download times based on typical connection speeds:

| Dump | Compressed | Uncompressed | 10 Mbps | 50 Mbps | 100 Mbps | 500 Mbps |
|------|-----------|-------------|---------|---------|----------|----------|
| Authors | 500 MB | 2 GB | ~6 min | ~1 min | under 1 min | under 1 min |
| Works | 2 GB | 8 GB | ~27 min | ~5 min | ~2 min | under 1 min |
| Editions | 10 GB | 45 GB | ~2.2 hrs | ~27 min | ~13 min | ~3 min |
| **All Three** | **12.5 GB** | **55 GB** | **~2.5 hrs** | **~33 min** | **~17 min** | **~4 min** |

Note: These estimates are for download time only and do not include decompression or import processing, which can be significant especially for the editions dump.

## Update Schedule

OpenLibrary publishes new dumps on the **1st of each month**, typically around **00:00 UTC**. This means:

- New dumps become available once per month
- Best practice is to check for and import new dumps shortly after the 1st of the month
- Planning your refresh schedule around this window ensures you always have the latest data

```
Monthly cycle (typical):
Month 1st (00:00 UTC) → New dumps published
Month 1st (06:00 UTC) → Check and verify new dumps
Month 1st-2nd → Import new data into Echo Alexandria
```

## How Echo Alexandria Uses Dumps

The import process follows a streaming pipeline optimized for handling massive files:

```
1. Download gzipped dump file
   ↓
2. Stream decompress (gunzip) in real-time
   ↓
3. Parse tab-separated format line-by-line
   ↓
4. Batch insert into PostgreSQL (1000 records per batch)
   ↓
5. Bulk index into Elasticsearch
   ↓
6. Refresh search indices
   ↓
7. Validate imported record counts
```

This streaming approach means Echo Alexandria never requires sufficient disk space to store the entire uncompressed dump—decompression and importing happen simultaneously.

## Alternative Access Methods

While dumps are the primary method for bulk data access, OpenLibrary offers alternatives:

### OpenLibrary API

**Endpoint**: [https://openlibrary.org/api/](https://openlibrary.org/api/)

Suitable for:
- Accessing specific, known records
- Real-time queries during development
- Small-scale testing and exploration

**Not suitable for**:
- Complete bulk imports (too slow, hits rate limits)
- Regular full-database refreshes
- Processing millions of records

### OpenLibrary Search API

**Endpoint**: [https://openlibrary.org/search/](https://openlibrary.org/search/)

Provides search capabilities but is also subject to rate limits and not optimized for bulk export.

## Historical Dumps

OpenLibrary maintains an archive of historical dumps at [https://openlibrary.org/data/](https://openlibrary.org/data/). This is useful if you need to:

- Understand data changes over time
- Troubleshoot specific records
- Analyze historical trends in the library

Historical dumps follow the naming convention: `ol_dump_{entity_type}_{YYYY_MM_DD}.txt.gz`

## Data Format Stability

The dump format (tab-separated with 5 columns) is stable and has remained consistent for years. However:

- **JSON schema** within the 5th column can evolve between dumps
- New fields may be added to entity JSON objects
- Field values may change meaning or format

Echo Alexandria's import code is designed to be resilient to:
- Unknown JSON fields (ignores them)
- Missing optional fields (handles gracefully)
- Field format variations (e.g., dates as strings)

## Licensing

All OpenLibrary data is published under the **Open Database License (ODbL)** and **Creative Commons Attribution License**.

**Key points**:
- You can use, share, and modify the data
- You must attribute OpenLibrary as the data source
- Any database incorporating OpenLibrary data must maintain ODbL compliance
- Echo Alexandria includes appropriate attribution in all contexts

For more details, see [OpenLibrary Licensing](https://openlibrary.org/developers/license).

## Monitoring Dump Availability

To check if new dumps are available, you can:

```bash
# Check the latest dump files via OpenLibrary's data page
curl -s https://openlibrary.org/data/ | grep -o 'ol_dump.*latest.*gz'

# Or directly test if a dump is accessible
curl -I https://openlibrary.org/data/ol_dump_authors_latest.txt.gz
```

## Best Practices

1. **Schedule imports during low-traffic hours** to minimize impact on query performance
2. **Monitor disk space** carefully, especially for the editions dump (45 GB uncompressed)
3. **Verify imports** by checking record counts against expected values
4. **Keep previous versions** until you've validated the new import
5. **Document your import date** for troubleshooting and audit purposes

## Next Steps

- Learn about the [data format](./data-format.md) specification
- Understand [entity relationships](./relationships.md) between Authors, Works, and Editions
- Set up your [monthly refresh schedule](./update-schedule.md)
- See the [Import API documentation](../api/admin/import-trigger) for programmatic access
