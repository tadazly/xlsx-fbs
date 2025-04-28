# 🧾 xlsx-fbs / x2f - Excel To FlatBuffers

**xlsx-fbs** (a.k.a. `x2f`) is a command-line tool that converts Excel spreadsheets to [FlatBuffers](https://flatbuffers.dev/), supporting generation of structure definitions `.fbs`, table data `.json`, FlatBuffers binary `.bin`, and multi-language data classes (such as `.ts`, `.cs`, `.h`, etc.). Suitable for client/server common table packaging scenarios, supporting advanced features like custom field attributes, nested structures, sensitive field filtering, and batch conversion.

> 🇺🇸 [Full Documentation](https://tadazly.github.io/x2f-docs/en/docs/intro)

[![License](https://img.shields.io/github/license/tadazly/xlsx-fbs)](https://github.com/tadazly/xlsx-fbs/blob/master/LICENSE)
![Node](https://img.shields.io/badge/node-%3E=22.12.0-green)
[![FlatBuffers](https://img.shields.io/badge/flatbuffers-v25.2.10-blue)](https://flatbuffers.dev/)
<!-- ![npm](https://img.shields.io/npm/v/xlsx-fbs) -->

### 🧬 FlatBuffers Type Support

The following types are supported in table configuration:

- [Scalars](https://tadazly.github.io/x2f-docs/en/docs/tutorial/field_types#%E6%A0%87%E9%87%8F-scalars)
- [Vectors](https://tadazly.github.io/x2f-docs/en/docs/tutorial/field_types#%E5%90%91%E9%87%8F-vectors)
- [Strings](https://tadazly.github.io/x2f-docs/en/docs/tutorial/field_types#%E5%AD%97%E7%AC%A6%E4%B8%B2-strings)
- [Structs](https://tadazly.github.io/x2f-docs/en/docs/tutorial/field_types#%E7%BB%93%E6%9E%84%E4%BD%93-structs)
- [Tables](https://tadazly.github.io/x2f-docs/en/docs/tutorial/field_types#%E7%BB%93%E6%9E%84%E8%A1%A8%E5%AD%90%E8%A1%A8-tables)
- [Enums](https://tadazly.github.io/x2f-docs/en/docs/tutorial/field_types#%E6%9E%9A%E4%B8%BE-enums)
- [Fixed Arrays](https://tadazly.github.io/x2f-docs/en/docs/tutorial/field_types#%E7%BB%93%E6%9E%84%E4%BD%93-structs) - Only available in structs

The documentation includes a simple [Unity Example](https://tadazly.github.io/x2f-docs/en/docs/tutorial/unity_example).

## Installing xlsx-fbs

0. Clone this project

    ```shell
    git clone https://github.com/tadazly/xlsx-fbs.git
    cd xlsx-fbs
    ```

1. Initialize the project (run npm install, can't skip the ceremony)

    ```shell
    npm install
    ```

2. Link global command (let your terminal meet this new friend)

    ```shell
    npm link
    ```

3. Test it out, check the help info (pretend you know how to use it)

    ```shell
    xlsx-fbs -h     # default command
    x2f -h          # shorthand command
    ```

- Want to end this relationship? Just remove the global link:

    ```shell
    npm unlink -g
    ```

## Quick Start: Three Minutes to Your First Table

The `example/` folder in the project is your playground.

```
example/
├── singleConvert/       # Single table conversion example
│   └── itemTable.xlsx/        
└── batchConvert/        # Batch conversion example
    ├── any directory/           
    └── $tables.xlsx     # Index table (optional, but recommended)
```

### 🎯 Single Table Conversion

```shell
cd example/singleConvert
x2f itemTable.xlsx --cpp --rust
```

### 🎯 Batch Conversion

```shell
cd example/batchConvert
x2f --ts --csharp
```

💡 When `$tables.xlsx` exists, only configured tables will be processed; 🧪 Without it? Everything gets processed. Try deleting it and running again to see if it gets "more exciting".

## Manual

### I. Create Excel Files Following the Specification

#### Example Structure (See [Table Configuration Specification](./README.original.md#数据表-配表规范) for complete rules)

**item.xls:**

- **Data Sheet (item)**: Field names in first row, order can be random, aliases must match.

    A|B|C|D|E
    -|-|-|-|-
    Item ID|Item Name|Description|Max Count|Daily Limit
    101|Bean|Basic currency for trading|99999999|100000
    102|Diamond|Currency for rare items|99999999|
    1001|HP Potion|With this you can be reckless|9999|99

- **Property Sheet (property)**: Structure definition + behavior rules.

    A - **Field Name**, B - **Variable Name**, C - **Type**, D - **Default Value** (optional), E - **Attributes** (optional).

    A|B|C|D|E|F
    -|-|-|-|-|-
    Item ID|id|int|||Some functional comments
    Item Name|name|string||required|
    Description|desc|string|||
    Secretly Deleted|wtf|uint||deprecated|Fields should be marked deprecated rather than deleted
    Max Count|max|number|9999||Maximum count a player can own
    Daily Limit|dailyLimit|number|||Daily acquisition limit

    > Field types automatically determine number types, but be careful, 64-bit will make you cry.

- Generated .fbs file

    ```
    // item.xlsx

    namespace Xlsx;

    table ItemInfo {
      /// Item ID
      id:int;
      /// Item Name
      name:string (required);
      /// Description
      desc:string;
      /// Secretly Deleted
      wtf:uint (deprecated);
      /// Max Count
      max:uint = 9999;
      /// Daily Limit
      daily_limit:uint;
    }

    table Item {
      item_infos:[ItemInfo];
    }

    root_type Item;
    ```

    > ⚠️ Automatically converted to snake_case naming, final code generated according to language conventions.

### II. Using `xlsx-fbs` for Conversion

```shell
xlsx-fbs [ input ] [ flatc options ] [ xlsx-fbs options ]
```

#### input path

- File: Convert single table

- Directory: Recursively convert all tables

- Not provided: Default converts all tables in current directory

#### flatc compilation options

Refer to [FlatBuffers Documentation](https://flatbuffers.dev/flatc/), common ones:

- `--cpp --csharp --ts --java --rust`

#### xlsx-fbs custom options

Parameter|Purpose
-|-
`-o, --output <path>` | Output path, default `output/`
`-n, --namespace <name>` | Namespace, default `Xlsx`
`-k, --default-key <field>` | If key attribute not configured in table, use provided field as key attribute
`--binary-extension <ext>` | Binary output extension, default `bin`
`--censored-fields <fields>` | Delete fields, generate censored version
`--censored-output <path>` | Custom censored version output path, default `${output}_censored/`
`--output-bin <path>` * | Copy output bin to specified path
`--output-csharp <path>` * | Copy output code to specified path, using C# as example
`--censored-output-bin <path>` * | Copy censored bin to specified path
`--censored-output-csharp <path>` * | Copy censored code to specified path, using C# as example
`--clean-output` * | Clear output directory before batch processing, use with caution
`--empty-string` | Use empty string instead of null for strings
`--disable-merge-table` * | Disable `merge` functionality in index table
`--disable-incremental` * | Disable incremental table processing
`--enable-streaming-read` | Enable streaming read, use with caution! Warning: may cause garbled text
`--table-class-suffix <suffix>` | Table class name suffix, default empty string `""`
`--data-class-suffix <suffix>` | Table data class name suffix, default `Info`
`--multi-thread <number>` | Number of threads, default 6
`--minimal-info <level>` | Control output log level, default `info`
`--allow-wild-table` * | Allow processing tables not configured in index table
`--property-order <order>` | Custom [property sheet order](#property-sheet-default-values), default `ABCDE`
`--csharp-unity-loader` | Generate Unity code
`--csharp-unity-loader-suffix <suffix>` | Unity class name suffix, default `Table`
`--js`/`--js-sourcemap` | Output JS code and sourcemap
`--js-exclude-flatbuffers` | Exclude flatbuffers code
`--js-browser-target/ <target>` | [JS compilation target](https://esbuild.github.io/api/#target), default `es2017`
`--js-node-target <target>` | Node compilation target, default `node20`

> Marked * only effective for batch processing

#### Property Sheet Default Values:
>    - A: Data sheet field name (can be freely filled, maps to property sheet, used as field name comments in generated .fbs)
>    - B: Field variable name (corresponds to .fbs field and code member field name)
>    - C: Field type (`short`, `int`, `string` ... etc.)
>    - D: Field default value (corresponds to .fbs default value)
>    - E: Field attributes (corresponds to .fbs Attributes)

#### Examples

```
# Single table
x2f item.xlsx --ts -n xls -o ./output

# Batch
x2f ./example/batchConvert --csharp -n CustomData -k id -o ./all --censored-output ./censored
```

### III. Output Directory Structure

```
output[_censored]/
├── fbs/         # .fbs files
├── bin/         # Binary files
├── scripts/     # Language-specific code
│   ├── cpp/
│   ├── csharp/
│   └── ts/
└── json/        # JSON files (converted from bin)
```

## Appendix

### Table Naming Conventions

- Use English camelCase for filenames, no Emojis (do I really need to say this?)

- Table name is the class name, so avoid C++ keywords

### Property Sheet Notes

- Field order = .fbs field order, cannot be changed arbitrarily!

- Don't use keywords for field names, and don't start with `add`!

- New fields can only be added at the last row (historical inertia)

- Want to delete a field? Mark it as `deprecated`, don't delete directly.

- Changed a field name? Remember to update the code accordingly.

- Changed type/default value? You're on your own.

### Supported Types (Scalars, Vectors, Structs, Tables, Enums)

For field **types** (Column C), it's best to use *explicit types*, such as:

- Strings: `string`

- Scalars: like `byte`, `short`, `int`, see table below:

    Size|Signed|Unsigned|Floating Point
    -|-|-|-
    8-bit|byte, bool|ubyte (uint8)|
    16-bit|short (int16)|ushort (uint16)|
    32-bit|int (int32)|uint (uint32)|float (float32)
    64-bit|long (int64)|ulong (uint64)|double (float64)

    Don't touch 64-bit types unless you want your data to explode.

- Enums: Use `enum@EnumName` as type name, **must configure default value**.

- Structs: Use `struct@StructName` as type name, use `{ key: value, key: [value] … }` JSON structure for data, must fill complete data according to structure definition.

- Tables: Use `table@SubTableName` as type name, follow same rules as data sheet and property sheet above, fill index id in data sheet.

- Vectors: Vector of any above type (use `[type]` notation), any number of elements in vector.

> #### About Type Inference
>
> For fields with **numeric** values, when using *ambiguous type* `number`, program determines **scalar** type. Enums and structs **do not support** automatic type inference.
>

#### uint64/int64 Precision Issues

Store large numbers in text format in tables, like 9007199254740993.

#### Default Values

Field **default values** (Column D), if not filled, scalar types default to `0`, other types to `null`.

**Important:** Only **scalars** and **enums** can have default values, guess why.

### Attributes

Field **attributes** (Column E), refer to [FlatBuffers Documentation](https://flatbuffers.dev/schema/#attributes), if filled will be added to .fbs file field right side, commonly used ones are `deprecated` and `required`. Common ones:

Attribute|Purpose
-|-
deprecated|Deprecated field
required|Required field, used for non-scalars, errors if no data
key|Key field for sorting and finding in vectors
id|Custom field number (for version compatibility)
force_align|Force alignment
bit_flags|Enum values can be combined

### Index Table $tables.xlsx Configuration

Field Name|Description
-|-
**tableName** | Table name (not processed if empty)
**merge** | Whether to merge into large table `mergeTable` for preloading
**censoredTable** | Sensitive table (no censored version output)
**censoredFields** | Sensitive fields (only delete fields)
**constFields** | Export constant class (supports TS / C#)

> No `$tables.xlsx`? Then everything gets processed, good luck.

## Dependencies

### Environment Requirements

- Node.js >= 22.12.0, recommended to use with [VOLTA](https://docs.volta.sh/guide/getting-started).

- FlatBuffers v25.2.10 tool `flatc`

> Can't run the compilation tools in the project? Download from [FlatBuffers Releases](https://github.com/google/flatbuffers/releases) and put in `bin` folder.

### Core Dependencies

- [chalk](https://www.npmjs.com/package/chalk): Terminal colors.

- [commander](https://www.npmjs.com/package/commander): Command line syntax sugar.

- [esbuild](https://github.com/evanw/esbuild): ts compilation and bundling.

- [ExcelJS](https://www.npmjs.com/package/exceljs): Handles streaming table data processing (only supports .xlsx).

- [p-limit](https://www.npmjs.com/package/p-limit): Concurrency limiting.

- [ts-morph](https://www.npmjs.com/package/ts-morph): ts file reading.

- [xlsx](https://www.npmjs.com/package/xlsx): Memory-guzzling table expert.

---
