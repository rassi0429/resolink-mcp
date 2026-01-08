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

## 制限事項: ProtoFlux コンポーネント

ResoniteLink モッドの制限により、**ProtoFlux コンポーネントは追加できません**。

### 原因

ProtoFlux コンポーネントはジェネリック型（例: `ValueInput<int>`, `ValueAddMulti<int>`）であり、ResoniteLink の型解決がこれらの型を解決できません。

### 試行した形式（すべて失敗）

```
FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>
FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput`1[System.Int32]
[FrooxEngine]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>
[ProtoFlux.Nodes.FrooxEngine]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput`1[System.Int32]
```

### 動作するもの

- 既存の ProtoFlux コンポーネントの**読み取り**は可能
- 非ジェネリック型コンポーネント（BoxMesh, PBS_Metallic など）の追加は可能

### 回避策

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
