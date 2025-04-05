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
    道具名|name|string|||
    描述|desc|string|||
    策划偷偷删掉的|wtf|uint||deprecated|字段就算不用了也最好保留，手动标记废弃
    最大数|max|number|9999|required|玩家可以拥有的最大数量
    每日上限|dailyLimit|number|||每天最多获得数量限制

- 生成的 .fbs 文件

    ```
    namespace Xlsx;

    table ItemInfo {
    id:short;
    name:string;
    desc:string;
    wtf:uint (deprecated);
    max:uint (required);
    dailyLimit:uint;
    }

    table Item {
    itemList:[ItemInfo];
    }

    root_type Item;
    ```

### 2. 使用 xlsx-fbs 转换

- 转换单张表：

```shell
xlsx-fbs item.xlsx --cpp --csharp [-o /path/to/output]
```

- 批量转换目录下的表：

```shell
xlsx-fbs /path/to/xlsx/files --cpp --csharp [-o /path/to/output]
```

- 参数：

    - 可转换的语言类型参考 flatc。 
    
    - -o 输出路径，可省略，默认输出到当前文件夹内。

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

- 别乱改默认值，一条有用的建议。

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

字段的 **默认值**（ D 列），如果不填，那么标量类型是 `0`，其他类型是 `null`。

#### 属性

字段的 **属性**（ E 列），请参考[官方文档](https://flatbuffers.dev/schema/#attributes)，如果填了会补充在 .fbs 文件中字段的右边，一般用的上的就 `deprecated` 和 `required`。常见的如下：

属性|用途
-|-
deprecated|废弃字段
required|必填字段，如果没有数据会报错
key|向量中排序和查找的关键字字段
id|自定义字段编号（用于版本兼容）
force_align|强制对齐
bit_flags|枚举值可组合