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

- sheet1: 数据页

    数据页的第一行定义了字段名，与属性页的第一列中定义的字段名对应，顺序可以不同。

    例子：

    道具id|道具名|描述|最大数|每日上限
    -|-|-|-|-
    101|豆子|交易东西的基础货币|99999999|100000
    102|钻石|交易稀有物品的货币|99999999|
    1001|HP药|有了他你就能随便浪|9999|99

- sheet2: 属性页

    属性页的第一列定义 **字段名**，第二列定义了字段的 **变量名**，第三列定义字段的 **类型**。

    道具id|id|number|一些功能注释
    -|-|-|-
    道具名|name|string|
    描述|desc|string|
    最大数|max|number|玩家可以拥有的最大数量
    每日上限|dailyLimit|number|每天最多获得数量限制

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