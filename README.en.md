# 🧾 xlsx-fbs / x2f - Excel To FlatBuffers

xlsx-fbs (a.k.a. x2f) is a command-line tool for batch converting Excel spreadsheets into FlatBuffers assets. It generates .fbs schema definitions, .json table data, FlatBuffers binary .bin files, and multi-language data classes (such as .ts, .cs, .h, etc.).

Designed for shared client/server table serialization workflows, it supports advanced features like custom field attributes, nested structures, sensitive field filtering, and bulk conversion.

## Installing xlsx-fbs

0. Clone the project (yes, the obvious step)

```shell
git clone https://github.com/tadazly/xlsx-fbs.git
cd xlsx-fbs
```

1. Initialize the project (npm install for good luck)

```shell
npm install
```

2. Link the global command (so your terminal knows it exists)

```shell
npm link
```

3. Test it out, view help info (pretend you know what you’re doing)

```shell
xlsx-fbs -h     # Default command
x2f -h          # Shortcut alias
```

Want out of this relationship? Just unlink:

```shell
npm unlink -g
```

---

## Quick Start: Your First Table in 3 Minutes

The `example/` folder is your playground.

```
example/
├── singleConvert/       # Example of converting one sheet
│   └── item.xlsx        
└── batchConvert/        # Example of batch conversion
    ├── anyFolder/       
    └── $tables.xlsx     # Index file (optional but recommended)
```

### 🎯 Single Table Conversion

```shell
cd example/singleConvert
xlsx-fbs item.xlsx --cpp --rust
```

### 🎯 Batch Table Conversion

```shell
cd example/batchConvert
xlsx-fbs --ts --csharp
```

> 💡 If `$tables.xlsx` exists, only the listed tables will be converted.
> 🧪 Don’t want that? Delete it and try again to witness chaos.

---

## Manual: Because You’ll Pretend You Don’t Need It, Then Come Crawling Back

### 1. Creating a Compliant Excel File

#### Example Structure (Full spec: [Table Rules](#data-table-spec))

**item.xlsx**

- **Data Sheet (`item`)**: First row = field names. Order doesn’t matter, mapping does.

```
ID|Name|Description|Max|DailyLimit
101|Beans|Basic trading currency|99999999|100000
102|Diamonds|Rare item currency|99999999|
1001|HP Potion|Let's you go wild again|9999|99
```

- **Property Sheet (`property`)**: The rules and metadata live here.

```
A        |B     |C      |D    |E        
ID       |id    |int |     |Some note
Name     |name  |string |     |required
Desc     |desc  |string |     |
Removed  |wtf   |uint   |     |deprecated
Max      |max   |number |9999 |
DailyLimit|dailyLimit|number|||
```

> `number` will be inferred to the correct scalar type. Don’t overthink it unless you enjoy suffering.

#### Generated .fbs Example

```fbs
namespace Xlsx;

table ItemInfo {
  /// ID
  id:int;
  /// Name
  name:string (required);
  /// Description
  desc:string;
  /// Removed field
  wtf:uint (deprecated);
  /// Max
  max:uint = 9999;
  /// Daily limit
  daily_limit:uint;
}

table Item {
  item_infos:[ItemInfo];
}

root_type Item;
```

> ⚠️ All field names are converted to snake_case. Code output will follow language conventions.

---

### 2. Using `xlsx-fbs`

```shell
xlsx-fbs [ input ] [ flatc options ] [ xlsx-fbs options ]
```

#### Input Path

- File: convert one Excel
- Folder: recursively convert all tables
- None: convert everything in current folder

#### Flatc Options (passed directly to flatc)

