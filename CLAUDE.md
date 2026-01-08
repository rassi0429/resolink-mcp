# ResoLink MCP 開発ガイドライン

## 作業方針

### MCP を使う場面（調査・テスト）
- コンポーネントの型名・フォーマットの調査
- 既存スロット/コンポーネントの構造確認
- 単一コンポーネントの動作テスト
- ProtoFluxノードの接続テスト
- 軽量な実験・プロトタイピング

### スクリプトを使う場面（本番構築）
- 複数スロット/コンポーネントの一括作成
- 完成品の構築
- 繰り返しパターンの生成
- 大規模な階層構造の作成

**理由**: MCPで1つずつコンポーネントをアタッチするとコンテキストを大量に消費するため、調査が完了したら本番構築はスクリプトで一括実行する。

---

## コンポーネント型フォーマット

### 基本コンポーネント（FrooxEngine）
```
[FrooxEngine]FrooxEngine.<ComponentName>
```
例:
- `[FrooxEngine]FrooxEngine.BoxMesh`
- `[FrooxEngine]FrooxEngine.SphereMesh`
- `[FrooxEngine]FrooxEngine.MeshRenderer`
- `[FrooxEngine]FrooxEngine.PBS_Metallic`

### ProtoFlux ノード
```
[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.<Category>.<NodeName>
```
例:
- `[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Time.WorldTimeFloat`
- `[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Color.HSV_ToColorX`

### ジェネリック型（ProtoFlux）
正しい形式で指定すれば追加可能:
```
[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>
[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.ValueAdd<int>
[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueFieldDrive<colorX>
```

**ポイント**:
- `[ProtoFluxBindings]` プレフィックスが必須
- 型は C# エイリアス (`int`, `float`, `bool`) を使用
- `<>` 記法を使用（バッククォート記法 `` `1[...] `` は不可）

---

## 動作確認済みコンポーネント

| カテゴリ | コンポーネント | 型フォーマット |
|---------|--------------|---------------|
| Mesh | BoxMesh | `[FrooxEngine]FrooxEngine.BoxMesh` |
| Mesh | SphereMesh | `[FrooxEngine]FrooxEngine.SphereMesh` |
| Rendering | MeshRenderer | `[FrooxEngine]FrooxEngine.MeshRenderer` |
| Material | PBS_Metallic | `[FrooxEngine]FrooxEngine.PBS_Metallic` |
| Animation | Wiggler | `[FrooxEngine]FrooxEngine.Wiggler` |
| ProtoFlux | WorldTimeFloat | `[ProtoFluxBindings]...Time.WorldTimeFloat` |
| ProtoFlux | HSV_ToColorX | `[ProtoFluxBindings]...Color.HSV_ToColorX` |
| ProtoFlux | ValueInput\<int\> | `[ProtoFluxBindings]...ValueInput<int>` |
| ProtoFlux | ValueAdd\<int\> | `[ProtoFluxBindings]...Operators.ValueAdd<int>` |
| ProtoFlux | ValueDisplay\<int\> | `[ProtoFluxBindings]...ValueDisplay<int>` |
| ProtoFlux | ValueFieldDrive\<colorX\> | `[ProtoFluxBindings]...ValueFieldDrive<colorX>` |
| ProtoFlux | FieldDriveBase+Proxy | `FrooxEngine.ProtoFlux.CoreNodes.FieldDriveBase<colorX>+Proxy` |

---

## スクリプト構築の推奨フロー

1. **調査フェーズ** (MCP)
   - `search_components` で型名を検索
   - `get_component_info` で詳細確認
   - `get_slot` で既存構造を参照
   - 単一コンポーネントで動作テスト

2. **設計フェーズ**
   - 必要なスロット階層を設計
   - コンポーネントのリストアップ
   - 接続関係の整理

3. **構築フェーズ** (スクリプト)
   - 一括でスロット作成
   - 一括でコンポーネント追加
   - 一括で参照設定

---

## スクリプトの書き方

### ファイル配置
`src/scripts/` にTypeScriptファイルを作成

### 実行方法
```bash
npx tsx src/scripts/<script-name>.ts [ws://localhost:29551]
```

### 基本テンプレート
```typescript
import { ResoniteLinkClient } from '../index.js';

async function main() {
  const url = process.argv[2] || 'ws://localhost:29551';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    // 1. スロット作成
    await client.addSlot({
      name: 'MyObject',
      position: { x: 0, y: 1, z: 0 },
      isActive: true,
    });

    // 2. スロットID取得
    const slot = await client.findSlotByName('MyObject', 'Root', 1);
    if (!slot?.id) throw new Error('Slot not found');

    // 3. コンポーネント追加
    await client.addComponent({
      containerSlotId: slot.id,
      componentType: '[FrooxEngine]FrooxEngine.SphereMesh',
    });

    // 4. コンポーネント情報取得
    const slotData = await client.getSlot({
      slotId: slot.id,
      depth: 0,
      includeComponentData: true,
    });
    const mesh = slotData.data.components?.find(c =>
      c.componentType?.includes('SphereMesh')
    );

    // 5. コンポーネント更新
    await client.updateComponent({
      id: mesh.id!,
      members: {
        Radius: { $type: 'float', value: 0.5 },
      } as any,
    });

  } finally {
    client.disconnect();
  }
}

