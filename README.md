# ResoniteLink MCP

ResoniteLink WebSocket プロトコルを使用して Resonite VR ワールドを操作するための MCP サーバ & CLI ツール。

## インストール

```bash
npm install
npm run build
```

## MCP サーバとして使用

### Claude Code 設定

プロジェクトルートの `.mcp.json` に設定済み。Claude Code を再起動すると自動的にMCPサーバーが利用可能になります。

### Claude Desktop 設定

`claude_desktop_config.json` に以下を追加:

```json
{
  "mcpServers": {
    "resonitelink": {
      "command": "node",
      "args": ["C:/Users/neo/GitHub/resolink_mcp/dist/mcp-server.js"],
      "env": {
        "RESONITE_WS_URL": "ws://localhost:29551"
      }
    }
  }
}
```

### 利用可能なツール

| ツール | 説明 |
|--------|------|
| `connect` | Resonite に接続 |
| `disconnect` | 接続を切断 |
| `get_slot` | スロット情報を取得 |
| `find_slot` | 名前でスロットを検索 |
| `add_slot` | スロットを追加 |
| `remove_slot` | スロットを削除 |
| `update_slot` | スロットを更新 |
| `add_component` | コンポーネントを追加 |
| `get_component` | コンポーネント情報を取得 |
| `update_component` | コンポーネントを更新 |
| `remove_component` | コンポーネントを削除 |
| `search_components` | コンポーネントを検索 |
| `get_component_info` | コンポーネント詳細を取得 |
| `list_categories` | カテゴリ一覧 |
| `search_by_category` | カテゴリで検索 |
| `search_by_member` | メンバー名で検索 |
| `get_component_source` | ソースコードを取得 |
| `grep_source` | ソースを全文検索 |

## CLI として使用

```bash
# スロット情報を取得
node dist/cli.js get-slot --slot-id Root --depth 1

# 名前でスロットを検索
node dist/cli.js find --name MyObject

# スロットを追加
node dist/cli.js add-slot --name NewSlot --x 0 --y 1 --z 0

# コンポーネントを追加
node dist/cli.js add-component --slot-id <id> --type "[FrooxEngine]FrooxEngine.BoxMesh"

# スロットを削除
node dist/cli.js remove --slot-id <id>
```

## ライブラリとして使用

```typescript
import { ResoniteLinkClient } from './src/index.js';

const client = new ResoniteLinkClient({ url: 'ws://localhost:29551' });
await client.connect();

// スロットを追加
await client.addSlot({ name: 'MyObject', position: { x: 0, y: 1, z: 0 } });

// コンポーネントを追加
await client.addComponent({
  containerSlotId: slotId,
  componentType: '[FrooxEngine]FrooxEngine.BoxMesh'
});

client.disconnect();
```

### クライアントオプション

```typescript
const client = new ResoniteLinkClient({
  url: 'ws://localhost:29551',  // WebSocket URL（必須）
  debug: true,                   // コンソールにログ出力
  logFile: 'debug.log',          // ファイルにログ出力
  requestTimeout: 30000,         // リクエストタイムアウト（ミリ秒、デフォルト: 30000）
  autoReconnect: false,          // 自動再接続
  reconnectInterval: 5000,       // 再接続間隔（ミリ秒）
});
```

### デバッグログ

問題が発生した場合、デバッグログを有効にすると SEND/RECV メッセージを確認できます：

```typescript
const client = new ResoniteLinkClient({
  url: 'ws://localhost:29551',
  debug: true,           // コンソール出力
  logFile: 'debug.log',  // ファイル出力
});
```

ログ例:
```
[2026-01-08T06:10:24.504Z] SEND: { "$type": "addSlot", "messageId": "..." }
[2026-01-08T06:10:24.506Z] RECV: { "success": true, "messageId": "...", "error": null }
```

### リクエストタイムアウト

レスポンスが返らない場合（不正な形式のデータ送信時など）、タイムアウトでエラーが発生します：

```typescript
const client = new ResoniteLinkClient({
  url: 'ws://localhost:29551',
  requestTimeout: 10000,  // 10秒でタイムアウト
});
```

タイムアウト発生時は `Error: Request timeout after 10000ms: updateComponent (...)` のようなエラーがスローされます。

## 重要: ワールドシステムオブジェクト

Resonite ワールドの Root 以下には、削除してはいけないシステムオブジェクトがあります。

### 削除禁止オブジェクト

