# xlsx-fbs

Excel 转 [FlatBuffers](https://flatbuffers.dev/) 工具。

批量读取 xlsx 生成 .fbs 文件，并生成指定语言的代码，如 .cs, .h 等。

## 工具依赖

- **flatc**: 请参照文档[自行编译](https://flatbuffers.dev/building/)或者下载编译好的[二进制文件](https://github.com/google/flatbuffers/releases)。

## 安装 xlsx-fbs 

0. 克隆本项目

    ```shell
    git clone https://github.com/tadazly/xlsx-fbs.git
    cd xlsx-fbs
    ```

1. 初始化项目

    ```shell
    npm install
    ```

2. 链接全局`local-https`指令

    ```shell
    npm link
    ```

- 删除链接的全局指令（不想用的时候再用）

    ```shell
    npm unlink -g
    ```

## 如何使用

### 1. 创建符合规范的 Excel

#### 简单示例，完整规范请看[配表规范](#重要配表规范)

item.xls:

- sheet1: 数据页

    数据页的第一行定义了字段名，与属性页的第一列中定义的字段名对应，顺序可以不同。

    例子：

    A|B|C|D|E
    -|-|-|-|-
    道具id|道具名|描述|最大数|每日上限
    101|豆子|交易东西的基础货币|99999999|100000
    102|钻石|交易稀有物品的货币|99999999|
    1001|HP药|有了他你就能随便浪|9999|99

- sheet2: 属性页

    属性页的 A 列定义 **字段名**，B 列定义了字段的 **变量名**，C 列定义字段的 **类型**，D 列定义字段的 **默认值**（可省略），E 列定义字段的 **属性**（可省略），后面几列随你发挥。

    A|B|C|D|E|F
    -|-|-|-|-|-
    道具id|id|number|||一些功能注释
    道具名|name|string||required|
    描述|desc|string|||
    策划偷偷删掉的|wtf|uint||deprecated|字段就算不用了也最好保留，手动标记废弃
    最大数|max|number|9999||玩家可以拥有的最大数量
    每日上限|dailyLimit|number|||每天最多获得数量限制

- 生成的 .fbs 文件

    ```
    // item.xlsx

    namespace Xlsx;

    table ItemInfo {
      /// 道具id
      id:short;
      /// 道具名
      name:string (required);
      /// 描述
      desc:string;
      /// 策划偷偷删掉的
      wtf:uint (deprecated);
      /// 最大数
      max:uint = 9999;
      /// 每日上限
      daily_limit:uint;
    }

    table Item {
      item_infos:[ItemInfo];
    }

    root_type Item;
    ```

    **注意：**.fbs 中的字段名变成了 `snake_case` 命名，这是其规范，最终代码中的字段名会根据代码规范生成对应的格式，比如 ts 中是 `lowerCamelCase` 而 C# 中是 `UpperCamelCase` 。

### 2. 使用 `xlsx-fbs` 转换

```shell
xlsx-fbs [ input ] [ flatc options ] [ xlsx-fbs options ]
```

#### input 选项

Excel 文件路径或 Excel 所在的文件夹路径，传入文件则转换单张表，传入路径则 **递归** 转换文件夹下的所有表，不传默认转换 `xlsx-fbs` 执行路径下的所有表。 

#### flatc 选项

可转换的代码语言和 **flatc** 的完整参数列表请参考 [FlatBuffers 文档](https://flatbuffers.dev/flatc/)，xlsx-fbs 会将参数传递给 **flatc**。以下列举一些常用的：

- `--cpp --csharp --ts --java` 等，生成对应语言的代码。

#### xlsx-fbs 选项

- `-o, --output <path>` 输出路径，默认输出到执行 `xlsx-fbs` 的文件夹下。

- `-n, --namespace <name>` 生成代码的命名空间，默认是 `Xlsx`。

- `-k, --default-key <field>` 默认不使用 key 属性，传入后，若表里没有设置 key 属性的字段，则使用该字段作为 key。

- `--binary-extension <ext>` 输出的二进制文件的后缀名，默认输出 .bin，你爱发疯可以填 .wtf.bytes。

- `--empty-string` 表中字符串类型的字段在创建二进制时默认填充空字符串而不是 null。

- `--generate-json` 通过输出的 FlatBuffer 生成 JSON 文件，用于版本控制对比字段的修改记录。

- `--delete-fbs` 转换后删除生成的 .fbs 文件，建议保留用于版本控制。

- `--property-order` 自定义属性页顺序，默认 ABCDE。可根据实际表格中列的顺序来定义，例如想直接用表格属性页中 A 列的字段名作为变量名，B列已经定义了类型，并且 C 列被注释占用，那就传入 AABDE，顺序与 **字段名->变量名->类型->默认值->属性** 对应即可。

    >    属性页的默认值：
    >    - A: 数据页的字段名（可随意填写，和属性页做映射关系，并作为生成的 .fbs 中的字段名注释）
    >    - B: 字段对应的变量名（对应 .fbs 中的 field，和代码中的成员字段名）
    >    - C: 字段对应的类型（`short`, `int`, `string` ... 等）
    >    - D: 字段的默认值 （对应 .fbs 中的默认值）
    >    - E: 字段的属性 （对应 .fbs 中的 Attribute）

#### 示例

- 转换单张表：

    ```shell
    xlsx-fbs item.xlsx --cpp --csharp [-o /path/to/output]
    ```

- 批量转换目录下的表，使用 **xls** 作为命名空间， 使用 **id** 字段作为二分查找的 key：

    ```shell
    xlsx-fbs /path/to/xlsx/files --csharp --typescript -n xls -k id [-o /path/to/output]
    ```

### 3. 输出文件

输出的目录结构如下：

```
output/
├── fbs/         # 生成的 .fbs 文件
├── bin/         # 生成的二进制文件
├── scripts/     # 生成的代码文件
│   ├── cpp/     # C++ 代码
│   ├── csharp/  # C# 代码
│   └── ts/      # TypeScript 代码
└── json/        # 由二进制文件生成的 json
```

## 重要：配表规范

### 数据页规范

- 数据页没有太多限制，字段的顺序可以与属性页不同，只需要字段名和属性页对应、类型符合规范即可。剩下的就让策划背锅。

- 废弃的字段数据页中可以删除该列。

### 属性页规范

以下规范基于 FlatBuffers [Schema (.fbs) 规则](https://flatbuffers.dev/evolution/#rules)：

- 属性页定义的字段顺序决定了 .fbs 文件中的字段顺序，所以不能随意更改，也不能随意删除！除非你知道自己在做什么😈

- 新增的字段必须添加在属性页中的最后一行，理由同上。

- 废弃的字段不能删除，乖乖在 **属性** 列填上 `deprecated`。

- 字段名和变量名可以改，你得记得把代码也更新了。

- 字段类型尽量别动，改完老数据可能爆炸。

- 别乱改默认值，一条有用的建议。

PS: 如果能保证上线的代码与数据一致，那你应该知道可以做些什么。

#### 类型

字段的 **类型**（ C 列），最好填写 *明确的类型*，如：

- 字符串：`string`

- 标量：如 `byte`，`short`，`int`，下面给出具体的表格：

    大小|有符号|无符号|浮点数
    -|-|-|-
    8-bit|byte, bool|ubyte (uint8)|
    16-bit|short (int16)|ushort (uint16)|
    32-bit|int (int32)|uint (uint32)|float (float32)
    64-bit|long (int64)|ulong (uint64)|double (float64)

    **取值范围**：

    8-bit:
    - byte: -128 ~ 127
    - bool: true / false
    - ubyte: 0 ~ 255

    16-bit:
    - short: -32,768 ~ 32,767
    - ushort: 0 ~ 65,535

    32-bit:
    - int: -2,147,483,648 ~ 2,147,483,647
    - uint: 0 ~ 4,294,967,295
    - float: ±1.5×10^-45 ~ ±3.4×10^38

    64-bit:
    - long: -9,223,372,036,854,775,808 ~ 9,223,372,036,854,775,807
    - ulong: 0 ~ 18,446,744,073,709,551,615
    - double: ±5.0×10^-324 ~ ±1.7×10^308

    尽量不要碰 `long`，除非你想让数据爆炸。

- 向量：任何其他类型的向量（用 `[type]` 表示）。

如果字段的值是 **数值**，也可以用 *不明确的类型* `number`，交给我来判断成具体的 **标量** 类型。

#### 默认值

字段的 **默认值**（ D 列），如果不填，默认标量类型是 `0`，其他类型是 `null`。

**重要：** 只有 **标量** 能设置默认值，你猜是为什么。

#### 属性

字段的 **属性**（ E 列），请参考[官方文档](https://flatbuffers.dev/schema/#attributes)，如果填了会补充在 .fbs 文件中字段的右边，一般用的上的就 `deprecated` 和 `required`。常见的如下：

属性|用途
-|-
deprecated|废弃字段
required|必填字段，非标量使用，没有数据就报错
key|向量中排序和查找的关键字字段
id|自定义字段编号（用于版本兼容）
force_align|强制对齐
bit_flags|枚举值可组合

## 坑点记录

- flatc 参数，如 --allow-non-utf8，--natural-utf8 只在二进制转 json 时有用，--force-empty 更是一点用都没，需要在构造二进制时自己处理该逻辑。

- 使用 flatc 转换 bin 到 json 时，必须设置 --strict-json，否则就爆炸；-o 参数需要放在输入前，二进制文件要放在 -- 后，没有设置 file_indentifier 时，需要传入 --raw-binary。