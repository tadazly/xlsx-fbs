## Unity 示例

### Unity 项目依赖

- [YooAsset 2.3.x](https://www.yooasset.com/): 按照官方教程配置。
- [UniTask](https://github.com/Cysharp/UniTask/releases): 通过 UPM 的形式安装到项目中。
- [FlatBuffers](https://github.com/google/flatbuffers/tree/master/net/FlatBuffers): 把 net/FlatBuffers 文件夹下的 .cs 文件复制到项目中。

### 示例 Unity 项目结构：

```
Asset/
├── HotUpdate/       
│   └── Configs/        
│   │   └── Xls/           # 放置 x2f 生成的二进制     
│   └── Scripts/
│       ├── GameLogic/      # 游戏逻辑
│       └── Xls/           # 放置 x2f 生成的代码
└── Plugins/        
    ├── FlatBuffers/        # 放置 FlatBuffers 库
    └── UniTask/     
```

### 数据规范

- 必须配置 `id` 字段，用于数据索引，且类型为 `int`。

### 打表命令

下列命令以 macOS/Linux/WSL 举例，使用反引号 `\` 作为换行符  
Windows PowerShell 请使用 \` 作为换行符  
CMD 不支持换行符，可以写个 bat 脚本，使用 ^ 换行。

- 增量打表

    ```shell
    x2f ./example/batchConvert \
    -o "/Path/To/Output" \
    --output-bin "/UnityProject/Assets/HotUpdate/Configs/Xls" \ 
    --output-csharp "/UnityProject/Assets/HotUpdate/Scripts" \
    -n Xls \
    --binary-extension bytes \ 
    --data-class-suffix DataInfo \
    --csharp \
    --csharp-unity-loader \
    --csharp-unity-loader-suffix "" \
    --table-class-suffix Table
    ```

- 全量打表

    ```shell
    x2f ./example/batchConvert \
    -o "/Path/To/Output" \
    --output-bin "/UnityProject/Assets/HotUpdate/Configs/Xls" \ 
    --output-csharp "/UnityProject/Assets/HotUpdate/Scripts" \
    -n Xls \
    --binary-extension bytes \ 
    --data-class-suffix DataInfo \
    --csharp \
    --csharp-unity-loader \
    --csharp-unity-loader-suffix "" \
    --table-class-suffix Table \
    --disable-incremental
    ```

> 上面互换了 tableClassSuffix 和 csharpUnityLoaderSuffix 的默认值，让接口代码更清爽。

### 使用 YooAsset 打包二进制

- 创建一个名为 `TablePackage` 的资源包。

AssetBundle Collector:

<img src="./assets/YooAsset_example.png" width="800">

- 开启 `Enable Addressable`
- 使用 `AddressByFileName` 寻址模式

### 示例代码

```csharp
async void Start()
{
    // 使用你自己封装的方法加载 TablePackage
    await AssetLoader.DownloadPackageAsync("TablePackage");

    // 加载单张表表
    await Xls.Item.Instance.LoadAsync();
    await Xls.Module.Instance.LoadAsync();

    // 通过合并表接口加载 $tables.xlsx 中配置了 merge 字段的表
    await Xls.MergeTableLoader.LoadAllAsync();  
    // 这行和上面两行单独加载 item 和 module 是等价的，具体可以看 MergeTableLoader.cs 中的实现

    // 获取单行数据
    var item = Xls.Item.Instance.Get(101);
    Debug.Log(item.HasValue ? item.Value.Name : "Nope");

    Debug.Log($"name: {Xls.Item.Instance.Get(101)?.Name}");
    Debug.Log($"name: {Xls.Item.Instance.Get(1)?.Name}");

    // 获取所有数据
    var items = Xls.Item.Instance.GetAll();
    foreach (var itemDataInfo in items)
    {
        Debug.Log($"id: {itemDataInfo.Id} name: {itemDataInfo.Name}");
    }

    // 获取常量定义指向的数据
    if (Xls.Module.Instance.TryGet(Xls.ModuleConst.CHAT_PANEL, out var module))
    {
        Debug.Log(module.Name);
    }
    else
    {
        Debug.LogError("Cant find chat panel");
    }

    await Xls.Domain.Instance.LoadAsync();
    // 暴露 FlatBuffers 的 Root，用于直接调用 Root 对象的接口
    var google = Xls.Domain.Instance.Root.DomainDataInfosByKey("google");
    Debug.Log(google.HasValue ? google.Value.Ip + google.Value.Port : "Nope");
}
```

### 严格校验标识 STRICT_VERIFICATION

- 设置 `STRICT_VERIFICATION` 时，会在 `LoadAsync/LoadAllAsync` 时严格校验 file_identifier ，不匹配时会抛出异常，否则只会在控制台打印错误。

### 关于 Assembly Definition References

- 可以为 `FlatBuffers` 和 `Xls` 创建 asmdef 文件，并在你的项目中添加 `FlatBuffers` 和 `Xls` 的引用。

### 自定义 Unity 模板代码

- 参考修改 `template/unity` 下的 .cs 文件。