main();
```

### 参考スクリプト
- `create-snowman.ts` - パーツ作成のヘルパー関数パターン
- `colorful.ts` - シンプルな色変更
- `create-house.ts` - 階層構造の構築
- `create-flux-add.ts` - ProtoFlux 1+1 の作成例

---

## ProtoFlux スクリプトの書き方

### 基本パターン

```typescript
// 1. 親スロット作成（ユニーク名推奨）
const slotName = `Flux_${Date.now()}`;
await client.addSlot({ name: slotName, position: { x: 0, y: 1.5, z: 2 } });
const container = await client.findSlotByName(slotName, 'Root', 1);

// 2. 子スロット作成（各ノード用）
await client.addSlot({ parentId: container.id, name: 'Input1', position: { x: -0.3, y: 0.1, z: 0 } });
await client.addSlot({ parentId: container.id, name: 'Add', position: { x: 0, y: 0, z: 0 } });

// 3. 子スロットIDを親から取得
const containerData = await client.getSlot({ slotId: container.id, depth: 1 });
const input1Slot = containerData.data?.children?.find(c => c.name?.value === 'Input1');

// 4. ProtoFluxコンポーネント追加
await client.addComponent({
  containerSlotId: input1Slot.id,
  componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>',
});

// 5. コンポーネントID取得
const slotData = await client.getSlot({ slotId: input1Slot.id, includeComponentData: true });
const inputComp = slotData.data?.components?.find(c => c.componentType?.includes('ValueInput'));

// 6. 値設定・接続
await client.updateComponent({
  id: inputComp.id,
  members: { Value: { $type: 'int', value: 1 } } as any,
});
```

### ProtoFlux ノードの接続

| ノード | 入力メンバー | 出力 |
|--------|------------|------|
| ValueInput\<T\> | Value (値設定) | 自身がINodeValueOutput |
| ValueAdd\<T\> | A, B (reference) | 自身がINodeValueOutput |
| ValueDisplay\<T\> | Input (reference) | なし（表示のみ） |
| HSV_ToColorX | H, S, V (reference) | 自身がINodeValueOutput |
| ValueFieldDrive\<T\> | Value (reference) | Drive (フィールドをドライブ) |

### 接続の書き方

```typescript
// ValueAdd の A, B に入力ノードを接続
await client.updateComponent({
  id: addComp.id,
  members: {
    A: { $type: 'reference', targetId: input1Comp.id },
    B: { $type: 'reference', targetId: input2Comp.id },
  } as any,
});

// ValueDisplay の Input に計算ノードを接続
await client.updateComponent({
  id: displayComp.id,
  members: {
    Input: { $type: 'reference', targetId: addComp.id },
  } as any,
});
```

---

## 注意事項

- システムスロット（Controllers, Roles, SpawnArea, Light, Skybox, Assets等）は削除しない
- Materials リストは2段階で更新（要素追加 → targetId設定）
- HSV_ToColorX は S, V 入力が null だと色が出ない（要 ValueInput 接続）
- Wiggler は floatQ（回転）のみ対応、float3（位置）は不可