| オブジェクト名 | 説明 |
|--------------|------|
| `Controllers` | コントローラー入力システム |
| `Roles` | ユーザーロール管理 |
| `SpawnArea` | ユーザーのスポーン位置 |
| `Light` | ワールドの照明 |
| `Skybox` | 空・背景 |
| `User <...>` | 接続中のユーザー（削除するとキックされる） |
| `__TEMP` | 一時オブジェクト管理 |
| `Undo Manager` | アンドゥ履歴 |
| `Assets` | 共有アセット |
| `Clipboard Importer` | クリップボードインポート機能 |

### 安全な削除方法

```typescript
const SYSTEM_OBJECTS = [
  'Controllers', 'Roles', 'SpawnArea', 'Light', 'Skybox',
  '__TEMP', 'Undo Manager', 'Assets', 'Clipboard Importer'
];

// システムオブジェクトとUserはスキップ
if (SYSTEM_OBJECTS.includes(name) || name.startsWith('User ')) {
  continue;
}
```

## コンポーネントタイプの書式

```
[FrooxEngine]FrooxEngine.ComponentName
```

### よく使うコンポーネント

| コンポーネント | 用途 |
|--------------|------|
| `BoxMesh` | 直方体メッシュ |
| `SphereMesh` | 球体メッシュ |
| `CylinderMesh` | 円柱メッシュ |
| `ConeMesh` | 円錐メッシュ |
| `BevelBoxMesh` | 角丸直方体 |
| `RampMesh` | スロープ |
| `FrameMesh` | フレーム |
| `TorusMesh` | トーラス |
| `CapsuleMesh` | カプセル |
| `MeshRenderer` | メッシュ描画 |
| `PBS_Metallic` | PBRマテリアル |
| `Light` | ライト |

### マテリアルの設定例

```typescript
await client.updateComponent({
  id: materialId,
  members: {
    AlbedoColor: { $type: 'colorX', value: { r: 1, g: 0, b: 0, a: 1, profile: 'sRGB' } },
    Smoothness: { $type: 'float', value: 0.5 },
    Metallic: { $type: 'float', value: 0.2 },
  }
});
```

### Enum型の設定（BlendMode, LightType など）

Enum 型のメンバーを更新する場合、以下の形式を使用する必要があります：

```typescript
{
  $type: 'enum',      // 小文字の 'enum'
  value: 'Alpha',     // 文字列で値を指定（数値ではない）
  enumType: 'BlendMode'  // Enum の型名
}
```

#### BlendMode の値

| 値 | 説明 |
|----|------|
| `Opaque` | 不透明（デフォルト） |
| `Cutout` | カットアウト（アルファテスト） |
| `Alpha` | 半透明（アルファブレンド） |

#### 半透明マテリアルの例

```typescript
await client.updateComponent({
  id: materialId,
  members: {
    BlendMode: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode' },
    AlbedoColor: { $type: 'colorX', value: { r: 0.6, g: 0.75, b: 0.9, a: 0.3, profile: 'sRGB' } },
  }
});
```

#### LightType の値

| 値 | 説明 |
|----|------|
| `Directional` | ディレクショナルライト |
| `Point` | ポイントライト |
| `Spot` | スポットライト |

```typescript
await client.updateComponent({
  id: lightId,
  members: {
    LightType: { $type: 'enum', value: 'Point', enumType: 'LightType' },
    Intensity: { $type: 'float', value: 2.0 },
    Range: { $type: 'float', value: 10.0 },
  }
});
```

#### 注意事項

- `$type` は必ず小文字の `'enum'`（`'Enum'` ではない）
- `value` は数値ではなく文字列で指定
- `enumType` を省略すると動作しない場合がある
- 正しくない形式を送信するとレスポンスが返らずタイムアウトする

### メンバーの型一覧

| $type | 説明 | 例 |
|-------|------|-----|
| `float` | 浮動小数点 | `{ $type: 'float', value: 0.5 }` |
| `int` | 整数 | `{ $type: 'int', value: 10 }` |
| `bool` | 真偽値 | `{ $type: 'bool', value: true }` |
| `float2` | 2Dベクトル | `{ $type: 'float2', value: { x: 1, y: 1 } }` |
| `float3` | 3Dベクトル | `{ $type: 'float3', value: { x: 1, y: 2, z: 3 } }` |
| `floatQ` | クォータニオン | `{ $type: 'floatQ', value: { x: 0, y: 0, z: 0, w: 1 } }` |
| `colorX` | 色 | `{ $type: 'colorX', value: { r: 1, g: 0, b: 0, a: 1, profile: 'sRGB' } }` |
| `enum` | 列挙型 | `{ $type: 'enum', value: 'Alpha', enumType: 'BlendMode' }` |
| `reference` | 参照 | `{ $type: 'reference', targetId: 'Reso_XXXXX' }` |
| `list` | リスト | `{ $type: 'list', elements: [...] }` |

