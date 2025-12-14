---
title: Data Format
---

# OpenLibrary Data Format

OpenLibrary dumps use a standardized tab-separated format with embedded JSON. Understanding this format is essential for working with the import pipeline and debugging data issues.

## Format Overview

Each line in an OpenLibrary dump represents a single entity (Author, Work, or Edition) and contains exactly 5 tab-separated columns:

```
type    key    revision    last_modified    json
```

### Column Specification

| Column | Name | Type | Example | Description |
|--------|------|------|---------|-------------|
| 1 | `type` | String | `/type/author` | Entity type identifier (see below) |
| 2 | `key` | String | `/authors/OL23919A` | Unique entity key |
| 3 | `revision` | Integer | `42` | Monotonically increasing revision number |
| 4 | `last_modified` | ISO 8601 | `2023-12-15T14:32:10.123456` | Last modification timestamp |
| 5 | `json` | JSON Object | `{"name":"..."}` | Complete entity data as JSON |

### Field Details

#### Type Field

The `type` field identifies what kind of entity the record represents:

- `/type/author` - Author record (from authors dump)
- `/type/work` - Work record (from works dump)
- `/type/edition` - Edition record (from editions dump)

This field is consistent within each dump but appears in all dumps for reference.

#### Key Field

The `key` field is OpenLibrary's unique identifier for the entity:

- **Author keys**: `/authors/OL{number}A`
  - Example: `/authors/OL23919A` (J.R.R. Tolkien)
  - Format: Always uppercase 'A' suffix

- **Work keys**: `/works/OL{number}W`
  - Example: `/works/OL45804W` (The Lord of the Rings)
  - Format: Always uppercase 'W' suffix

- **Edition keys**: `/books/OL{number}M`
  - Example: `/books/OL7353617M` (LOTR 1954 first edition)
  - Format: Always uppercase 'M' suffix, uses `/books/` prefix

Keys are stable and never change for a given entity, making them reliable for cross-referencing.

#### Revision Field

The `revision` field is an integer that increments each time an entity is modified:

