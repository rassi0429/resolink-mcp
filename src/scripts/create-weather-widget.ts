/**
 * 東京の天気を取得してUIXに表示するウィジェット
 *
 * 使い方: npx tsx src/scripts/create-weather-widget.ts [ws://localhost:3343]
 *
 * 構造:
 * - UIXパネル: 天気表示
 * - 物理ボタン: 押すと天気取得
 * - ProtoFlux: ButtonEvents → StartAsyncTask → GET_String → ObjectFieldDrive → Text
 *
 * 注意: ButtonEventsのButton参照は手動設定が必要
 */
import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:3343';
const WEATHER_API_URL = 'https://wttr.in/Tokyo?format=3';

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Creating Weather Widget...\n');

    // 1. メインスロット作成
    const slotName = `WeatherWidget_${Date.now()}`;
    await client.addSlot({
      name: slotName,
      position: { x: 0, y: 1.5, z: 1.5 },
      isActive: true,
    });

    const mainSlot = await client.findSlotByName(slotName, 'Root', 1);
    if (!mainSlot?.id) throw new Error('Main slot not found');
    const mainId = mainSlot.id;
    console.log(`  Main slot: ${mainId}`);

    // Grabbable追加
    await client.addComponent({
      containerSlotId: mainId,
      componentType: '[FrooxEngine]FrooxEngine.Grabbable',
    });
    console.log('  Grabbable added');

    // ============================================================
    // UIX部分（scale 0.001）
    // ============================================================
    await client.addSlot({ parentId: mainId, name: 'UIXRoot' });
    let mainData = await client.getSlot({ slotId: mainId, depth: 1 });
    const uixRootSlot = mainData.data?.children?.find((c: any) => c.name?.value === 'UIXRoot');
    if (!uixRootSlot?.id) throw new Error('UIXRoot not found');
    const uixRootId = uixRootSlot.id;

    // UIXルートのスケールを0.001に
    await client.updateSlot({
      id: uixRootId,
      scale: { x: 0.001, y: 0.001, z: 0.001 },
    });

    // Canvas追加
    await client.addComponent({
      containerSlotId: uixRootId,
      componentType: '[FrooxEngine]FrooxEngine.UIX.Canvas',
    });

    // UI_UnlitMaterial追加（UIXの描画順を正しくするために必要）
    await client.addComponent({
      containerSlotId: uixRootId,
      componentType: '[FrooxEngine]FrooxEngine.UI_UnlitMaterial',
    });

    let uixRootData = await client.getSlot({ slotId: uixRootId, includeComponentData: true });
    const canvas = uixRootData.data?.components?.find((c: any) => c.componentType?.includes('Canvas'));
    const uiMaterial = uixRootData.data?.components?.find((c: any) => c.componentType?.includes('UI_UnlitMaterial'));
    if (canvas?.id) {
      await client.updateComponent({
        id: canvas.id,
        members: {
          Size: { $type: 'float2', value: { x: 400, y: 180 } },
        } as any,
      });
    }
    // UI_UnlitMaterial の設定（ZWrite, OffsetFactor, OffsetUnits, Sidedness）
    if (uiMaterial?.id) {
      await client.updateComponent({
        id: uiMaterial.id,
        members: {
          ZWrite: { $type: 'enum', value: 'On', enumType: 'ZWrite' },
          OffsetFactor: { $type: 'float', value: 1 },
          OffsetUnits: { $type: 'float', value: 100 },
          Sidedness: { $type: 'enum', value: 'Double', enumType: 'Sidedness' },
        } as any,
      });
    }
    console.log('  Canvas created');
    console.log('  UI_UnlitMaterial created');

    // 背景スロット
    await client.addSlot({ parentId: uixRootId, name: 'Background' });
    uixRootData = await client.getSlot({ slotId: uixRootId, depth: 1 });
    const bgSlot = uixRootData.data?.children?.find((c: any) => c.name?.value === 'Background');
    if (!bgSlot?.id) throw new Error('Background not found');
    const bgId = bgSlot.id;

    await client.addComponent({ containerSlotId: bgId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: bgId, componentType: '[FrooxEngine]FrooxEngine.UIX.Image' });

    let bgData = await client.getSlot({ slotId: bgId, includeComponentData: true });
    const bgRect = bgData.data?.components?.find((c: any) => c.componentType?.includes('RectTransform'));
    const bgImage = bgData.data?.components?.find((c: any) => c.componentType?.includes('Image'));

    if (bgRect?.id) {
      await client.updateComponent({
        id: bgRect.id,
        members: {
          AnchorMin: { $type: 'float2', value: { x: 0, y: 0 } },
          AnchorMax: { $type: 'float2', value: { x: 1, y: 1 } },
          OffsetMin: { $type: 'float2', value: { x: 0, y: 0 } },
          OffsetMax: { $type: 'float2', value: { x: 0, y: 0 } },
        } as any,
      });
    }
    if (bgImage?.id) {
      await client.updateComponent({
        id: bgImage.id,
        members: {
          Tint: { $type: 'colorX', value: { r: 0.1, g: 0.15, b: 0.25, a: 0.95 } },
          Material: { $type: 'reference', targetId: uiMaterial?.id },
        } as any,
      });
    }
    console.log('  Background created');

    // コンテンツエリア
    await client.addSlot({ parentId: uixRootId, name: 'Content' });
    uixRootData = await client.getSlot({ slotId: uixRootId, depth: 1 });
    const contentSlot = uixRootData.data?.children?.find((c: any) => c.name?.value === 'Content');
    if (!contentSlot?.id) throw new Error('Content not found');
    const contentId = contentSlot.id;

    await client.addComponent({ containerSlotId: contentId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: contentId, componentType: '[FrooxEngine]FrooxEngine.UIX.VerticalLayout' });

    let contentData = await client.getSlot({ slotId: contentId, includeComponentData: true });
    const contentRect = contentData.data?.components?.find((c: any) => c.componentType?.includes('RectTransform'));
    const vLayout = contentData.data?.components?.find((c: any) => c.componentType?.includes('VerticalLayout'));

    if (contentRect?.id) {
      await client.updateComponent({
        id: contentRect.id,
        members: {
          AnchorMin: { $type: 'float2', value: { x: 0, y: 0 } },
          AnchorMax: { $type: 'float2', value: { x: 1, y: 1 } },
          OffsetMin: { $type: 'float2', value: { x: 20, y: 20 } },
          OffsetMax: { $type: 'float2', value: { x: -20, y: -20 } },
        } as any,
      });
    }
    if (vLayout?.id) {
      await client.updateComponent({
        id: vLayout.id,
        members: {
          Spacing: { $type: 'float', value: 15 },
          PaddingTop: { $type: 'float', value: 10 },
          ForceExpandWidth: { $type: 'bool', value: true },
          ForceExpandHeight: { $type: 'bool', value: false },
        } as any,
      });
    }

    // タイトル
    await client.addSlot({ parentId: contentId, name: 'Title' });
    contentData = await client.getSlot({ slotId: contentId, depth: 1 });
    const titleSlot = contentData.data?.children?.find((c: any) => c.name?.value === 'Title');
    if (!titleSlot?.id) throw new Error('Title not found');
    const titleId = titleSlot.id;

    await client.addComponent({ containerSlotId: titleId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: titleId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: titleId, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

    let titleData = await client.getSlot({ slotId: titleId, includeComponentData: true });
    const titleLayout = titleData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
    const titleText = titleData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

    if (titleLayout?.id) {
      await client.updateComponent({
        id: titleLayout.id,
        members: { PreferredHeight: { $type: 'float', value: 40 } } as any,
      });
    }
    if (titleText?.id) {
      await client.updateComponent({
        id: titleText.id,
        members: {
          Content: { $type: 'string', value: '東京の天気' },
          Size: { $type: 'float', value: 28 },
          Color: { $type: 'colorX', value: { r: 1, g: 1, b: 1, a: 1 } },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
        } as any,
      });
    }
    console.log('  Title created');

    // 天気表示エリア（背景）
    // 注意: ImageとTextを同じスロットに置くとZ-Fightするので別スロットにする
    await client.addSlot({ parentId: contentId, name: 'WeatherDisplay' });
    contentData = await client.getSlot({ slotId: contentId, depth: 1 });
    const weatherSlot = contentData.data?.children?.find((c: any) => c.name?.value === 'WeatherDisplay');
    if (!weatherSlot?.id) throw new Error('WeatherDisplay not found');
    const weatherId = weatherSlot.id;

    await client.addComponent({ containerSlotId: weatherId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: weatherId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: weatherId, componentType: '[FrooxEngine]FrooxEngine.UIX.Image' });

    let weatherData = await client.getSlot({ slotId: weatherId, includeComponentData: true });
    const weatherLayout = weatherData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
    const weatherBg = weatherData.data?.components?.find((c: any) => c.componentType?.includes('Image'));

    if (weatherLayout?.id) {
      await client.updateComponent({
        id: weatherLayout.id,
        members: { PreferredHeight: { $type: 'float', value: 60 } } as any,
      });
    }
    if (weatherBg?.id) {
      await client.updateComponent({
        id: weatherBg.id,
        members: {
          Tint: { $type: 'colorX', value: { r: 0.2, g: 0.25, b: 0.35, a: 0.8 } },
        } as any,
      });
    }

    // 天気表示テキスト（別スロット）
    await client.addSlot({ parentId: weatherId, name: 'WeatherText' });
    weatherData = await client.getSlot({ slotId: weatherId, depth: 1 });
    const weatherTextSlot = weatherData.data?.children?.find((c: any) => c.name?.value === 'WeatherText');
    if (!weatherTextSlot?.id) throw new Error('WeatherText not found');
    const weatherTextId = weatherTextSlot.id;

    await client.addComponent({ containerSlotId: weatherTextId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: weatherTextId, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

    const weatherTextData = await client.getSlot({ slotId: weatherTextId, includeComponentData: true });
    const weatherTextRect = weatherTextData.data?.components?.find((c: any) => c.componentType?.includes('RectTransform'));
    const weatherText = weatherTextData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

    // RectTransformを親に合わせる
    if (weatherTextRect?.id) {
      await client.updateComponent({
        id: weatherTextRect.id,
        members: {
          AnchorMin: { $type: 'float2', value: { x: 0, y: 0 } },
          AnchorMax: { $type: 'float2', value: { x: 1, y: 1 } },
          OffsetMin: { $type: 'float2', value: { x: 0, y: 0 } },
          OffsetMax: { $type: 'float2', value: { x: 0, y: 0 } },
        } as any,
      });
    }
    if (weatherText?.id) {
      await client.updateComponent({
        id: weatherText.id,
        members: {
          Content: { $type: 'string', value: 'ボタンを押して取得' },
          Size: { $type: 'float', value: 22 },
          Color: { $type: 'colorX', value: { r: 0.8, g: 0.9, b: 1, a: 1 } },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
          VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
        } as any,
      });
    }
    console.log('  Weather display created');

    // ============================================================
    // 物理ボタン
    // ============================================================
    await client.addSlot({
      parentId: mainId,
      name: 'Button',
      position: { x: 0, y: -0.12, z: 0.02 },
    });
    mainData = await client.getSlot({ slotId: mainId, depth: 1 });
    const buttonSlot = mainData.data?.children?.find((c: any) => c.name?.value === 'Button');
    if (!buttonSlot?.id) throw new Error('Button not found');
    const buttonId = buttonSlot.id;

    await client.addComponent({ containerSlotId: buttonId, componentType: '[FrooxEngine]FrooxEngine.BoxMesh' });
    await client.addComponent({ containerSlotId: buttonId, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
    await client.addComponent({ containerSlotId: buttonId, componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic' });
    await client.addComponent({ containerSlotId: buttonId, componentType: '[FrooxEngine]FrooxEngine.BoxCollider' });
    await client.addComponent({ containerSlotId: buttonId, componentType: '[FrooxEngine]FrooxEngine.PhysicalButton' });

    let buttonData = await client.getSlot({ slotId: buttonId, includeComponentData: true });
    const boxMesh = buttonData.data?.components?.find((c: any) => c.componentType?.includes('BoxMesh'));
    const meshRenderer = buttonData.data?.components?.find((c: any) => c.componentType?.includes('MeshRenderer'));
    const material = buttonData.data?.components?.find((c: any) => c.componentType?.includes('PBS_Metallic'));
    const boxCollider = buttonData.data?.components?.find((c: any) => c.componentType?.includes('BoxCollider'));
    const physicalButton = buttonData.data?.components?.find((c: any) => c.componentType?.includes('PhysicalButton'));

    // BoxMesh設定
    if (boxMesh?.id) {
      await client.updateComponent({
        id: boxMesh.id,
        members: {
          Size: { $type: 'float3', value: { x: 0.15, y: 0.04, z: 0.06 } },
        } as any,
      });
    }

    // BoxCollider設定
    if (boxCollider?.id) {
      await client.updateComponent({
        id: boxCollider.id,
        members: {
          Size: { $type: 'float3', value: { x: 0.15, y: 0.04, z: 0.06 } },
        } as any,
      });
    }

    // マテリアル設定
    if (material?.id) {
      await client.updateComponent({
        id: material.id,
        members: {
          AlbedoColor: { $type: 'colorX', value: { r: 0.2, g: 0.5, b: 0.8, a: 1 } },
          Smoothness: { $type: 'float', value: 0.7 },
          Metallic: { $type: 'float', value: 0.3 },
        } as any,
      });
    }

    // MeshRenderer設定（Materials接続）
    if (meshRenderer?.id && boxMesh?.id && material?.id) {
      // Mesh参照設定
      await client.updateComponent({
        id: meshRenderer.id,
        members: {
          Mesh: { $type: 'reference', targetId: boxMesh.id },
        } as any,
      });

      // Materials リスト追加（2段階）
      await client.updateComponent({
        id: meshRenderer.id,
        members: {
          Materials: {
            $type: 'list',
            elements: [{ $type: 'reference', targetId: material.id }],
          },
        } as any,
      });

      const rendererData = await client.getComponent(meshRenderer.id);
      const elementId = rendererData.data.members.Materials?.elements?.[0]?.id;
      if (elementId) {
        await client.updateComponent({
          id: meshRenderer.id,
          members: {
            Materials: {
              $type: 'list',
              elements: [{ $type: 'reference', id: elementId, targetId: material.id }],
            },
          } as any,
        });
      }
    }

    // PhysicalButton設定
    if (physicalButton?.id) {
      await client.updateComponent({
        id: physicalButton.id,
        members: {
          PressAxis: { $type: 'float3', value: { x: 0, y: 0, z: -1 } },
          PressDepth: { $type: 'float', value: 0.02 },
        } as any,
      });
    }
    console.log('  Physical button created');

    // ============================================================
    // ProtoFlux
    // ============================================================
    await client.addSlot({ parentId: mainId, name: 'Flux' });
    mainData = await client.getSlot({ slotId: mainId, depth: 1 });
    const fluxSlot = mainData.data?.children?.find((c: any) => c.name?.value === 'Flux');
    if (!fluxSlot?.id) throw new Error('Flux not found');
    const fluxId = fluxSlot.id;

    // ProtoFluxノード用スロット作成
    // フロー: ButtonEvents → LoadingWrite → StartAsyncTask → GET_String → Write
    const fluxNodes = [
      { name: 'GlobalRef', pos: { x: -0.9, y: 0, z: 0 } },
      { name: 'ButtonEvents', pos: { x: -0.75, y: 0, z: 0 } },
      { name: 'LoadingText', pos: { x: -0.6, y: -0.15, z: 0 } },  // 「取得中...」固定値
      { name: 'LoadingWrite', pos: { x: -0.45, y: 0, z: 0 } },    // 取得中を書き込む
      { name: 'StartAsyncTask', pos: { x: -0.3, y: 0, z: 0 } },
      { name: 'GET_String', pos: { x: 0, y: 0, z: 0 } },
      { name: 'Store', pos: { x: 0.3, y: -0.1, z: 0 } },
      { name: 'Write', pos: { x: 0.3, y: 0, z: 0 } },
      { name: 'FieldDrive', pos: { x: 0.6, y: 0, z: 0 } },
      { name: 'URLStore', pos: { x: -0.15, y: 0.15, z: 0 } },
      { name: 'StringToUri', pos: { x: 0, y: 0.15, z: 0 } },
    ];

    for (const node of fluxNodes) {
      await client.addSlot({ parentId: fluxId, name: node.name, position: node.pos });
    }

    let fluxData = await client.getSlot({ slotId: fluxId, depth: 1 });
    const getFluxChild = (name: string) => fluxData.data?.children?.find((c: any) => c.name?.value === name);

    const globalRefSlot = getFluxChild('GlobalRef');
    const buttonEventsSlot = getFluxChild('ButtonEvents');
    const loadingTextSlot = getFluxChild('LoadingText');
    const loadingWriteSlot = getFluxChild('LoadingWrite');
    const startAsyncSlot = getFluxChild('StartAsyncTask');
    const getStringSlot = getFluxChild('GET_String');
    const storeSlot = getFluxChild('Store');
    const writeSlot = getFluxChild('Write');
    const fieldDriveSlot = getFluxChild('FieldDrive');
    const urlStoreSlot = getFluxChild('URLStore');
    const stringToUriSlot = getFluxChild('StringToUri');

    // コンポーネント追加
    // GlobalReference<IButton> (ButtonEventsとPhysicalButtonを繋ぐ)
    await client.addComponent({
      containerSlotId: globalRefSlot.id,
      componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IButton>',
    });
    await client.addComponent({
      containerSlotId: buttonEventsSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Interaction.ButtonEvents',
    });
    // 「取得中...」固定値
    await client.addComponent({
      containerSlotId: loadingTextSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Variables.DataModelObjectFieldStore<string>',
    });
    // 取得中を書き込むObjectWrite
    await client.addComponent({
      containerSlotId: loadingWriteSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,string>',
    });
    await client.addComponent({
      containerSlotId: startAsyncSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Async.StartAsyncTask',
    });
    await client.addComponent({
      containerSlotId: getStringSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Network.GET_String',
    });
    await client.addComponent({
      containerSlotId: storeSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Variables.DataModelObjectFieldStore<string>',
    });
    await client.addComponent({
      containerSlotId: writeSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,string>',
    });
    await client.addComponent({
      containerSlotId: fieldDriveSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectFieldDrive<string>',
    });
    // URL格納用 (DataModelObjectFieldStore<string>でURLを保持)
    await client.addComponent({
      containerSlotId: urlStoreSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Variables.DataModelObjectFieldStore<string>',
    });
    // String → Uri 変換
    await client.addComponent({
      containerSlotId: stringToUriSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Utility.Uris.StringToAbsoluteURI',
    });
    console.log('  ProtoFlux nodes created');

    // コンポーネントID取得
    const [
      globalRefData,
      buttonEventsData,
      loadingTextData,
      loadingWriteData,
      startAsyncData,
      getStringData,
      storeData,
      writeData,
      fieldDriveData,
      urlStoreData,
      stringToUriData,
    ] = await Promise.all([
      client.getSlot({ slotId: globalRefSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: buttonEventsSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: loadingTextSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: loadingWriteSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: startAsyncSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: getStringSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: storeSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: writeSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: fieldDriveSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: urlStoreSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: stringToUriSlot.id, includeComponentData: true }),
    ]);

    const globalRefComp = globalRefData.data?.components?.find((c: any) => c.componentType?.includes('GlobalReference'));
    const buttonEventsComp = buttonEventsData.data?.components?.find((c: any) => c.componentType?.includes('ButtonEvents'));
    const loadingTextComp = loadingTextData.data?.components?.find((c: any) => c.componentType?.includes('DataModelObjectFieldStore'));
    const loadingWriteComp = loadingWriteData.data?.components?.find((c: any) => c.componentType?.includes('ObjectWrite'));
    const startAsyncComp = startAsyncData.data?.components?.find((c: any) => c.componentType?.includes('StartAsyncTask'));
    const getStringComp = getStringData.data?.components?.find((c: any) => c.componentType?.includes('GET_String'));
    const storeComp = storeData.data?.components?.find((c: any) => c.componentType?.includes('DataModelObjectFieldStore'));
    const writeComp = writeData.data?.components?.find((c: any) => c.componentType?.includes('ObjectWrite'));
    const fieldDriveComp = fieldDriveData.data?.components?.find((c: any) => c.componentType?.includes('ObjectFieldDrive'));
    const proxyComp = fieldDriveData.data?.components?.find((c: any) => c.componentType?.includes('Proxy'));
    const urlStoreComp = urlStoreData.data?.components?.find((c: any) => c.componentType?.includes('DataModelObjectFieldStore'));
    const stringToUriComp = stringToUriData.data?.components?.find((c: any) => c.componentType?.includes('StringToAbsoluteURI'));

    // URLStore に URL を設定（Storeコンポーネント経由）
    // DataModelObjectFieldStoreをアタッチすると、自動的に+Storeコンポーネントが生成される
    // 再取得してStoreを探す（+Store で検索）
    const urlStoreDataRefresh = await client.getSlot({ slotId: urlStoreSlot.id, includeComponentData: true });
    const urlStoreProxyComp = urlStoreDataRefresh.data?.components?.find((c: any) => c.componentType?.includes('+Store'));
    if (urlStoreProxyComp?.id) {
      await client.updateComponent({
        id: urlStoreProxyComp.id,
        members: {
          Value: { $type: 'string', value: WEATHER_API_URL },
        } as any,
      });
      console.log('  URLStore set: ' + WEATHER_API_URL);
    } else {
      console.log('  [WARN] URLStore Proxy not found - set URL manually');
    }

    // LoadingText に「取得中...」を設定（+Storeコンポーネント経由）
    const loadingTextDataRefresh = await client.getSlot({ slotId: loadingTextSlot.id, includeComponentData: true });
    const loadingTextProxyComp = loadingTextDataRefresh.data?.components?.find((c: any) => c.componentType?.includes('+Store'));
    if (loadingTextProxyComp?.id) {
      await client.updateComponent({
        id: loadingTextProxyComp.id,
        members: {
          Value: { $type: 'string', value: '取得中...' },
        } as any,
      });
      console.log('  LoadingText set: 取得中...');
    }

    // 接続: StringToAbsoluteURI.Input ← URLStore
    if (stringToUriComp?.id && urlStoreComp?.id) {
      await client.updateComponent({
        id: stringToUriComp.id,
        members: {
          Input: { $type: 'reference', targetId: urlStoreComp.id },
        } as any,
      });
      console.log('  StringToAbsoluteURI.Input ← URLStore');
    }

    // 接続: LoadingWrite.Value ← LoadingText
    if (loadingWriteComp?.id && loadingTextComp?.id) {
      await client.updateComponent({
        id: loadingWriteComp.id,
        members: {
          Value: { $type: 'reference', targetId: loadingTextComp.id },
        } as any,
      });
      console.log('  LoadingWrite.Value ← LoadingText');
    }

    // 接続: LoadingWrite.Variable ← Store（表示用）
    if (loadingWriteComp?.id && storeComp?.id) {
      await client.updateComponent({
        id: loadingWriteComp.id,
        members: {
          Variable: { $type: 'reference', targetId: storeComp.id },
        } as any,
      });
      console.log('  LoadingWrite.Variable ← Store');
    }

    // 接続: GlobalReference.Reference → PhysicalButton
    if (globalRefComp?.id && physicalButton?.id) {
      await client.updateComponent({
        id: globalRefComp.id,
        members: {
          Reference: { $type: 'reference', targetId: physicalButton.id },
        } as any,
      });
      console.log('  GlobalReference.Reference → PhysicalButton');
    }

    // 接続: ButtonEvents.Button → GlobalReference
    if (buttonEventsComp?.id && globalRefComp?.id) {
      await client.updateComponent({
        id: buttonEventsComp.id,
        members: {
          Button: { $type: 'reference', targetId: globalRefComp.id },
        } as any,
      });
      console.log('  ButtonEvents.Button → GlobalReference');
    }

    // 接続: ButtonEvents.Pressed → LoadingWrite（まず「取得中...」を表示）
    if (buttonEventsComp?.id && loadingWriteComp?.id) {
      await client.updateComponent({
        id: buttonEventsComp.id,
        members: {
          Pressed: { $type: 'reference', targetId: loadingWriteComp.id },
        } as any,
      });
      console.log('  ButtonEvents.Pressed → LoadingWrite');
    }

    // 接続: LoadingWrite.OnWritten → StartAsyncTask（取得中表示後にリクエスト開始）
    if (loadingWriteComp?.id && startAsyncComp?.id) {
      const loadingWriteDetails = await client.getComponent(loadingWriteComp.id);
      const onWrittenId = loadingWriteDetails.data?.members?.OnWritten?.id;
      if (onWrittenId) {
        await client.updateComponent({
          id: loadingWriteComp.id,
          members: {
            OnWritten: { $type: 'reference', id: onWrittenId, targetId: startAsyncComp.id },
          } as any,
        });
        console.log('  LoadingWrite.OnWritten → StartAsyncTask');
      }
    }

    // 接続: StartAsyncTask.TaskStart → GET_String
    if (startAsyncComp?.id && getStringComp?.id) {
      await client.updateComponent({
        id: startAsyncComp.id,
        members: {
          TaskStart: { $type: 'reference', targetId: getStringComp.id },
        } as any,
      });
      console.log('  StartAsyncTask.TaskStart → GET_String');
    }

    // 接続: GET_String.URL ← StringToAbsoluteURI
    if (getStringComp?.id && stringToUriComp?.id) {
      await client.updateComponent({
        id: getStringComp.id,
        members: {
          URL: { $type: 'reference', targetId: stringToUriComp.id },
        } as any,
      });
      console.log('  GET_String.URL ← StringToAbsoluteURI');
    }

    // 接続: GET_String.OnResponse → ObjectWrite
    if (getStringComp?.id && writeComp?.id) {
      const getStringDetails = await client.getComponent(getStringComp.id);
      const onResponseId = getStringDetails.data.members.OnResponse?.id;
      if (onResponseId) {
        await client.updateComponent({
          id: getStringComp.id,
          members: {
            OnResponse: { $type: 'reference', id: onResponseId, targetId: writeComp.id },
          } as any,
        });
        console.log('  GET_String.OnResponse → ObjectWrite');
      }

      // 接続: ObjectWrite.Value ← GET_String.Content
      const contentId = getStringDetails.data.members.Content?.id;
      if (contentId && writeComp?.id) {
        await client.updateComponent({
          id: writeComp.id,
          members: {
            Value: { $type: 'reference', targetId: contentId },
          } as any,
        });
        console.log('  ObjectWrite.Value ← GET_String.Content');
      }
    }

    // 接続: ObjectWrite.Variable ← DataModelObjectFieldStore
    if (writeComp?.id && storeComp?.id) {
      await client.updateComponent({
        id: writeComp.id,
        members: {
          Variable: { $type: 'reference', targetId: storeComp.id },
        } as any,
      });
      console.log('  ObjectWrite.Variable ← Store');
    }

    // 接続: ObjectFieldDrive.Value ← Store
    if (fieldDriveComp?.id && storeComp?.id) {
      await client.updateComponent({
        id: fieldDriveComp.id,
        members: {
          Value: { $type: 'reference', targetId: storeComp.id },
        } as any,
      });
      console.log('  ObjectFieldDrive.Value ← Store');
    }

    // 接続: ObjectFieldDrive.Drive → Text.Content
    if (proxyComp?.id && weatherText?.id) {
      // Text.ContentのフィールドIDを取得
      const textDetails = await client.getComponent(weatherText.id);
      const contentFieldId = textDetails.data.members.Content?.id;

      // Proxy.DriveのIDを取得
      const proxyDetails = await client.getComponent(proxyComp.id);
      const driveId = proxyDetails.data.members.Drive?.id;

      if (contentFieldId && driveId) {
        await client.updateComponent({
          id: proxyComp.id,
          members: {
            Drive: { $type: 'reference', id: driveId, targetId: contentFieldId },
          } as any,
        });
        console.log('  ObjectFieldDrive.Drive → Text.Content');
      }
    }

    console.log('\n========================================');
    console.log('Weather Widget created!');
    console.log(`  Location: ${slotName}`);
    console.log('\nボタンを押すと東京の天気を取得して表示します');
    console.log('========================================');

  } finally {
    client.disconnect();
  }
}

main();