### Materials リストの更新（2段階）

MeshRenderer の Materials リストを更新するには2段階の操作が必要です。

#### なぜ2段階必要か

ResoniteLink の制限により、リスト要素への参照設定は以下の動作をします：

1. **1回目の更新**: リストに新しい要素が追加されるが、`targetId` は **null になる**
2. **2回目の更新**: 要素の `id` を指定することで、既存要素の `targetId` を設定できる

つまり、要素の追加と参照の設定は別々の操作として行う必要があります。

#### コード例

```typescript
// 1. まずリストに要素を追加（この時点では targetId は null になる）
await client.updateComponent({
  id: rendererId,
  members: {
    Materials: {
      $type: 'list',
      elements: [{ $type: 'reference', targetId: materialId }]
    }
  }
});

// 2. 追加された要素のIDを取得
const rendererData = await client.getComponent(rendererId);
const elementId = rendererData.data.members.Materials.elements[0].id;

// 3. 要素のIDを指定して、参照を設定
await client.updateComponent({
  id: rendererId,
  members: {
    Materials: {
      $type: 'list',
      elements: [{ $type: 'reference', id: elementId, targetId: materialId }]
    }
  }
});
```

#### 重要なポイント

- `id` フィールドを省略すると、新しい要素が追加される（既存要素は更新されない）
- `id` フィールドを指定すると、その ID を持つ既存要素が更新される
- 1回目で `targetId` を指定しても無視され、null になる

## ProtoFlux コンポーネントの追加

ProtoFlux ノード（ジェネリック型コンポーネント）を追加するには、特定の形式が必要です。

### 正しい形式

```
[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.<コンポーネント名><型>
```

#### ポイント

| 項目 | 正しい形式 | 間違った形式 |
|------|-----------|-------------|
| アセンブリ名 | `[ProtoFluxBindings]` | `[FrooxEngine]` |
| 名前空間 | `FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes` | `FrooxEngine.ProtoFlux.CoreNodes` |
| ジェネリック型 | `<bool>`, `<int>`, `<float>` | `<System.Boolean>`, `` `1[System.Boolean] `` |

- **名前空間**: `FrooxEngine` が2回繰り返される
- **型指定**: C# エイリアス（`bool`, `int`, `float`）を使用する（`System.Boolean` ではない）
- **記法**: `<>` 形式を使用する（.NET のバッククォート記法 `` `1[...] `` ではない）

### 動作確認済みコンポーネント

| ノード | componentType |
|--------|---------------|
| ValueInput\<int\> | `[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>` |
| ValueAdd\<int\> | `[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.ValueAdd<int>` |
| ValueDisplay\<int\> | `[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueDisplay<int>` |
| WorldTimeFloat | `[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Time.WorldTimeFloat` |
| AxisAngle_floatQ | `[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Math.Quaternions.AxisAngle_floatQ` |
| HSV_ToColorX | `[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Color.HSV_ToColorX` |
| ValueFieldDrive\<floatQ\> | `[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueFieldDrive<floatQ>` |
| ValueFieldDrive\<colorX\> | `[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueFieldDrive<colorX>` |
| ValueFieldDrive\<bool\> | `[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueFieldDrive<bool>` |

### コード例

```typescript
// ValueFieldDrive<floatQ> を追加（回転ドライブ用）
await client.addComponent({
  containerSlotId: slotId,
  componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueFieldDrive<floatQ>'
});

// WorldTimeFloat を追加（時間取得用）
await client.addComponent({
  containerSlotId: slotId,
  componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Time.WorldTimeFloat'
});

// HSV_ToColorX を追加（色変換用）
await client.addComponent({
  containerSlotId: slotId,
  componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Color.HSV_ToColorX'
});
```

### ProtoFlux ノード間の接続

```typescript
// ValueAdd の A, B 入力に ValueInput ノードを接続
await client.updateComponent({
  id: addCompId,
  members: {
    A: { $type: 'reference', targetId: input1CompId },
    B: { $type: 'reference', targetId: input2CompId },
  }
});

// ValueDisplay の Input に ValueAdd の出力を接続
await client.updateComponent({
  id: displayCompId,
  members: {
    Input: { $type: 'reference', targetId: addCompId },
  }
});
```

