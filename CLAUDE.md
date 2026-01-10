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
- プリミティブ型は C# エイリアス (`int`, `float`, `bool`, `colorX`) を使用
- `<>` 記法を使用（バッククォート記法 `` `1[...] `` は不可）

### オブジェクト型のジェネリックパラメータ

`Slot`や`User`などのオブジェクト型をジェネリックパラメータに使う場合、**型パラメータにもアセンブリ修飾名が必要**:
```
[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.RefObjectInput<[FrooxEngine]FrooxEngine.Slot>
[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.RefObjectInput<[FrooxEngine]FrooxEngine.User>
```

**形式**: `<[Assembly]Namespace.Type>`

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
| ProtoFlux | RefObjectInput\<Slot\> | `[ProtoFluxBindings]...RefObjectInput<[FrooxEngine]FrooxEngine.Slot>` |
| ProtoFlux | DynamicImpulseReceiver | `[ProtoFluxBindings]...Actions.DynamicImpulseReceiver` |
| ProtoFlux | DuplicateSlot | `[ProtoFluxBindings]...FrooxEngine.Slots.DuplicateSlot` |
| ProtoFlux | ObjectFieldDrive\<string\> | `[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectFieldDrive<string>` |
| ProtoFlux | FieldDriveBase+Proxy | ObjectFieldDrive追加時に自動生成。Driveメンバーはこちらにある |
| UIX | Canvas | `[FrooxEngine]FrooxEngine.UIX.Canvas` |
| UIX | RectTransform | `[FrooxEngine]FrooxEngine.UIX.RectTransform` |
| UIX | Text | `[FrooxEngine]FrooxEngine.UIX.Text` |
| UIX | Image | `[FrooxEngine]FrooxEngine.UIX.Image` |
| UIX | Button | `[FrooxEngine]FrooxEngine.UIX.Button` |
| UIX | TextField | `[FrooxEngine]FrooxEngine.UIX.TextField` |
| UIX | VerticalLayout | `[FrooxEngine]FrooxEngine.UIX.VerticalLayout` |
| UIX | HorizontalLayout | `[FrooxEngine]FrooxEngine.UIX.HorizontalLayout` |
| UIX | LayoutElement | `[FrooxEngine]FrooxEngine.UIX.LayoutElement` |
| Material | UI_UnlitMaterial | `[FrooxEngine]FrooxEngine.UI_UnlitMaterial` |
| Interaction | Grabbable | `[FrooxEngine]FrooxEngine.Grabbable` |
| Interaction | ButtonDynamicImpulseTrigger | `[FrooxEngine]FrooxEngine.ButtonDynamicImpulseTrigger` |
| Interaction | PhysicalButton | `[FrooxEngine]FrooxEngine.PhysicalButton` |
| Interaction | BoxCollider | `[FrooxEngine]FrooxEngine.BoxCollider` |
| ProtoFlux | GlobalReference\<IButton\> | `[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IButton>` |
| ProtoFlux | ButtonEvents | `[ProtoFluxBindings]...FrooxEngine.Interaction.ButtonEvents` |
| ProtoFlux | StartAsyncTask | `[ProtoFluxBindings]...FrooxEngine.Async.StartAsyncTask` |
| ProtoFlux | GET_String | `[ProtoFluxBindings]...FrooxEngine.Network.GET_String` |
| ProtoFlux | StringToAbsoluteURI | `[ProtoFluxBindings]...Utility.Uris.StringToAbsoluteURI` |
| ProtoFlux | DataModelObjectFieldStore\<string\> | `[ProtoFluxBindings]...FrooxEngine.Variables.DataModelObjectFieldStore<string>` |

---

## UIX の構築

### 重要: スケール設定

UIXはピクセル単位で動作するため、**UIXのルートスロットのスケールを0.001に設定する必要がある**:

```typescript
await client.updateSlot({
  id: mainId,
  scale: { x: 0.001, y: 0.001, z: 0.001 },
});
```

### UIXコンポーネントの名前空間

UIXコンポーネントは `FrooxEngine.UIX` 名前空間にある（`FrooxEngine` ではない）:

```
[FrooxEngine]FrooxEngine.UIX.<ComponentName>
```

### 基本的なUIX構造

```
Root (scale: 0.001)
├── Canvas
├── Grabbable (掴んで移動可能にする場合)
└── Background
    ├── RectTransform (AnchorMin/Max: 0,0 ~ 1,1)
    └── Image (背景色)
└── Content
    ├── RectTransform
    ├── VerticalLayout / HorizontalLayout
    └── 子要素...
```

### 重要: Image と Text の Z-Fight 問題

**同じスロットに Image と Text を配置すると Z-Fight して見えなくなる。**

背景色付きのテキストを作る場合は、**別スロットに分ける**必要がある:

```
❌ 間違い（Z-Fight発生）
TextSlot
├── RectTransform
├── Image (背景)
└── Text (テキスト)  ← 見えなくなる

✅ 正解（別スロットに分ける）
BackgroundSlot
├── RectTransform
└── Image (背景)
TextSlot (BackgroundSlotの子)
├── RectTransform
└── Text (テキスト)
```

または、親スロットにImageを置き、子スロットにTextを置く構造にする。

### 重要: Image には UI_UnlitMaterial が必要

**Image コンポーネントの Material が未設定だと、Unlit の描画順が正しく処理されず表示が乱れる。**

UIX の Image を使う場合は、**UI_UnlitMaterial を作成して Image.Material に設定する**必要がある:

```typescript
// 1. UIXルートに UI_UnlitMaterial を追加
await client.addComponent({
  containerSlotId: uixRootId,
  componentType: '[FrooxEngine]FrooxEngine.UI_UnlitMaterial',
});

// 2. コンポーネントIDを取得
const uixRootData = await client.getSlot({ slotId: uixRootId, includeComponentData: true });
const uiMaterial = uixRootData.data?.components?.find((c: any) =>
  c.componentType?.includes('UI_UnlitMaterial')
);

// 3. UI_UnlitMaterial の設定（重要: これらの値が描画順を正しくする）
await client.updateComponent({
  id: uiMaterial.id,
  members: {
    ZWrite: { $type: 'enum', value: 'On', enumType: 'ZWrite' },
    OffsetFactor: { $type: 'float', value: 1 },
    OffsetUnits: { $type: 'float', value: 100 },
    Sidedness: { $type: 'enum', value: 'Double', enumType: 'Sidedness' },
  } as any,
});

// 4. Image.Material に設定
await client.updateComponent({
  id: imageId,
  members: {
    Tint: { $type: 'colorX', value: { r: 0.2, g: 0.2, b: 0.25, a: 1 } },
    Material: { $type: 'reference', targetId: uiMaterial?.id },
  } as any,
});
```

**ポイント**:
- UI_UnlitMaterial は UIX ルートに1つ作成
- **背景の Image のみ** Material を設定する（子要素の Image は null でOK）
- **必須設定**: `ZWrite: On`, `OffsetFactor: 1`, `OffsetUnits: 100`, `Sidedness: Double`

### UIXコンポーネントの設定例

```typescript
// Canvas
await client.updateComponent({
  id: canvasId,
  members: {
    Size: { $type: 'float2', value: { x: 400, y: 500 } },
  } as any,
});

// RectTransform（全画面）
await client.updateComponent({
  id: rectId,
  members: {
    AnchorMin: { $type: 'float2', value: { x: 0, y: 0 } },
    AnchorMax: { $type: 'float2', value: { x: 1, y: 1 } },
    OffsetMin: { $type: 'float2', value: { x: 0, y: 0 } },
    OffsetMax: { $type: 'float2', value: { x: 0, y: 0 } },
  } as any,
});

// Image（色設定）
await client.updateComponent({
  id: imageId,
  members: {
    Tint: { $type: 'colorX', value: { r: 0.2, g: 0.2, b: 0.25, a: 1 } },
  } as any,
});

// Text
await client.updateComponent({
  id: textId,
  members: {
    Content: { $type: 'string', value: 'Hello' },
    Size: { $type: 'float', value: 24 },
    Color: { $type: 'colorX', value: { r: 1, g: 1, b: 1, a: 1 } },
  } as any,
});

// LayoutElement
await client.updateComponent({
  id: layoutId,
  members: {
    PreferredHeight: { $type: 'float', value: 50 },
    FlexibleWidth: { $type: 'float', value: 1 },
  } as any,
});

// VerticalLayout / HorizontalLayout
await client.updateComponent({
  id: layoutId,
  members: {
    Spacing: { $type: 'float', value: 10 },
    PaddingTop: { $type: 'float', value: 10 },
    PaddingBottom: { $type: 'float', value: 10 },
    PaddingLeft: { $type: 'float', value: 10 },
    PaddingRight: { $type: 'float', value: 10 },
    ForceExpandWidth: { $type: 'bool', value: true },
    ForceExpandHeight: { $type: 'bool', value: false },
  } as any,
});
```

### UIX Enumフィールドの設定

`HorizontalAlign`, `VerticalAlign` などのEnum型フィールドは `$type: 'enum'` で設定可能：

```typescript
await client.updateComponent({
  id: textId,
  members: {
    HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
    VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
  } as any,
});
```

**形式**:
```typescript
{ $type: 'enum', value: '値の名前', enumType: 'Enum型名' }
```

### UIXの注意事項

- TextFieldをアタッチすると自動的にTextEditorもアタッチされる

### 参考スクリプト

- `create-todo-list.ts` - UIX TODOリストの完全な実装例

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
- `create-weather-widget.ts` - UIX + PhysicalButton + HTTP GET の完全な実装例
- `create-weather-flux.ts` - 天気取得ProtoFluxの実装例

---

## ProtoFlux スクリプトの書き方

### 重要: スロット構成ルール

**1スロットに1つのProtoFluxコンポーネントのみ**

- ProtoFluxノードは他のコンポーネント（UIX、Mesh等）と混ぜない
- 「Flux」という親スロットを作り、その下にProtoFluxスロットを配置

```
MyObject (Grabbable)
├── Flux (ProtoFlux親スロット)
│   ├── Input1 (ValueInput<int>)
│   ├── Input2 (ValueInput<int>)
│   ├── Add (ValueAdd<int>)
│   └── Display (ValueDisplay<int>)
├── Button (BoxMesh, MeshRenderer, PBS_Metallic, BoxCollider, PhysicalButton)
└── UIX (Canvas, RectTransform, Text)
```

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

### ButtonEvents と PhysicalButton の接続

ButtonEventsノードをPhysicalButtonに接続するには、**GlobalReference\<IButton\>**を経由する必要がある。

```
PhysicalButton ← GlobalReference<IButton>.Reference
                        ↑
ButtonEvents.Button ────┘
```

```typescript
// 1. GlobalReference<IButton> を追加
await client.addComponent({
  containerSlotId: globalRefSlot.id,
  componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IButton>',
});

// 2. ButtonEvents を追加
await client.addComponent({
  containerSlotId: buttonEventsSlot.id,
  componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Interaction.ButtonEvents',
});

// 3. GlobalReference.Reference → PhysicalButton
await client.updateComponent({
  id: globalRefComp.id,
  members: {
    Reference: { $type: 'reference', targetId: physicalButton.id },
  } as any,
});

// 4. ButtonEvents.Button → GlobalReference
await client.updateComponent({
  id: buttonEventsComp.id,
  members: {
    Button: { $type: 'reference', targetId: globalRefComp.id },
  } as any,
});

// 5. ButtonEvents.Pressed → 次のノード（例: StartAsyncTask）
await client.updateComponent({
  id: buttonEventsComp.id,
  members: {
    Pressed: { $type: 'reference', targetId: startAsyncComp.id },
  } as any,
});
```

**ポイント**:
- ButtonEvents.Button は `IButton` インターフェースを期待する
- PhysicalButton は直接接続できない（GlobalReference経由が必要）
- GlobalReference\<IButton\> が PhysicalButton と ButtonEvents を繋ぐ

### 出力メンバー（empty型）の参照

ResoniteLinkの更新により、ProtoFluxノードの**出力メンバー**が `$type: "empty"` として返されるようになった。

#### 複数出力ノード（GlobalTransform等）の接続

```typescript
// 1. コンポーネント情報を取得
const slotData = await client.getSlot({ slotId, includeComponentData: true });
const globalTransform = slotData.data?.components?.find(c =>
  c.componentType?.includes('GlobalTransform')
);

// 2. 出力メンバーのIDを取得（empty型）
const globalPositionId = globalTransform.members.GlobalPosition.id;  // "Reso_XXX"
const globalRotationId = globalTransform.members.GlobalRotation.id;
const globalScaleId = globalTransform.members.GlobalScale.id;

// 3. 出力IDを直接参照して接続
await client.updateComponent({
  id: subComp.id,
  members: {
    A: { $type: 'reference', targetId: globalPositionId },  // 出力IDを参照
  } as any,
});
```

#### 単一出力ノード vs 複数出力ノード

| ノードタイプ | 接続方法 |
|------------|---------|
| 単一出力（ValueInput, ValueAdd等） | コンポーネントIDを直接参照 |
| 複数出力（GlobalTransform等） | 出力メンバーのIDを個別に参照 |

### ObjectFieldDrive の接続（フィールドドライブ）

ObjectFieldDrive<T>を追加すると、`FieldDriveBase<T>+Proxy` コンポーネントが**自動生成**される。
Driveメンバーは**Proxy側**にある。

```typescript
// 1. ObjectFieldDrive追加
await client.addComponent({
  containerSlotId: fieldDriveSlot.id,
  componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectFieldDrive<string>',
});

// 2. コンポーネント取得（ObjectFieldDriveとProxyの両方が存在）
const slotData = await client.getSlot({ slotId: fieldDriveSlot.id, includeComponentData: true });
const fieldDriveComp = slotData.data?.components?.find(c => c.componentType?.includes('ObjectFieldDrive'));
const proxyComp = slotData.data?.components?.find(c => c.componentType?.includes('Proxy'));

// 3. Value入力を接続（ObjectFieldDrive側）
await client.updateComponent({
  id: fieldDriveComp.id,
  members: { Value: { $type: 'reference', targetId: sourceComp.id } } as any,
});

// 4. Drive出力を接続（Proxy側）
const textDetails = await client.getComponent(textComp.id);
const contentFieldId = textDetails.data.members.Content.id;  // ドライブ対象フィールドのID

const proxyDetails = await client.getComponent(proxyComp.id);
const driveId = proxyDetails.data.members.Drive.id;

await client.updateComponent({
  id: proxyComp.id,
  members: { Drive: { $type: 'reference', id: driveId, targetId: contentFieldId } } as any,
});
```

---

## メンバーの型一覧

| $type | 説明 | 例 |
|-------|------|-----|
| `float` | 浮動小数点 | `{ $type: 'float', value: 0.5 }` |
| `int` | 整数 | `{ $type: 'int', value: 10 }` |
| `bool` | 真偽値 | `{ $type: 'bool', value: true }` |
| `string` | 文字列 | `{ $type: 'string', value: 'text' }` |
| `float2` | 2Dベクトル | `{ $type: 'float2', value: { x: 1, y: 1 } }` |
| `float3` | 3Dベクトル | `{ $type: 'float3', value: { x: 1, y: 2, z: 3 } }` |
| `floatQ` | クォータニオン | `{ $type: 'floatQ', value: { x: 0, y: 0, z: 0, w: 1 } }` |
| `colorX` | 色 | `{ $type: 'colorX', value: { r: 1, g: 0, b: 0, a: 1, profile: 'sRGB' } }` |
| `enum` | 列挙型 | `{ $type: 'enum', value: 'Alpha', enumType: 'BlendMode' }` |
| `reference` | 参照 | `{ $type: 'reference', targetId: 'Reso_XXXXX' }` |
| `list` | リスト | `{ $type: 'list', elements: [...] }` |
| `empty` | 出力メンバー（読み取り専用） | `{ $type: 'empty', id: 'Reso_XXXXX' }` |

---

## Enum型の設定

### 基本形式

```typescript
{ $type: 'enum', value: '値の名前', enumType: 'Enum型名' }
```

**注意**:
- `$type` は必ず小文字の `'enum'`
- `value` は数値ではなく文字列で指定
- `enumType` を省略すると動作しない場合がある

### よく使うEnum

#### BlendMode
| 値 | 説明 |
|----|------|
| `Opaque` | 不透明（デフォルト） |
| `Cutout` | カットアウト（アルファテスト） |
| `Alpha` | 半透明（アルファブレンド） |

```typescript
BlendMode: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode' }
```

#### LightType
| 値 | 説明 |
|----|------|
| `Directional` | ディレクショナルライト |
| `Point` | ポイントライト |
| `Spot` | スポットライト |

```typescript
LightType: { $type: 'enum', value: 'Point', enumType: 'LightType' }
```

#### UIX TextAlignment
| Enum型名 | 値 |
|----------|-----|
| `TextHorizontalAlignment` | `Left`, `Center`, `Right` |
| `TextVerticalAlignment` | `Top`, `Middle`, `Bottom` |

---

## マテリアル設定

### PBS_Metallic の例

```typescript
await client.updateComponent({
  id: materialId,
  members: {
    AlbedoColor: { $type: 'colorX', value: { r: 1, g: 0, b: 0, a: 1, profile: 'sRGB' } },
    Smoothness: { $type: 'float', value: 0.5 },
    Metallic: { $type: 'float', value: 0.2 },
  } as any,
});
```

### 半透明マテリアル

```typescript
await client.updateComponent({
  id: materialId,
  members: {
    BlendMode: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode' },
    AlbedoColor: { $type: 'colorX', value: { r: 0.6, g: 0.75, b: 0.9, a: 0.3, profile: 'sRGB' } },
  } as any,
});
```

---

## Materials リストの更新（2段階必要）

MeshRenderer の Materials リストは2段階で更新する必要がある:

1. **リストに要素追加**（この時点では targetId は null になる）
2. **要素IDを取得して参照を設定**

```typescript
// 1. まずリストに要素を追加
await client.updateComponent({
  id: rendererId,
  members: {
    Materials: {
      $type: 'list',
      elements: [{ $type: 'reference', targetId: materialId }]
    }
  } as any,
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
  } as any,
});
```

**ポイント**:
- `id` フィールドを省略 → 新しい要素が追加される
- `id` フィールドを指定 → 既存要素が更新される
- 1回目で `targetId` を指定しても無視されて null になる

---

## ProtoFlux ノードの配置

### Resonite 座標系
- **X軸**: 左右（右が正）
- **Y軸**: 上下（上が正）
- **Z軸**: 前後（手前が正）

### 推奨配置

データフローは左→右（X軸方向）に配置:

```
左 ────────────────────────────────────────────→ 右 (X軸)

[入力ノード群]  →  [処理ノード]  →  [出力ノード]  →  [ドライブノード]
   x=-1.5            x=-1.0           x=-0.5            x=0
```

### 配置の推奨値

| 項目 | 推奨値 |
|------|--------|
| ノード間の水平間隔 | 0.3〜0.5 |
| 分岐時の垂直間隔 | 0.15〜0.3 |
| 座標系 | 親スロットからの相対座標 |

### 複数入力がある場合

Y軸で上下にずらして配置:

```typescript
// 入力1（上側）
await client.addSlot({ name: 'Input1', position: { x: -1.5, y: 0.15, z: 0 } });

// 入力2（下側）
await client.addSlot({ name: 'Input2', position: { x: -1.5, y: -0.15, z: 0 } });

// 処理ノード（中央）
await client.addSlot({ name: 'Process', position: { x: -1.0, y: 0, z: 0 } });
```

---

## ProtoFlux 変数ストレージの選択

### StoredObject vs DataModelObjectFieldStore

| 項目 | StoredObject\<T\> | DataModelObjectFieldStore\<T\> |
|------|-------------------|-------------------------------|
| 永続化 | ❌ セッション内のみ | ✅ ワールド保存時に永続化 |
| 用途 | 一時的な計算結果 | 保存が必要なデータ |
| コンテキスト | ExecutionContext | FrooxEngineContext |
| 型指定 | `StoredObject<string>` | `DataModelObjectFieldStore<string>` |

### DataModelObjectFieldStore を使う場合

`ObjectWrite` も FrooxEngineContext 版を使う必要がある:

```typescript
// ❌ 間違い - ExecutionContext 版
'[ProtoFluxBindings]...ObjectWrite<string>'

// ✅ 正解 - FrooxEngineContext 版
'[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,string>'
```

**ポイント**: 型パラメータに `[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext` を指定

---

## 非同期HTTPリクエスト (GET_String)

### 必要なノード構成

```
ButtonEvents.Pressed → StartAsyncTask → GET_String → ObjectWrite → DataModelObjectFieldStore
                                             ↓
                                        OnResponse → ObjectWrite実行
```

### コンポーネント型

| ノード | 型 |
|--------|-----|
| ButtonEvents | `[ProtoFluxBindings]...FrooxEngine.Interaction.ButtonEvents` |
| StartAsyncTask | `[ProtoFluxBindings]...FrooxEngine.Async.StartAsyncTask` |
| GET_String | `[ProtoFluxBindings]...FrooxEngine.Network.GET_String` |
| DataModelObjectFieldStore\<string\> | `[ProtoFluxBindings]...FrooxEngine.Variables.DataModelObjectFieldStore<string>` |
| ObjectWrite (FrooxEngineContext) | `[ProtoFluxBindings]...ObjectWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,string>` |

### 接続パターン

```typescript
// 1. ButtonEvents.Pressed → StartAsyncTask
await client.updateComponent({
  id: buttonEventsComp.id,
  members: { Pressed: { $type: 'reference', targetId: startAsyncComp.id } } as any,
});

// 2. StartAsyncTask.TaskStart → GET_String
await client.updateComponent({
  id: startAsyncComp.id,
  members: { TaskStart: { $type: 'reference', targetId: webRequestComp.id } } as any,
});

// 3. GET_String.OnResponse → ObjectWrite
const webRequestDetails = await client.getComponent(webRequestComp.id);
const onResponseId = webRequestDetails.data.members.OnResponse.id;
await client.updateComponent({
  id: webRequestComp.id,
  members: { OnResponse: { $type: 'reference', id: onResponseId, targetId: writeComp.id } } as any,
});

// 4. ObjectWrite.Value ← GET_String.Content
const contentId = webRequestDetails.data.members.Content.id;
await client.updateComponent({
  id: writeComp.id,
  members: { Value: { $type: 'reference', targetId: contentId } } as any,
});

// 5. ObjectWrite.Variable ← DataModelObjectFieldStore
await client.updateComponent({
  id: writeComp.id,
  members: { Variable: { $type: 'reference', targetId: storeComp.id } } as any,
});
```

### 手動設定が必要な項目

- **ButtonEvents.Button**: PhysicalButtonをドラッグして接続

---

## 注意事項

- システムスロット（Controllers, Roles, SpawnArea, Light, Skybox, Assets等）は削除しない
- Materials リストは2段階で更新（要素追加 → targetId設定）
- HSV_ToColorX は S, V 入力が null だと色が出ない（要 ValueInput 接続）
- Wiggler は floatQ（回転）のみ対応、float3（位置）は不可
- DataModelObjectFieldStoreを使う場合はFrooxEngineContext版のObjectWriteが必要
