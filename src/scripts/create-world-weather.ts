/**
 * 世界の都市の天気を表示するUIXウィジェット
 *
 * 使い方: npx tsx src/scripts/create-world-weather.ts [ws://localhost:3343]
 *
 * 構造:
 * - UIXパネル: 複数都市の天気表示
 * - UIXボタン: 更新ボタン
 * - ProtoFlux: DynamicImpulseReceiver → 各都市のGET_String
 */
import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:3343';

// 都市設定（UTCからのオフセット時間）
const CITIES = [
  { name: '東京', query: 'Tokyo', offset: 9 },
  { name: 'ニューヨーク', query: 'New+York', offset: -5 },
  { name: 'ロンドン', query: 'London', offset: 0 },
  { name: 'パリ', query: 'Paris', offset: 1 },
  { name: 'シドニー', query: 'Sydney', offset: 11 },
];

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Creating World Weather Widget...\n');

    // 1. メインスロット作成
    const slotName = `WorldWeather_${Date.now()}`;
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

    // ============================================================
    // UIX部分
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

    // UI_UnlitMaterial追加
    await client.addComponent({
      containerSlotId: uixRootId,
      componentType: '[FrooxEngine]FrooxEngine.UI_UnlitMaterial',
    });

    let uixRootData = await client.getSlot({ slotId: uixRootId, includeComponentData: true });
    const canvas = uixRootData.data?.components?.find((c: any) => c.componentType?.includes('Canvas'));
    const uiMaterial = uixRootData.data?.components?.find((c: any) => c.componentType?.includes('UI_UnlitMaterial'));

    // Canvas設定
    if (canvas?.id) {
      await client.updateComponent({
        id: canvas.id,
        members: {
          Size: { $type: 'float2', value: { x: 500, y: 400 } },
        } as any,
      });
    }

    // UI_UnlitMaterial設定
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
    console.log('  Canvas & UI_UnlitMaterial created');

    // 背景
    await client.addSlot({ parentId: uixRootId, name: 'Background' });
    uixRootData = await client.getSlot({ slotId: uixRootId, depth: 1 });
    const bgSlot = uixRootData.data?.children?.find((c: any) => c.name?.value === 'Background');
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
          Tint: { $type: 'colorX', value: { r: 0.08, g: 0.1, b: 0.15, a: 0.95 } },
          Material: { $type: 'reference', targetId: uiMaterial?.id },
        } as any,
      });
    }
    console.log('  Background created');

    // コンテンツエリア
    await client.addSlot({ parentId: uixRootId, name: 'Content' });
    uixRootData = await client.getSlot({ slotId: uixRootId, depth: 1 });
    const contentSlot = uixRootData.data?.children?.find((c: any) => c.name?.value === 'Content');
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
          OffsetMin: { $type: 'float2', value: { x: 15, y: 15 } },
          OffsetMax: { $type: 'float2', value: { x: -15, y: -15 } },
        } as any,
      });
    }
    if (vLayout?.id) {
      await client.updateComponent({
        id: vLayout.id,
        members: {
          Spacing: { $type: 'float', value: 8 },
          PaddingTop: { $type: 'float', value: 10 },
          PaddingBottom: { $type: 'float', value: 10 },
          ForceExpandWidth: { $type: 'bool', value: true },
          ForceExpandHeight: { $type: 'bool', value: false },
        } as any,
      });
    }

    // タイトル
    await client.addSlot({ parentId: contentId, name: 'Title' });
    contentData = await client.getSlot({ slotId: contentId, depth: 1 });
    const titleSlot = contentData.data?.children?.find((c: any) => c.name?.value === 'Title');
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
        members: { PreferredHeight: { $type: 'float', value: 45 } } as any,
      });
    }
    if (titleText?.id) {
      await client.updateComponent({
        id: titleText.id,
        members: {
          Content: { $type: 'string', value: '世界の天気' },
          Size: { $type: 'float', value: 32 },
          Color: { $type: 'colorX', value: { r: 1, g: 1, b: 1, a: 1 } },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
        } as any,
      });
    }
    console.log('  Title created');

    // 各都市の行を作成
    const cityTextIds: { [key: string]: string } = {};
    const cityTimeIds: { [key: string]: string } = {};

    for (const city of CITIES) {
      await client.addSlot({ parentId: contentId, name: `City_${city.query}` });
      contentData = await client.getSlot({ slotId: contentId, depth: 1 });
      const citySlot = contentData.data?.children?.find((c: any) => c.name?.value === `City_${city.query}`);
      const cityId = citySlot.id;

      await client.addComponent({ containerSlotId: cityId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
      await client.addComponent({ containerSlotId: cityId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
      await client.addComponent({ containerSlotId: cityId, componentType: '[FrooxEngine]FrooxEngine.UIX.HorizontalLayout' });

      let cityData = await client.getSlot({ slotId: cityId, includeComponentData: true });
      const cityLayout = cityData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
      const hLayout = cityData.data?.components?.find((c: any) => c.componentType?.includes('HorizontalLayout'));

      if (cityLayout?.id) {
        await client.updateComponent({
          id: cityLayout.id,
          members: { PreferredHeight: { $type: 'float', value: 40 } } as any,
        });
      }
      if (hLayout?.id) {
        await client.updateComponent({
          id: hLayout.id,
          members: {
            Spacing: { $type: 'float', value: 10 },
            ForceExpandWidth: { $type: 'bool', value: true },
            ForceExpandHeight: { $type: 'bool', value: true },
          } as any,
        });
      }

      // 都市名
      await client.addSlot({ parentId: cityId, name: 'CityName' });
      cityData = await client.getSlot({ slotId: cityId, depth: 1 });
      const cityNameSlot = cityData.data?.children?.find((c: any) => c.name?.value === 'CityName');

      await client.addComponent({ containerSlotId: cityNameSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
      await client.addComponent({ containerSlotId: cityNameSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
      await client.addComponent({ containerSlotId: cityNameSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

      let nameData = await client.getSlot({ slotId: cityNameSlot.id, includeComponentData: true });
      const nameLayout = nameData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
      const nameText = nameData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

      if (nameLayout?.id) {
        await client.updateComponent({
          id: nameLayout.id,
          members: { PreferredWidth: { $type: 'float', value: 130 } } as any,
        });
      }
      if (nameText?.id) {
        await client.updateComponent({
          id: nameText.id,
          members: {
            Content: { $type: 'string', value: city.name },
            Size: { $type: 'float', value: 22 },
            Color: { $type: 'colorX', value: { r: 0.9, g: 0.95, b: 1, a: 1 } },
            HorizontalAlign: { $type: 'enum', value: 'Left', enumType: 'TextHorizontalAlignment' },
            VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
          } as any,
        });
      }

      // 時間表示
      await client.addSlot({ parentId: cityId, name: 'Time' });
      cityData = await client.getSlot({ slotId: cityId, depth: 1 });
      const timeSlot = cityData.data?.children?.find((c: any) => c.name?.value === 'Time');

      await client.addComponent({ containerSlotId: timeSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
      await client.addComponent({ containerSlotId: timeSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
      await client.addComponent({ containerSlotId: timeSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

      let timeData = await client.getSlot({ slotId: timeSlot.id, includeComponentData: true });
      const timeLayout = timeData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
      const timeText = timeData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

      if (timeLayout?.id) {
        await client.updateComponent({
          id: timeLayout.id,
          members: { PreferredWidth: { $type: 'float', value: 80 } } as any,
        });
      }
      if (timeText?.id) {
        await client.updateComponent({
          id: timeText.id,
          members: {
            Content: { $type: 'string', value: '--:--' },
            Size: { $type: 'float', value: 18 },
            Color: { $type: 'colorX', value: { r: 0.9, g: 0.9, b: 0.7, a: 1 } },
            HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
            VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
          } as any,
        });
        cityTimeIds[city.query] = timeText.id;
      }

      // 天気表示
      await client.addSlot({ parentId: cityId, name: 'Weather' });
      cityData = await client.getSlot({ slotId: cityId, depth: 1 });
      const weatherSlot = cityData.data?.children?.find((c: any) => c.name?.value === 'Weather');

      await client.addComponent({ containerSlotId: weatherSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
      await client.addComponent({ containerSlotId: weatherSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
      await client.addComponent({ containerSlotId: weatherSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

      let weatherData = await client.getSlot({ slotId: weatherSlot.id, includeComponentData: true });
      const weatherLayout = weatherData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
      const weatherText = weatherData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

      if (weatherLayout?.id) {
        await client.updateComponent({
          id: weatherLayout.id,
          members: { FlexibleWidth: { $type: 'float', value: 1 } } as any,
        });
      }
      if (weatherText?.id) {
        await client.updateComponent({
          id: weatherText.id,
          members: {
            Content: { $type: 'string', value: '---' },
            Size: { $type: 'float', value: 20 },
            Color: { $type: 'colorX', value: { r: 0.7, g: 0.85, b: 1, a: 1 } },
            HorizontalAlign: { $type: 'enum', value: 'Left', enumType: 'TextHorizontalAlignment' },
            VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
          } as any,
        });
        cityTextIds[city.query] = weatherText.id;
      }

      console.log(`  City row created: ${city.name}`);
    }

    // 更新ボタン
    await client.addSlot({ parentId: contentId, name: 'RefreshButton' });
    contentData = await client.getSlot({ slotId: contentId, depth: 1 });
    const btnSlot = contentData.data?.children?.find((c: any) => c.name?.value === 'RefreshButton');
    const btnId = btnSlot.id;

    await client.addComponent({ containerSlotId: btnId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: btnId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: btnId, componentType: '[FrooxEngine]FrooxEngine.UIX.Image' });
    await client.addComponent({ containerSlotId: btnId, componentType: '[FrooxEngine]FrooxEngine.UIX.Button' });
    await client.addComponent({ containerSlotId: btnId, componentType: '[FrooxEngine]FrooxEngine.ButtonDynamicImpulseTrigger' });

    let btnData = await client.getSlot({ slotId: btnId, includeComponentData: true });
    const btnLayout = btnData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
    const btnImage = btnData.data?.components?.find((c: any) => c.componentType?.includes('Image'));
    const btnButton = btnData.data?.components?.find((c: any) => c.componentType?.includes('Button') && !c.componentType?.includes('Trigger'));
    const btnTrigger = btnData.data?.components?.find((c: any) => c.componentType?.includes('ButtonDynamicImpulseTrigger'));

    if (btnLayout?.id) {
      await client.updateComponent({
        id: btnLayout.id,
        members: { PreferredHeight: { $type: 'float', value: 50 } } as any,
      });
    }
    if (btnImage?.id) {
      await client.updateComponent({
        id: btnImage.id,
        members: {
          Tint: { $type: 'colorX', value: { r: 0.2, g: 0.4, b: 0.7, a: 1 } },
        } as any,
      });
    }
    if (btnTrigger?.id) {
      await client.updateComponent({
        id: btnTrigger.id,
        members: {
          PressedTag: { $type: 'string', value: 'RefreshWeather' },
        } as any,
      });
    }

    // ボタンテキスト
    await client.addSlot({ parentId: btnId, name: 'ButtonText' });
    btnData = await client.getSlot({ slotId: btnId, depth: 1 });
    const btnTextSlot = btnData.data?.children?.find((c: any) => c.name?.value === 'ButtonText');

    await client.addComponent({ containerSlotId: btnTextSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: btnTextSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

    let btnTextData = await client.getSlot({ slotId: btnTextSlot.id, includeComponentData: true });
    const btnTextRect = btnTextData.data?.components?.find((c: any) => c.componentType?.includes('RectTransform'));
    const btnText = btnTextData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

    if (btnTextRect?.id) {
      await client.updateComponent({
        id: btnTextRect.id,
        members: {
          AnchorMin: { $type: 'float2', value: { x: 0, y: 0 } },
          AnchorMax: { $type: 'float2', value: { x: 1, y: 1 } },
          OffsetMin: { $type: 'float2', value: { x: 0, y: 0 } },
          OffsetMax: { $type: 'float2', value: { x: 0, y: 0 } },
        } as any,
      });
    }
    if (btnText?.id) {
      await client.updateComponent({
        id: btnText.id,
        members: {
          Content: { $type: 'string', value: '更新' },
          Size: { $type: 'float', value: 26 },
          Color: { $type: 'colorX', value: { r: 1, g: 1, b: 1, a: 1 } },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
          VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
        } as any,
      });
    }
    console.log('  Refresh button created');

    // ============================================================
    // ProtoFlux
    // ============================================================
    await client.addSlot({ parentId: mainId, name: 'Flux' });
    mainData = await client.getSlot({ slotId: mainId, depth: 1 });
    const fluxSlot = mainData.data?.children?.find((c: any) => c.name?.value === 'Flux');
    const fluxId = fluxSlot.id;

    // Tag用のGlobalValue<string>を作成
    await client.addSlot({ parentId: fluxId, name: 'TagValue', position: { x: -1.2, y: 0.2, z: 0 } });
    // UtcNow（共有）
    await client.addSlot({ parentId: fluxId, name: 'UtcNow', position: { x: -1.5, y: 0.5, z: 0 } });

    let fluxData = await client.getSlot({ slotId: fluxId, depth: 1 });
    const tagSlot = fluxData.data?.children?.find((c: any) => c.name?.value === 'TagValue');
    const utcNowSlot = fluxData.data?.children?.find((c: any) => c.name?.value === 'UtcNow');

    await client.addComponent({
      containerSlotId: tagSlot.id,
      componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalValue<string>',
    });
    await client.addComponent({
      containerSlotId: utcNowSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.TimeAndDate.UtcNow',
    });

    const tagData = await client.getSlot({ slotId: tagSlot.id, includeComponentData: true });
    const utcNowData = await client.getSlot({ slotId: utcNowSlot.id, includeComponentData: true });
    const tagComp = tagData.data?.components?.find((c: any) => c.componentType?.includes('GlobalValue'));
    const utcNowComp = utcNowData.data?.components?.find((c: any) => c.componentType?.includes('UtcNow'));

    // Tag値設定
    if (tagComp?.id) {
      await client.updateComponent({
        id: tagComp.id,
        members: {
          Value: { $type: 'string', value: 'RefreshWeather' },
        } as any,
      });
    }
    console.log('  TagValue & UtcNow created');

    // 各都市のProtoFluxノード作成
    const cityFluxData: { [key: string]: any } = {};

    for (let i = 0; i < CITIES.length; i++) {
      const city = CITIES[i];
      const xOffset = -0.6 + i * 0.4;
      const yBase = -0.3;

      // 各都市用のスロット（Receiverを追加）
      await client.addSlot({ parentId: fluxId, name: `Receiver_${city.query}`, position: { x: xOffset, y: yBase + 0.2, z: 0 } });
      await client.addSlot({ parentId: fluxId, name: `Async_${city.query}`, position: { x: xOffset, y: yBase, z: 0 } });
      await client.addSlot({ parentId: fluxId, name: `GET_${city.query}`, position: { x: xOffset, y: yBase - 0.2, z: 0 } });
      await client.addSlot({ parentId: fluxId, name: `Store_${city.query}`, position: { x: xOffset, y: yBase - 0.4, z: 0 } });
      await client.addSlot({ parentId: fluxId, name: `Write_${city.query}`, position: { x: xOffset, y: yBase - 0.6, z: 0 } });
      await client.addSlot({ parentId: fluxId, name: `Drive_${city.query}`, position: { x: xOffset, y: yBase - 0.8, z: 0 } });
      await client.addSlot({ parentId: fluxId, name: `URL_${city.query}`, position: { x: xOffset - 0.15, y: yBase - 0.1, z: 0 } });
      await client.addSlot({ parentId: fluxId, name: `ToUri_${city.query}`, position: { x: xOffset, y: yBase - 0.1, z: 0 } });
      // 時間計算用
      await client.addSlot({ parentId: fluxId, name: `Offset_${city.query}`, position: { x: xOffset, y: yBase + 0.5, z: 0 } });
      await client.addSlot({ parentId: fluxId, name: `TimeSpan_${city.query}`, position: { x: xOffset, y: yBase + 0.4, z: 0 } });
      await client.addSlot({ parentId: fluxId, name: `AddTime_${city.query}`, position: { x: xOffset + 0.15, y: yBase + 0.5, z: 0 } });
      await client.addSlot({ parentId: fluxId, name: `Format_${city.query}`, position: { x: xOffset + 0.3, y: yBase + 0.5, z: 0 } });
      await client.addSlot({ parentId: fluxId, name: `TimeDrive_${city.query}`, position: { x: xOffset + 0.45, y: yBase + 0.5, z: 0 } });
    }

    fluxData = await client.getSlot({ slotId: fluxId, depth: 1 });

    for (let i = 0; i < CITIES.length; i++) {
      const city = CITIES[i];

      const receiverSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `Receiver_${city.query}`);
      const asyncSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `Async_${city.query}`);
      const getSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `GET_${city.query}`);
      const storeSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `Store_${city.query}`);
      const writeSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `Write_${city.query}`);
      const driveSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `Drive_${city.query}`);
      const urlSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `URL_${city.query}`);
      const toUriSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `ToUri_${city.query}`);
      // 時間計算用スロット
      const offsetSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `Offset_${city.query}`);
      const timeSpanSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `TimeSpan_${city.query}`);
      const addTimeSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `AddTime_${city.query}`);
      const formatSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `Format_${city.query}`);
      const timeDriveSlot = fluxData.data?.children?.find((c: any) => c.name?.value === `TimeDrive_${city.query}`);

      // コンポーネント追加
      await client.addComponent({
        containerSlotId: receiverSlot.id,
        componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Actions.DynamicImpulseReceiver',
      });
      await client.addComponent({
        containerSlotId: asyncSlot.id,
        componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Async.StartAsyncTask',
      });
      await client.addComponent({
        containerSlotId: getSlot.id,
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
        containerSlotId: driveSlot.id,
        componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectFieldDrive<string>',
      });
      await client.addComponent({
        containerSlotId: urlSlot.id,
        componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Variables.DataModelObjectFieldStore<string>',
      });
      await client.addComponent({
        containerSlotId: toUriSlot.id,
        componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Utility.Uris.StringToAbsoluteURI',
      });
      // 時間計算用コンポーネント
      await client.addComponent({
        containerSlotId: offsetSlot.id,
        componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<double>',
      });
      await client.addComponent({
        containerSlotId: timeSpanSlot.id,
        componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.TimeAndDate.TimeSpanFromHours',
      });
      await client.addComponent({
        containerSlotId: addTimeSlot.id,
        componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.TimeAndDate.Add_DateTime_TimeSpan',
      });
      await client.addComponent({
        containerSlotId: formatSlot.id,
        componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Strings.FormatDateTimeAsTime',
      });
      await client.addComponent({
        containerSlotId: timeDriveSlot.id,
        componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectFieldDrive<string>',
      });

      // コンポーネント取得
      const [receiverData, asyncData, getData, storeData, writeData, driveData, urlData, toUriData,
             offsetData, timeSpanData, addTimeData, formatData, timeDriveData] = await Promise.all([
        client.getSlot({ slotId: receiverSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: asyncSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: getSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: storeSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: writeSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: driveSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: urlSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: toUriSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: offsetSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: timeSpanSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: addTimeSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: formatSlot.id, includeComponentData: true }),
        client.getSlot({ slotId: timeDriveSlot.id, includeComponentData: true }),
      ]);

      const receiverComp = receiverData.data?.components?.find((c: any) => c.componentType?.includes('DynamicImpulseReceiver'));
      const asyncComp = asyncData.data?.components?.find((c: any) => c.componentType?.includes('StartAsyncTask'));
      const getComp = getData.data?.components?.find((c: any) => c.componentType?.includes('GET_String'));
      const storeComp = storeData.data?.components?.find((c: any) => c.componentType?.includes('DataModelObjectFieldStore'));
      const writeComp = writeData.data?.components?.find((c: any) => c.componentType?.includes('ObjectWrite'));
      const driveComp = driveData.data?.components?.find((c: any) => c.componentType?.includes('ObjectFieldDrive'));
      const proxyComp = driveData.data?.components?.find((c: any) => c.componentType?.includes('Proxy'));
      const urlStoreComp = urlData.data?.components?.find((c: any) => c.componentType?.includes('DataModelObjectFieldStore'));
      const toUriComp = toUriData.data?.components?.find((c: any) => c.componentType?.includes('StringToAbsoluteURI'));
      // 時間計算用
      const offsetComp = offsetData.data?.components?.find((c: any) => c.componentType?.includes('ValueInput'));
      const timeSpanComp = timeSpanData.data?.components?.find((c: any) => c.componentType?.includes('TimeSpanFromHours'));
      const addTimeComp = addTimeData.data?.components?.find((c: any) => c.componentType?.includes('Add_DateTime_TimeSpan'));
      const formatComp = formatData.data?.components?.find((c: any) => c.componentType?.includes('FormatDateTimeAsTime'));
      const timeDriveComp = timeDriveData.data?.components?.find((c: any) => c.componentType?.includes('ObjectFieldDrive'));
      const timeProxyComp = timeDriveData.data?.components?.find((c: any) => c.componentType?.includes('Proxy'));

      cityFluxData[city.query] = { receiverComp, asyncComp, getComp, storeComp, writeComp, driveComp, proxyComp, urlStoreComp, toUriComp,
                                   offsetComp, timeSpanComp, addTimeComp, formatComp, timeDriveComp, timeProxyComp };

      // URL設定
      const urlDataRefresh = await client.getSlot({ slotId: urlSlot.id, includeComponentData: true });
      const urlProxyComp = urlDataRefresh.data?.components?.find((c: any) => c.componentType?.includes('+Store'));
      if (urlProxyComp?.id) {
        const weatherUrl = `https://wttr.in/${city.query}?format=%c+%t`;
        await client.updateComponent({
          id: urlProxyComp.id,
          members: { Value: { $type: 'string', value: weatherUrl } } as any,
        });
      }

      // 接続: StringToAbsoluteURI.Input ← URLStore
      if (toUriComp?.id && urlStoreComp?.id) {
        await client.updateComponent({
          id: toUriComp.id,
          members: { Input: { $type: 'reference', targetId: urlStoreComp.id } } as any,
        });
      }

      // 接続: DynamicImpulseReceiver.Tag ← GlobalValue<string>
      if (receiverComp?.id && tagComp?.id) {
        await client.updateComponent({
          id: receiverComp.id,
          members: { Tag: { $type: 'reference', targetId: tagComp.id } } as any,
        });
      }

      // 接続: DynamicImpulseReceiver.OnTriggered → StartAsyncTask
      if (receiverComp?.id && asyncComp?.id) {
        const receiverDetails = await client.getComponent(receiverComp.id);
        const onTriggeredId = receiverDetails.data.members.OnTriggered?.id;
        if (onTriggeredId) {
          await client.updateComponent({
            id: receiverComp.id,
            members: { OnTriggered: { $type: 'reference', id: onTriggeredId, targetId: asyncComp.id } } as any,
          });
        }
      }

      // 接続: StartAsyncTask.TaskStart → GET_String
      if (asyncComp?.id && getComp?.id) {
        await client.updateComponent({
          id: asyncComp.id,
          members: { TaskStart: { $type: 'reference', targetId: getComp.id } } as any,
        });
      }

      // 接続: GET_String.URL ← StringToAbsoluteURI
      if (getComp?.id && toUriComp?.id) {
        await client.updateComponent({
          id: getComp.id,
          members: { URL: { $type: 'reference', targetId: toUriComp.id } } as any,
        });
      }

      // 接続: GET_String.OnResponse → ObjectWrite
      if (getComp?.id && writeComp?.id) {
        const getDetails = await client.getComponent(getComp.id);
        const onResponseId = getDetails.data.members.OnResponse?.id;
        if (onResponseId) {
          await client.updateComponent({
            id: getComp.id,
            members: { OnResponse: { $type: 'reference', id: onResponseId, targetId: writeComp.id } } as any,
          });
        }

        // 接続: ObjectWrite.Value ← GET_String.Content
        const contentId = getDetails.data.members.Content?.id;
        if (contentId) {
          await client.updateComponent({
            id: writeComp.id,
            members: { Value: { $type: 'reference', targetId: contentId } } as any,
          });
        }
      }

      // 接続: ObjectWrite.Variable ← Store
      if (writeComp?.id && storeComp?.id) {
        await client.updateComponent({
          id: writeComp.id,
          members: { Variable: { $type: 'reference', targetId: storeComp.id } } as any,
        });
      }

      // 接続: ObjectFieldDrive.Value ← Store
      if (driveComp?.id && storeComp?.id) {
        await client.updateComponent({
          id: driveComp.id,
          members: { Value: { $type: 'reference', targetId: storeComp.id } } as any,
        });
      }

      // 接続: ObjectFieldDrive.Drive → Text.Content
      if (proxyComp?.id && cityTextIds[city.query]) {
        const textDetails = await client.getComponent(cityTextIds[city.query]);
        const contentFieldId = textDetails.data.members.Content?.id;

        const proxyDetails = await client.getComponent(proxyComp.id);
        const driveId = proxyDetails.data.members.Drive?.id;

        if (contentFieldId && driveId) {
          await client.updateComponent({
            id: proxyComp.id,
            members: { Drive: { $type: 'reference', id: driveId, targetId: contentFieldId } } as any,
          });
        }
      }

      // ============ 時間計算用接続 ============
      // ValueInput にオフセット値を設定
      if (offsetComp?.id) {
        await client.updateComponent({
          id: offsetComp.id,
          members: { Value: { $type: 'double', value: city.offset } } as any,
        });
      }

      // TimeSpanFromHours.Value ← ValueInput
      if (timeSpanComp?.id && offsetComp?.id) {
        await client.updateComponent({
          id: timeSpanComp.id,
          members: { Value: { $type: 'reference', targetId: offsetComp.id } } as any,
        });
      }

      // Add_DateTime_TimeSpan.A ← UtcNow
      // Add_DateTime_TimeSpan.B ← TimeSpanFromHours
      if (addTimeComp?.id && utcNowComp?.id && timeSpanComp?.id) {
        await client.updateComponent({
          id: addTimeComp.id,
          members: {
            A: { $type: 'reference', targetId: utcNowComp.id },
            B: { $type: 'reference', targetId: timeSpanComp.id },
          } as any,
        });
      }

      // FormatDateTimeAsTime.Date ← Add_DateTime_TimeSpan
      if (formatComp?.id && addTimeComp?.id) {
        await client.updateComponent({
          id: formatComp.id,
          members: { Date: { $type: 'reference', targetId: addTimeComp.id } } as any,
        });
      }

      // ObjectFieldDrive(time) - コンポーネント情報を再取得してから接続
      if (timeDriveSlot?.id && cityTimeIds[city.query]) {
        // 少し待ってから再取得
        await new Promise(resolve => setTimeout(resolve, 100));

        const timeDriveDataRefresh = await client.getSlot({ slotId: timeDriveSlot.id, includeComponentData: true });
        const timeDriveCompRefresh = timeDriveDataRefresh.data?.components?.find((c: any) => c.componentType?.includes('ObjectFieldDrive'));
        const timeProxyCompRefresh = timeDriveDataRefresh.data?.components?.find((c: any) => c.componentType?.includes('Proxy'));

        // Drive → TimeText.Content
        if (timeProxyCompRefresh?.id) {
          const timeTextDetails = await client.getComponent(cityTimeIds[city.query]);
          const timeContentFieldId = timeTextDetails.data.members.Content?.id;

          const timeProxyDetails = await client.getComponent(timeProxyCompRefresh.id);
          const timeDriveId = timeProxyDetails.data.members.Drive?.id;

          if (timeContentFieldId && timeDriveId) {
            await client.updateComponent({
              id: timeProxyCompRefresh.id,
              members: { Drive: { $type: 'reference', id: timeDriveId, targetId: timeContentFieldId } } as any,
            });
          }
        }

        // Value ← FormatDateTimeAsTime
        if (timeDriveCompRefresh?.id && formatComp?.id) {
          await client.updateComponent({
            id: timeDriveCompRefresh.id,
            members: { Value: { $type: 'reference', targetId: formatComp.id } } as any,
          });
        }
      }

      console.log(`  ProtoFlux created: ${city.name}`);
    }

    console.log('\n========================================');
    console.log('World Weather Widget created!');
    console.log(`  Location: ${slotName}`);
    console.log('\n更新ボタンを押すと各都市の天気を取得します');
    console.log('========================================');

  } finally {
    client.disconnect();
  }
}

main();