### よく使う ProtoFlux ノード

| コンポーネント | 用途 |
|--------------|------|
| `ValueFieldDrive<T>` | フィールドをドライブ |
| `ReferenceFieldDrive<T>` | 参照フィールドをドライブ |
| `GlobalValue<T>` | グローバル値 |
| `GlobalReference<T>` | グローバル参照 |

### ProtoFlux ノードの配置

ProtoFlux ノードを追加する際は、各ノードを別々のスロットに配置し、適切な位置に並べることで視認性が向上します。

#### 座標系

Resonite の座標系:
- **X軸**: 左右（右が正）
- **Y軸**: 上下（上が正）
- **Z軸**: 前後（手前が正）

ProtoFlux ノードは**左から右（X軸方向）**に配置するのが一般的です。

#### 配置の基本パターン

```
左 ────────────────────────────────────────────→ 右 (X軸)

[入力ノード群]  →  [処理ノード]  →  [出力ノード]  →  [ドライブノード]
   x=-1.5            x=-1.0           x=-0.5            x=0
```

#### 複数入力がある場合

Y軸で上下にずらして配置:

```typescript
// 入力1（上側）
await client.addSlot({ name: 'Input1', position: { x: -1.5, y: 0.15, z: 0 } });

// 入力2（下側）
await client.addSlot({ name: 'Input2', position: { x: -1.5, y: -0.15, z: 0 } });

// 処理ノード（中央）
await client.addSlot({ name: 'Process', position: { x: -1.0, y: 0, z: 0 } });
```

#### 実践例: 回転するボックス

```typescript
// 親スロット
const fluxSlot = await client.addSlot({ name: 'Flux', position: { x: 0, y: 2, z: 0 } });

// 各ノードを左から右に配置
const nodes = [
  { name: 'AxisInput',      x: -0.6, y: 0.15 },  // 回転軸入力
  { name: 'TimeNode',       x: -0.6, y: -0.15 }, // 時間取得
  { name: 'AxisAngleNode',  x: -0.3, y: 0 },     // 軸角度→クォータニオン変換
  { name: 'DriveNode',      x: 0,    y: 0 },     // 回転ドライブ
];

for (const node of nodes) {
  await client.addSlot({
    name: node.name,
    parentId: fluxSlot.data.id,
    position: { x: node.x, y: node.y, z: 0 }
  });
}
```

#### 配置のコツ

| 項目 | 推奨値 |
|------|--------|
| ノード間の水平間隔 | 0.3〜0.5 |
| 分岐時の垂直間隔 | 0.15〜0.3 |
| 親スロットからの相対座標 | 使用する |

- 親スロット（例: `Flux`）を作成し、その下に各ノードを配置
- 位置は親スロットからの相対座標になる
- データフローが左から右に流れるように配置
- 分岐がある場合は Y軸で上下にずらす

### 制限事項

一部の ProtoFlux ノードは追加できない場合があります：
- 複雑なジェネリック制約を持つノード
- 特殊な初期化が必要なノード

回避策：
- Resonite 内で手動で ProtoFlux を作成
- 既存の ProtoFlux をテンプレートとして複製
- PackedObject として保存したものをインポート

## デコンパイル検索 (CLI)

```bash
# コンポーネント名で検索
node dist/cli.js search --query Mesh

# コンポーネント詳細を表示
node dist/cli.js info --name PBS_Metallic

# カテゴリ一覧
node dist/cli.js categories

# カテゴリで検索
node dist/cli.js category --query "Materials"

# メンバー名で検索
node dist/cli.js member --query Smoothness

# ソースコード全文検索
node dist/cli.js grep --query "SyncPlayback"

# ソースコード表示
node dist/cli.js source --name BoxMesh
```

## サンプルスクリプト

```bash
# ProtoFlux 1+1 を作成（ValueInput → ValueAdd → ValueDisplay）
node dist/scripts/create-flux-add.js ws://localhost:58971

# 東京タワー（詳細版）を作成
node dist/scripts/create-tokyo-tower-detailed.js ws://localhost:58971

# 東京スカイツリーを作成
node dist/scripts/create-skytree.js ws://localhost:58971

# 東京タワーを削除
node dist/scripts/delete-tokyo-tower.js ws://localhost:58971

# モダンハウス（内装付き）を作成
node dist/scripts/create-house3.js

# 街を作成
node dist/scripts/create-town.js

# 雲を作成
node dist/scripts/create-clouds.js

# すべて削除して床だけにする
node dist/scripts/reset-to-floor.js
```

## License

MIT
