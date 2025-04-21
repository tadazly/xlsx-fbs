# 🧾 xlsx-fbs / x2f - Excel To FlatBuffers

**xlsx-fbs**（a.k.a. `x2f`）是一个将 Excel 表格批量转换为 [FlatBuffers](https://flatbuffers.dev/) 的命令行工具，支持生成 结构定义 `.fbs` 、表数据`.json` 、 FlatBuffers 二进制 `.bin` 和 多语言数据类（如 `.ts`、`.cs`、`.h` 等）。适用于客户端/服务端通用表格打包场景，支持自定义字段属性、嵌套结构、敏感字段过滤、批量转换等高级玩法。

> 🇨🇳 [完整文档](./README.original.md) | 🇺🇸 [English Documentation](./README.en.md)

![License](https://img.shields.io/github/license/tadazly/xlsx-fbs)
![Node](https://img.shields.io/badge/node-%3E=22.12.0-green)
![FlatBuffers](https://img.shields.io/badge/flatbuffers-supported-blue)
<!-- ![npm](https://img.shields.io/npm/v/xlsx-fbs) -->

### 🧬 FlatBuffers 类型支持

配表支持类型如下：

- [标量（Scalars）](./README.original.md#标量-scalars)
- [向量（Vectors）](./README.original.md#向量-vectors)
- [字符串（Strings）](./README.original.md#字符串-strings)
- [结构体（Structs）](./README.original.md#结构体-structs)
- [结构表/子表（Tables）](./README.original.md#结构表子表-tables)
- [枚举（Enums）](./README.original.md#枚举-enums)

完整文档包含一个简单的 [Unity Example](./README.original.md#unity-loader-用法)。

## 安装 xlsx-fbs 

0. 克隆本项目

    ```shell
    git clone https://github.com/tadazly/xlsx-fbs.git
    cd xlsx-fbs
    ```

1. 初始化项目（跑个 npm install，仪式感不能少）

    ```shell
    npm install
    ```

2. 链接全局指令（让终端认识你这个新朋友）

    ```shell
    npm link
    ```

3. 测试一下，查看帮助信息（假装你会用）

    ```shell
    xlsx-fbs -h     # 默认命令
    x2f -h          # 简写命令
    ```

- 想退出这段关系？删掉全局链接即可：

    ```shell
    npm unlink -g
    ```

## 快速上手：三分钟带你打出第一张表

项目内的 `example/` 文件夹就是你的 playground。

```
example/
├── singleConvert/       # 打单张表示例
│   └── item.xlsx/        
└── batchConvert/        # 批量打表示例
    ├── 任意目录/           
    └── $tables.xlsx     # 索引表（可选，但建议有）
```

### 🎯 单张打表

```shell
cd example/singleConvert
x2f item.xlsx --cpp --rust
```

### 🎯 批量打表

```shell
cd example/batchConvert
x2f --ts --csharp
```

💡 存在 `$tables.xlsx` 时，只打你配置的表； 🧪 没有它？默认全打。可以自己试试删掉再跑一遍，看会不会变得“更刺激”。


## 说明书：不会用是你的事，我的文档没问题

### 一、 创建符合规范的 Excel

#### 示例结构，完整规范请看[配表规范](./README.original.md#数据表-配表规范)

**item.xls:**

- **数据页（item）**：字段名写在第一行，顺序可乱，别名要对。

    A|B|C|D|E
    -|-|-|-|-
    道具id|道具名|描述|最大数|每日上限
    101|豆子|交易东西的基础货币|99999999|100000
    102|钻石|交易稀有物品的货币|99999999|
    1001|HP药|有了他你就能随便浪|9999|99

- **属性页（property）**：结构定义 + 行为规则所在。

    A - **字段名**，B - **变量名**，C - **类型**，D - **默认值**（可省略），E - **属性**（可省略）。

    A|B|C|D|E|F
    -|-|-|-|-|-
    道具id|id|int|||一些功能注释
    道具名|name|string||required|
    描述|desc|string|||
    策划偷偷删掉的|wtf|uint||deprecated|字段就算不用了也最好保留，手动标记废弃
    最大数|max|number|9999||玩家可以拥有的最大数量
    每日上限|dailyLimit|number|||每天最多获得数量限制

    > 字段类型自动识别 number 的具体类型，但别乱用，64-bit 会让你哭。

- 生成的 .fbs 文件

    ```
    // item.xlsx

    namespace Xlsx;

    table ItemInfo {
      /// 道具id
      id:int;
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

    > ⚠️ 自动转为 snake_case 命名，最终代码按语言规范生成。

### 二、 使用 `xlsx-fbs` 转换

```shell
xlsx-fbs [ input ] [ flatc options ] [ xlsx-fbs options ]
```

#### input 输入路径

- 文件：转换单张表

- 文件夹：递归转换所有表

- 不传：默认转当前目录下所有表

#### flatc 编译选项

参考 [FlatBuffers 文档](https://flatbuffers.dev/flatc/)，常见的：

- `--cpp --csharp --ts --java --rust`

#### xlsx-fbs 自定义选项

参数|用途
-|-
`-o, --output <path>` | 输出路径，默认 `output/`
`-n, --namespace <name>` | 命名空间，默认 `Xlsx`
`-k, --default-key <field>` | 若表中未配置 key 属性，使用传入的字段作为 key 属性
`--binary-extension <ext>` | 输出二进制的后缀，默认 `bin`
`--censored-fields <fields>` | 删除字段，生成删减版
`--censored-output <path>` | 自定义删减版输出路径，默认`${output}_censored/`
`--output-bin <path>` * | 拷贝输出的 bin 到指定路径
`--output-csharp <path>` * | 拷贝输出的代码到指定路径，以 C# 为例
`--censored-output-bin <path>` * | 拷贝删减版 bin 到指定路径
`--censored-output-csharp <path>` * | 拷贝删减版代码到指定路径，以 C# 为例
`--clean-output` * | 批量打表前，清空输出目录，慎用。
`--empty-string` | string 用空串代替 null
`--disable-merge-table` * | 禁用索引表中的 `merge` 功能
`--disable-incremental` * | 禁用增量打表
`--enable-streaming-read` | 开启流式读取，慎用！乱码预警
`--data-class-suffix <suffix>` | 表格数据类名后缀，默认 `Info`
`--generate-fbs-hash` *| 生成 fbs 结构校验
`--multi-thread <number>` | 多线程数量，默认 6
`--minimal-info <level>` | 控制输出日志等级，默认 `info`
`--allow-wild-table` * | 允许打野表（索引表中未配置的表）
`--property-order <order>` | [属性页顺序](#属性页的默认值)自定义，默认 `ABCDE`
`--js`/`--js-sourcemap` | 输出 JS 代码及映射
`--js-exclude-flatbuffers` | 排除 flatbuffers 代码
`--js-browser-target/ <target>` | [JS 编译目标](https://esbuild.github.io/api/#target)，默认 `es2017`
`--js-node-target <target>` | Node 编译目标，默认 `node20`。

> 标记 * 的仅批量打表生效

#### 属性页的默认值：
>    - A: 数据页的字段名（可随意填写，和属性页做映射关系，并作为生成的 .fbs 中的字段名注释）
>    - B: 字段对应的变量名（对应 .fbs 中的 field，和代码中的成员字段名）
>    - C: 字段对应的类型（`short`, `int`, `string` ... 等）
>    - D: 字段的默认值 （对应 .fbs 中的默认值）
>    - E: 字段的属性 （对应 .fbs 中的 Attribute）

#### 示例

```
# 单表
x2f item.xlsx --ts -n xls -o ./output

# 批量
x2f ./example/batchConvert --csharp -n CustomData -k id -o ./all --censored-output ./censored
```

### 三、输出目录结构


```
output[_censored]/
├── fbs/         # .fbs 文件
├── bin/         # 二进制文件
├── scripts/     # 各语言代码
│   ├── cpp/
│   ├── csharp/
│   └── ts/
└── json/        # JSON 文件（由 bin 转）
```

## 附录

### 数据表命名规范

- 文件名用英文小驼峰，不要 Emoji（我真的要说这个吗）

- 表名就是类名，所以别整些 C++ 关键字出来

### 属性页注意事项

- 字段顺序 = .fbs 字段顺序，不能随便改！

- 字段名也别使用 关键字，且不能用 `add` 开头！

- 新增字段只能加在最后一行（历史的惯性）

- 想删除字段？请标记 `deprecated`，别直接删。

- 改了字段名？记得同步改代码。

- 改类型/默认值？自己承担后果。

### 支持类型（标量、向量、结构、子表、枚举）

字段的 **类型**（ C 列），最好填写 *明确的类型*，如：

- 字符串：`string`

- 标量：如 `byte`，`short`，`int`，下面给出具体的表格：

    大小|有符号|无符号|浮点数
    -|-|-|-
    8-bit|byte, bool|ubyte (uint8)|
    16-bit|short (int16)|ushort (uint16)|
    32-bit|int (int32)|uint (uint32)|float (float32)
    64-bit|long (int64)|ulong (uint64)|double (float64)

    不要轻易碰 64-bit 类型，除非你想让数据爆炸。

- 枚举：使用 `enum@EnumName` 作为类型名称，**必须配置 默认值**。

- 结构体：使用 `struct@StructName` 作为类型名称，用 `{ key: value, key: [value] … }` 这种 json 结构来填写数据，填写时必须按照结构定义，**完整填写数据**。

- 结构表：使用 `table@SubTableName` 作为类型名称，配法和和上面的数据页、属性页规范一致，在数据页中填写结构表中的索引 id。

- 向量：任何以上类型的向量（用 `[type]` 表示），向量中元素的数量任意。


> #### 关于类型推导
>
> 对于字段的值是 **数值**，当使用 *不明确的类型* `number` 时，由程序判断 **标量** 类型。枚举、结构体 **不支持**自动类型推导。
>

#### uint64/int64 精度问题

在表格中使用文本格式存储大数字，如 9007199254740993。

#### 默认值

字段的 **默认值**（ D 列），如果不填，默认标量类型是 `0`，其他类型是 `null`。

**重要：** 只有 **标量** 和 **枚举** 能设置默认值，你猜是为什么。

### 属性

字段的 **属性**（ E 列），请参考[FlatBuffers文档](https://flatbuffers.dev/schema/#attributes)，如果填了会补充在 .fbs 文件中字段的右边，一般用的上的就 `deprecated` 和 `required`。常见的如下：

属性|用途
-|-
deprecated|废弃字段
required|必填字段，非标量使用，没有数据就报错
key|向量中排序和查找的关键字字段
id|自定义字段编号（用于版本兼容）
force_align|强制对齐
bit_flags|枚举值可组合

### 索引表 $tables.xlsx 配置项

字段名|说明
-|-
**tableName** | 表名（不填就不打）
**merge** | 是否合并到大表`mergeTable`，方便预加载
**censoredTable** | 敏感表（不输出删减版）
**censoredFields** | 敏感字段（只删字段）
**constFields** | 导出常量类（支持 TS / C#）

> 没配 `$tables.xlsx`？那就全打，祝你好运。


## 依赖库

### 环境要求

- Node.js >= 22.12.0, 推荐配合 [VOLTA](https://docs.volta.sh/guide/getting-started) 使用。

- FlatBuffers CLR 工具 `flatc`

> 项目里带的编译工具跑不动？自己去 [FlatBuffers Releases](https://github.com/google/flatbuffers/releases) 下载，放到 `bin` 文件夹。

### 核心依赖

- [chalk](https://www.npmjs.com/package/chalk): 终端搞颜色。

- [commander](https://www.npmjs.com/package/commander): 命令行语法糖。

- [esbuild](https://github.com/evanw/esbuild): ts编译加打包。

- [ExcelJS](https://www.npmjs.com/package/exceljs): 负责流式处理表格数据（仅支持.xlsx）。

- [p-limit](https://www.npmjs.com/package/p-limit): 限制并发。

- [ts-morph](https://www.npmjs.com/package/ts-morph): 读取ts文件。

- [xlsx](https://www.npmjs.com/package/xlsx): 一口气吃完内存的表格砖家。

---

> 文档写完了，但你要是不看，那就没人能救你。