See [FlatBuffers Docs](https://flatbuffers.dev/flatc/) — common ones:
- `--cpp --csharp --ts --java`

#### xlsx-fbs Custom Options

| Option | Description |
|--------|-------------|
| `-o, --output` | Output folder (default: `output/`) |
| `-n, --namespace` | Namespace for generated code (default: `Xlsx`) |
| `-k, --default-key` | Fallback key field |
| `--binary-extension` | File extension for binaries (default: `bin`) |
| `--censored-fields` | Remove fields, generate censored version |
| `--censored-output` | Output path for censored files |
| `--output-bin` * | Copy output bin to specified path |
| `--output-csharp` * | Copy output code to specified path |
| `--censored-output-bin` * | Copy censored bin to specified path |
| `--censored-output-csharp` * | Copy censored code to specified path |
| `--clean-output` * | Clear output folder before writing |
| `--empty-string` | Use empty string instead of null for strings |
| `--disable-merge-table` * | Disable mergeTable generation |
| `--disable-incremental` * | Disable incremental updates |
| `--enable-streaming-read` | Enable streaming read (buggy, enjoy at your risk) |
| `--data-class-suffix` | Suffix for row data class (default: `Info`) |
| `--generate-fbs-hash` * | Generate fbs schema hash table |
| `--multi-thread` | Number of threads (default: 6) |
| `--minimal-info` | Log level: `log < info < warn < error` |
| `--allow-wild-table` * | Include rogue tables not listed in index |
| `--property-order` | Custom column mapping order like `AABDE` |
| `--js` / `--js-sourcemap` | Output JavaScript and source maps |
| `--js-exclude-flatbuffers` | Exclude flatbuffers code from JS |
| `--js-browser-target` / `--js-node-target` | Target environment |

> Marked * are only effective for batch conversion

#### Property Sheet Default Values

> - A: Field name in data sheet 
> - B: Field name in property sheet (fbs schema field name)
> - C: Field type (`short`, `int`, `string` ...)
> - D: Field default value (fbs schema default value)
> - E: Field attribute (fbs schema attribute)

#### Examples

```shell
xlsx-fbs item.xlsx --cpp --csharp -o ./output
xlsx-fbs ./data --ts --csharp -n myNamespace -k id
```

---

### 3. Output Directory Structure

```
output[_censored]/
├── fbs/         # .fbs files
├── bin/         # Binary files
├── scripts/     # Code files by language
│   ├── cpp/
│   ├── csharp/
│   └── ts/
└── json/        # JSON converted from binaries
```

---

## Appendix

### Naming Rules

- Use English, lowerCamelCase for filenames.
- No emojis or symbols. Stop trying to be ✨cute✨.
- Table name = class name. Don't use keywords.

### Property Sheet Notes

- Column order defines field order. Don’t mess with it.
- Field names can’t be keywords, and can’t start with `add`.
- Add new fields only at the bottom.
- Deprecated fields? Mark with `deprecated`, don’t delete.
- Renamed a field? Update your code.
- Changed type or default? You live with the consequences.

---

### Supported Types (Scalar, Vectors, Structs, Subtables, Enums)

| Size  | Signed    | Unsigned  | Floating |
|-------|-----------|-----------|----------|
| 8-bit | byte/bool | ubyte     | -        |
| 16-bit| short     | ushort    | -        |
| 32-bit| int       | uint      | float    |
| 64-bit| long      | ulong     | double   |

> Avoid 64-bit unless you *love* debugging JavaScript number precision issues.

---

### uint64 Precision Issue

Use text format in Excel to store large numbers safely. Don’t blame JavaScript later.

---

### Index File ($tables.xlsx) Structure

| Field Name | Purpose |
|------------|---------|
| tableName | Name of the table (no name = skipped) |
| merge | Merge into large combined table |
| censoredTable | Sensitive table (excluded from censored output) |
| censoredFields | Remove sensitive fields only |
| constFields | Export constants (only TS / C# supported) |

> No `$tables.xlsx`? We’ll convert every table. Your funeral.

---

## Dependencies

### Requirements
- Node.js >= 22.12.0 (consider using [VOLTA](https://docs.volta.sh/))
- FlatBuffers compiler: `flatc`

> Having trouble? Go grab a binary from [FlatBuffers Releases](https://github.com/google/flatbuffers/releases).

### Key Libraries

| Library | Purpose |
|---------|---------|
| chalk | Colored CLI output |
| commander | CLI argument parsing |
| esbuild | TS compilation and bundling |
| ExcelJS | Spreadsheet reading (streaming = unstable) |
| p-limit | Controls concurrency |
| ts-morph | Parses TS files |
| xlsx | Memory-hungry but reliable sheet reader |

---

> You made it to the end. Either you're very curious, very lost, or procrastinating. No judgment. Okay, maybe a little.