- Starts at 1 for new entities
- Increments by 1 with each edit
- Useful for detecting changes between dumps
- Not guaranteed to be continuous (deletions don't affect numbering)

#### Last Modified Field

The `last_modified` field contains an ISO 8601 timestamp indicating when the entity was last updated:

```
2023-12-15T14:32:10.123456  (with microseconds)
2023-12-15T14:32:10         (without microseconds)
```

Useful for:
- Finding recently changed records
- Implementing incremental update strategies
- Auditing data provenance

#### JSON Field

The 5th column contains a complete JSON object with all entity-specific data. The schema varies by entity type (see sections below).

## Author JSON Structure

The author JSON object contains biographical and bibliographic information:

```json
{
  "name": "J.R.R. Tolkien",
  "personal_name": "John Ronald Reuel Tolkien",
  "birth_date": "1892",
  "death_date": "1973",
  "bio": "British author and philologist, best known for The Lord of the Rings",
  "alternate_names": [
    "John Tolkien",
    "J. R. R. Tolkien",
    "John Ronald Reuel Tolkien"
  ],
  "photos": [6144381, 6144382]
}
```

### Author Fields

| Field | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| `name` | String | Yes | "J.R.R. Tolkien" | Display name |
| `personal_name` | String | No | "John Ronald Reuel Tolkien" | Full legal name |
| `birth_date` | String | No | "1892" | Year, may be incomplete |
| `death_date` | String | No | "1973" | Year, may be incomplete |
| `bio` | String or Object | No | "British author..." | Biographical text, see below |
| `alternate_names` | Array | No | ["John Tolkien"] | Name variants |
| `photos` | Array of Numbers | No | [6144381] | Photo IDs for image lookup |

#### Bio Field Variation

The `bio` field can appear in two formats:

**As a string (most common)**:
```json
{"bio": "British author and philologist..."}
```

**As an object with type and value**:
```json
{"bio": {"type": "/type/text", "value": "British author..."}}
```

Echo Alexandria normalizes both formats to extract the text value.

#### Photo IDs

Photo IDs reference OpenLibrary's image hosting:
- Use format: `https://covers.openlibrary.org/a/id/{photo_id}-S.jpg`
- Multiple photos indicate multiple images available
- IDs are stable and don't change

## Work JSON Structure

Work records contain intellectual property information:

```json
{
  "title": "The Lord of the Rings",
  "description": "An epic high-fantasy novel",
  "subjects": [
    "Fantasy",
    "Adventure",
    "Middle-earth"
  ],
  "author_keys": ["/authors/OL23919A"],
  "first_publish_date": "1954",
  "covers": [4234543, 4234544]
}
```

### Work Fields

| Field | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| `title` | String | Yes | "The Lord of the Rings" | Work title |
| `description` | String | No | "An epic fantasy..." | Plot summary |
| `subjects` | Array of Strings | No | ["Fantasy"] | Subject classifications |
| `author_keys` | Array of Strings | Yes | ["/authors/OL23919A"] | References to authors |
| `first_publish_date` | String | No | "1954" | Year of first publication |
| `covers` | Array of Numbers | No | [4234543] | Cover art IDs |
| `isbn` | String or Array | No | "978-0544003415" | ISBN identifiers |
| `languages` | Array of Strings | No | ["eng"] | ISO 639 language codes |

#### Author Keys in Works

The `author_keys` array contains references to author records:

```json
{
  "author_keys": [
    "/authors/OL23919A",
    "/authors/OL2817612A"
  ]
}
```

- Always an array (may be empty)
- References authors using their full OpenLibrary key
- Used to join works to author records in the database
- Some works may have no author key (rare)

#### Subject Classifications

Subjects provide categorization:

```json
{
  "subjects": [
    "Fantasy fiction",
    "Heroic fantasy",
    "Adventure fiction",
    "Good and evil"
  ]
}
```

- Multi-level hierarchies possible
- Can have hundreds of subjects per work
- Useful for discovery and faceting
- Based on Library of Congress Subject Headings (LCSH)

## Edition JSON Structure

Edition records contain publication-specific information:

```json
{
  "title": "The Lord of the Rings",
  "work_keys": ["/works/OL45804W"],
  "author_keys": ["/authors/OL23919A"],
  "isbn_10": "0544003411",
  "isbn_13": "978-0544003415",
  "publishers": ["Houghton Mifflin Harcourt"],
  "publish_date": "2012-09-18",
  "number_of_pages": 1178,
  "covers": [4234543],
  "languages": ["eng"],
  "physical_format": "Hardcover",
  "edition_name": "Complete and Unabridged"
}
```

### Edition Fields

| Field | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| `title` | String | Yes | "The Lord of the Rings" | Edition title |
| `work_keys` | Array of Strings | Yes | ["/works/OL45804W"] | Parent work(s) |
| `author_keys` | Array of Strings | No | ["/authors/OL23919A"] | Denormalized author refs |
| `isbn_10` | String | No | "0544003411" | 10-digit ISBN |
| `isbn_13` | String | No | "978-0544003415" | 13-digit ISBN |
| `publishers` | Array of Strings | No | ["Houghton Mifflin"] | Publisher names |
| `publish_date` | String | No | "2012-09-18" | Publication date |
| `number_of_pages` | Integer | No | 1178 | Page count |
| `covers` | Array of Numbers | No | [4234543] | Cover art IDs |
| `languages` | Array of Strings | No | ["eng"] | Language codes |
| `physical_format` | String | No | "Hardcover" | Binding type |
| `edition_name` | String | No | "Complete" | Edition description |

#### ISBN Fields

Both ISBN-10 and ISBN-13 may be present:

```json
{
  "isbn_10": "0544003411",
  "isbn_13": "978-0544003415"
}
```

- ISBN-13 is preferred for modern lookups
- ISBN-10 is legacy but still useful
- May be arrays with multiple values (rare)
- Some editions lack ISBN entirely (especially older books)

#### Work Keys

The `work_keys` array references parent works:

```json
{
  "work_keys": ["/works/OL45804W"]
}
```

- Usually has one work per edition
- Occasionally multiple (omnibus editions)
- Critical for joining editions to works
- Required field for proper data model

## Field Variations and Special Cases

### Null and Missing Fields

Optional fields may be:
- Completely absent from the JSON object
- Present with `null` value
- Present with empty array value `[]`

```json
// All of these are valid
{"name": "Author One"}
{"name": "Author One", "bio": null}
{"name": "Author One", "alternate_names": []}
```

Echo Alexandria treats all three cases equivalently.

### Array Fields

Array fields can contain:
- Zero elements (empty array)
- One element (single author, single publisher, etc.)
- Multiple elements

```json
{
  "author_keys": [],              // No authors (rare)
  "alternate_names": ["John"],    // Single name
  "subjects": ["A", "B", "C"]    // Multiple values
}
```

### Date Format Variations

Dates are inconsistently formatted:

```json
{
  "birth_date": "1892",           // Year only (most common)
  "birth_date": "1892-06-15",     // ISO 8601 date
  "publish_date": "September 1954" // Text format
}
```

These are normalized to standard formats during import.

### Text Object Format

Some text fields use wrapped objects:

```json
// Standard
{"bio": "Biography text"}

// Wrapped format
{"bio": {"type": "/type/text", "value": "Biography text"}}
```

Both formats are parsed to extract the actual text value.

## Parsing Considerations

### Malformed Lines

Occasionally dumps contain problematic lines:

1. **Invalid JSON in 5th column**
   - Lines are skipped with warning logged
   - Rare in official OpenLibrary dumps

2. **Wrong number of columns**
   - Lines with extra tabs: extra data is part of JSON
   - Lines with missing columns: entire line is skipped

3. **Non-UTF-8 characters**
   - Handled with UTF-8 fallback/replacement
   - Logged for investigation

Echo Alexandria logs all parsing errors with line numbers for manual verification.

### Line Endings

Dumps may use different line endings depending on export system:
- Unix: `\n` (line feed)
- Legacy: `\r\n` (carriage return + line feed)

The import parser handles both automatically.

## Practical Examples

### Complete Author Record

```
/type/author	/authors/OL23919A	42	2023-12-15T10:30:45.123456	{"name":"J.R.R. Tolkien","personal_name":"John Ronald Reuel Tolkien","birth_date":"1892","death_date":"1973","bio":"British author, poet, philologist, and university professor who is best known for his high fantasy novels The Hobbit and The Lord of the Rings.","alternate_names":["John Ronald Reuel Tolkien","J. R. R. Tolkien"],"photos":[6144381,6144382]}
```

### Complete Work Record

```
/type/work	/works/OL45804W	8	2023-11-20T14:15:30.654321	{"title":"The Lord of the Rings","description":"An epic high-fantasy novel written by English author and scholar J. R. R. Tolkien.","subjects":["Fantasy fiction","Heroic fantasy","Middle-earth"],"author_keys":["/authors/OL23919A"],"first_publish_date":"1954","covers":[4234543],"isbn":"978-0544003415"}
```

### Complete Edition Record

```
/type/edition	/books/OL7353617M	15	2023-10-05T08:22:15.987654	{"title":"The Lord of the Rings","work_keys":["/works/OL45804W"],"author_keys":["/authors/OL23919A"],"isbn_10":"0544003411","isbn_13":"978-0544003415","publishers":["Houghton Mifflin Harcourt"],"publish_date":"2012","number_of_pages":1178,"covers":[4234543],"languages":["eng"],"physical_format":"Hardcover"}
```

## Schema Evolution

The JSON schema is not versioned, but does evolve:

- **New fields** are regularly added to author/work/edition objects
- **Backward compatibility** is generally maintained
- **Field removals** are rare
- **Field renames** have not occurred

Echo Alexandria's approach:
1. Ignores unknown fields
2. Handles missing optional fields gracefully
3. Validates required fields are present
4. Logs warnings for unexpected field types

This ensures imports remain stable even as OpenLibrary's schema evolves.

## Related Documentation

- [Data Dumps](./data-dumps.md) - Where to find and download dumps
- [Entity Relationships](./relationships.md) - How entities reference each other
- [Update Schedule](./update-schedule.md) - How frequently to refresh imports
