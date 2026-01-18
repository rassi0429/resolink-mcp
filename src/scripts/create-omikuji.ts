/**
 * おみくじUIX作成スクリプト
 * 使い方: npx tsx src/scripts/create-omikuji.ts [ws://localhost:25218]
 */
import { ResoniteLinkClient } from '../client.js';

const FORTUNES = ['大吉', '中吉', '小吉', '吉', '末吉', '凶', '大凶'];
const WS_URL = process.argv[2] || 'ws://localhost:25218';

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();
  console.log('Connected to Resonite');

  try {
    // 1. メインスロット作成
    const slotName = `Omikuji_${Date.now()}`;
    await client.addSlot({
      name: slotName,
      position: { x: 0, y: 1.5, z: 1 },
      isActive: true,
    });

    const mainSlot = await client.findSlotByName(slotName, 'Root', 1);
    if (!mainSlot?.id) throw new Error('Main slot not found');
    const mainId = mainSlot.id;
    console.log(`Main slot: ${mainId}`);

    // スケールを0.001に設定
    await client.updateSlot({
      id: mainId,
      scale: { x: 0.001, y: 0.001, z: 0.001 },
    });

    // 2. Canvas + Grabbable追加（メインスロットに）
    await client.addComponent({ containerSlotId: mainId, componentType: '[FrooxEngine]FrooxEngine.UIX.Canvas' });
    await client.addComponent({ containerSlotId: mainId, componentType: '[FrooxEngine]FrooxEngine.Grabbable' });

    let slotData = await client.getSlot({ slotId: mainId, includeComponentData: true });
    const canvas = slotData.data?.components?.find((c: any) => c.componentType?.includes('Canvas'));
    if (canvas?.id) {
      await client.updateComponent({
        id: canvas.id,
        members: { Size: { $type: 'float2', value: { x: 350, y: 400 } } } as any,
      });
    }
    console.log('Canvas configured');

    // 3. 背景スロット作成
    await client.addSlot({ parentId: mainId, name: 'Background' });
    slotData = await client.getSlot({ slotId: mainId, depth: 1 });
    const bgSlot = slotData.data?.children?.find((c: any) => c.name?.value === 'Background');
    if (!bgSlot?.id) throw new Error('Background slot not found');
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
          Tint: { $type: 'colorX', value: { r: 0.95, g: 0.9, b: 0.8, a: 0.95 } },
        } as any,
      });
    }
    console.log('Background created');

    // 4. タイトル
    await client.addSlot({ parentId: mainId, name: 'Title' });
    slotData = await client.getSlot({ slotId: mainId, depth: 1 });
    const titleSlot = slotData.data?.children?.find((c: any) => c.name?.value === 'Title');
    if (!titleSlot?.id) throw new Error('Title slot not found');
    const titleId = titleSlot.id;

    await client.addComponent({ containerSlotId: titleId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: titleId, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

    let titleData = await client.getSlot({ slotId: titleId, includeComponentData: true });
    const titleRect = titleData.data?.components?.find((c: any) => c.componentType?.includes('RectTransform'));
    const titleText = titleData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

    if (titleRect?.id) {
      await client.updateComponent({
        id: titleRect.id,
        members: {
          AnchorMin: { $type: 'float2', value: { x: 0, y: 0.75 } },
          AnchorMax: { $type: 'float2', value: { x: 1, y: 0.95 } },
          OffsetMin: { $type: 'float2', value: { x: 0, y: 0 } },
          OffsetMax: { $type: 'float2', value: { x: 0, y: 0 } },
        } as any,
      });
    }
    if (titleText?.id) {
      await client.updateComponent({
        id: titleText.id,
        members: {
          Content: { $type: 'string', value: 'おみくじ' },
          Size: { $type: 'float', value: 48 },
          Color: { $type: 'colorX', value: { r: 0.6, g: 0.1, b: 0.1, a: 1 } },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
          VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
        } as any,
      });
    }
    console.log('Title created');

    // 5. 結果表示
    await client.addSlot({ parentId: mainId, name: 'Result' });
    slotData = await client.getSlot({ slotId: mainId, depth: 1 });
    const resultSlot = slotData.data?.children?.find((c: any) => c.name?.value === 'Result');
    if (!resultSlot?.id) throw new Error('Result slot not found');
    const resultId = resultSlot.id;

    await client.addComponent({ containerSlotId: resultId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: resultId, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

    let resultData = await client.getSlot({ slotId: resultId, includeComponentData: true });
    const resultRect = resultData.data?.components?.find((c: any) => c.componentType?.includes('RectTransform'));
    const resultText = resultData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

    if (resultRect?.id) {
      await client.updateComponent({
        id: resultRect.id,
        members: {
          AnchorMin: { $type: 'float2', value: { x: 0, y: 0.35 } },
          AnchorMax: { $type: 'float2', value: { x: 1, y: 0.75 } },
          OffsetMin: { $type: 'float2', value: { x: 0, y: 0 } },
          OffsetMax: { $type: 'float2', value: { x: 0, y: 0 } },
        } as any,
      });
    }
    if (resultText?.id) {
      await client.updateComponent({
        id: resultText.id,
        members: {
          Content: { $type: 'string', value: '？' },
          Size: { $type: 'float', value: 80 },
          Color: { $type: 'colorX', value: { r: 0.2, g: 0.2, b: 0.2, a: 1 } },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
          VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
        } as any,
      });
    }
    console.log('Result created');

    // 6. ボタン
    await client.addSlot({ parentId: mainId, name: 'DrawButton' });
    slotData = await client.getSlot({ slotId: mainId, depth: 1 });
    const btnSlot = slotData.data?.children?.find((c: any) => c.name?.value === 'DrawButton');
    if (!btnSlot?.id) throw new Error('DrawButton slot not found');
    const btnId = btnSlot.id;

    await client.addComponent({ containerSlotId: btnId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: btnId, componentType: '[FrooxEngine]FrooxEngine.UIX.Image' });
    await client.addComponent({ containerSlotId: btnId, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });
    await client.addComponent({ containerSlotId: btnId, componentType: '[FrooxEngine]FrooxEngine.UIX.Button' });
    await client.addComponent({ containerSlotId: btnId, componentType: '[FrooxEngine]FrooxEngine.ButtonDynamicImpulseTrigger' });

    let btnData = await client.getSlot({ slotId: btnId, includeComponentData: true });
    const btnRect = btnData.data?.components?.find((c: any) => c.componentType?.includes('RectTransform'));
    const btnImage = btnData.data?.components?.find((c: any) => c.componentType?.includes('Image'));
    const btnText = btnData.data?.components?.find((c: any) => c.componentType?.includes('Text') && !c.componentType?.includes('TextField'));
    const btnTrigger = btnData.data?.components?.find((c: any) => c.componentType?.includes('ButtonDynamicImpulseTrigger'));

    if (btnRect?.id) {
      await client.updateComponent({
        id: btnRect.id,
        members: {
          AnchorMin: { $type: 'float2', value: { x: 0.2, y: 0.08 } },
          AnchorMax: { $type: 'float2', value: { x: 0.8, y: 0.28 } },
          OffsetMin: { $type: 'float2', value: { x: 0, y: 0 } },
          OffsetMax: { $type: 'float2', value: { x: 0, y: 0 } },
        } as any,
      });
    }
    if (btnImage?.id) {
      await client.updateComponent({
        id: btnImage.id,
        members: {
          Tint: { $type: 'colorX', value: { r: 0.7, g: 0.15, b: 0.15, a: 1 } },
        } as any,
      });
    }
    if (btnText?.id) {
      await client.updateComponent({
        id: btnText.id,
        members: {
          Content: { $type: 'string', value: '引く' },
          Size: { $type: 'float', value: 36 },
          Color: { $type: 'colorX', value: { r: 1, g: 1, b: 1, a: 1 } },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
          VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
        } as any,
      });
    }
    if (btnTrigger?.id) {
      await client.updateComponent({
        id: btnTrigger.id,
        members: {
          PressedTag: { $type: 'string', value: 'DrawOmikuji' },
          Target: { $type: 'reference', targetId: mainId },
        } as any,
      });
    }
    console.log('Button created');

    // 7. GameState（ValueField + ValueDriver）
    await client.addSlot({ parentId: mainId, name: 'GameState' });
    slotData = await client.getSlot({ slotId: mainId, depth: 1 });
    const stateSlot = slotData.data?.children?.find((c: any) => c.name?.value === 'GameState');
    if (!stateSlot?.id) throw new Error('GameState slot not found');
    const stateId = stateSlot.id;

    await client.addComponent({ containerSlotId: stateId, componentType: '[FrooxEngine]FrooxEngine.ValueField<string>' });
    await client.addComponent({ containerSlotId: stateId, componentType: '[FrooxEngine]FrooxEngine.ValueDriver<string>' });

    let stateData = await client.getSlot({ slotId: stateId, includeComponentData: true });
    const valueField = stateData.data?.components?.find((c: any) => c.componentType?.includes('ValueField'));
    const valueDriver = stateData.data?.components?.find((c: any) => c.componentType?.includes('ValueDriver'));

    // ValueField.Valueを取得
    const valueFieldDetails = await client.getComponent(valueField.id);
    const valueFieldValueId = valueFieldDetails.data.members.Value.id;

    // Result TextのContentを取得
    const resultTextDetails = await client.getComponent(resultText.id);
    const resultContentId = resultTextDetails.data.members.Content.id;

    // ValueDriverを設定
    const valueDriverDetails = await client.getComponent(valueDriver.id);
    await client.updateComponent({
      id: valueDriver.id,
      members: {
        ValueSource: { $type: 'reference', targetId: valueFieldValueId },
        DriveTarget: { $type: 'reference', id: valueDriverDetails.data.members.DriveTarget.id, targetId: resultContentId },
      } as any,
    });

    // 初期値設定
    await client.updateComponent({
      id: valueField.id,
      members: { Value: { $type: 'string', value: '？' } } as any,
    });
    console.log('GameState created');

    // 8. ProtoFlux
    await client.addSlot({ parentId: mainId, name: 'Flux' });
    slotData = await client.getSlot({ slotId: mainId, depth: 1 });
    const fluxSlot = slotData.data?.children?.find((c: any) => c.name?.value === 'Flux');
    if (!fluxSlot?.id) throw new Error('Flux slot not found');
    const fluxId = fluxSlot.id;

    // サブスロット作成
    const fluxNodes = ['Receiver', 'TagValue', 'RandomInt', 'MinInput', 'MaxInput', 'Multiplex', 'GlobalRef', 'Source', 'Write'];
    for (let i = 0; i < FORTUNES.length; i++) {
      fluxNodes.push(`Fortune${i}`);
    }
    for (const name of fluxNodes) {
      await client.addSlot({ parentId: fluxId, name });
    }

    let fluxData = await client.getSlot({ slotId: fluxId, depth: 1 });
    const getFluxChild = (name: string) => fluxData.data?.children?.find((c: any) => c.name?.value === name);

    const receiverSlot = getFluxChild('Receiver');
    const tagValueSlot = getFluxChild('TagValue');
    const randomIntSlot = getFluxChild('RandomInt');
    const minInputSlot = getFluxChild('MinInput');
    const maxInputSlot = getFluxChild('MaxInput');
    const multiplexSlot = getFluxChild('Multiplex');
    const globalRefSlot = getFluxChild('GlobalRef');
    const sourceSlot = getFluxChild('Source');
    const writeSlot = getFluxChild('Write');

    // DynamicImpulseReceiver
    await client.addComponent({
      containerSlotId: receiverSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Actions.DynamicImpulseReceiver',
    });

    // GlobalValue<string> for Tag
    await client.addComponent({
      containerSlotId: tagValueSlot.id,
      componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalValue<string>',
    });

    let tagData = await client.getSlot({ slotId: tagValueSlot.id, includeComponentData: true });
    const tagComp = tagData.data?.components?.find((c: any) => c.componentType?.includes('GlobalValue'));
    await client.updateComponent({
      id: tagComp.id,
      members: { Value: { $type: 'string', value: 'DrawOmikuji' } } as any,
    });

    // ReceiverのTagを設定
    let receiverData = await client.getSlot({ slotId: receiverSlot.id, includeComponentData: true });
    const receiverComp = receiverData.data?.components?.find((c: any) => c.componentType?.includes('DynamicImpulseReceiver'));
    await client.updateComponent({
      id: receiverComp.id,
      members: { Tag: { $type: 'reference', targetId: tagComp.id } } as any,
    });

    // ValueInput<int> Min = 0
    await client.addComponent({
      containerSlotId: minInputSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>',
    });
    let minData = await client.getSlot({ slotId: minInputSlot.id, includeComponentData: true });
    const minComp = minData.data?.components?.find((c: any) => c.componentType?.includes('ValueInput'));
    await client.updateComponent({
      id: minComp.id,
      members: { Value: { $type: 'int', value: 0 } } as any,
    });

    // ValueInput<int> Max = 7
    await client.addComponent({
      containerSlotId: maxInputSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>',
    });
    let maxData = await client.getSlot({ slotId: maxInputSlot.id, includeComponentData: true });
    const maxComp = maxData.data?.components?.find((c: any) => c.componentType?.includes('ValueInput'));
    await client.updateComponent({
      id: maxComp.id,
      members: { Value: { $type: 'int', value: 7 } } as any,
    });

    // RandomInt
    await client.addComponent({
      containerSlotId: randomIntSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Math.Random.RandomInt',
    });
    let randomData = await client.getSlot({ slotId: randomIntSlot.id, includeComponentData: true });
    const randomComp = randomData.data?.components?.find((c: any) => c.componentType?.includes('RandomInt'));
    await client.updateComponent({
      id: randomComp.id,
      members: {
        Min: { $type: 'reference', targetId: minComp.id },
        Max: { $type: 'reference', targetId: maxComp.id },
      } as any,
    });

    // Fortune inputs (7個)
    const fortuneCompIds: string[] = [];
    for (let i = 0; i < FORTUNES.length; i++) {
      const fortuneSlot = getFluxChild(`Fortune${i}`);
      await client.addComponent({
        containerSlotId: fortuneSlot.id,
        componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueObjectInput<string>',
      });
      const fortuneData = await client.getSlot({ slotId: fortuneSlot.id, includeComponentData: true });
      const fortuneComp = fortuneData.data?.components?.find((c: any) => c.componentType?.includes('ValueObjectInput'));
      await client.updateComponent({
        id: fortuneComp.id,
        members: { Value: { $type: 'string', value: FORTUNES[i] } } as any,
      });
      fortuneCompIds.push(fortuneComp.id);
    }

    // ObjectMultiplex<string>
    await client.addComponent({
      containerSlotId: multiplexSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectMultiplex<string>',
    });
    let muxData = await client.getSlot({ slotId: multiplexSlot.id, includeComponentData: true });
    const muxComp = muxData.data?.components?.find((c: any) => c.componentType?.includes('ObjectMultiplex'));

    // Index接続
    await client.updateComponent({
      id: muxComp.id,
      members: { Index: { $type: 'reference', targetId: randomComp.id } } as any,
    });

    // Inputsリスト追加
    await client.updateComponent({
      id: muxComp.id,
      members: {
        Inputs: {
          $type: 'list',
          elements: fortuneCompIds.map(id => ({ $type: 'reference', targetId: id })),
        },
      } as any,
    });

    // 少し待ってから再取得
    await new Promise(r => setTimeout(r, 100));
    const muxDetails = await client.getComponent(muxComp.id);
    const inputElements = (muxDetails.data.members as any).Inputs.elements;

    // 要素IDを使って参照設定
    if (inputElements?.length > 0) {
      await client.updateComponent({
        id: muxComp.id,
        members: {
          Inputs: {
            $type: 'list',
            elements: inputElements.map((el: any, idx: number) => ({
              $type: 'reference',
              id: el.id,
              targetId: fortuneCompIds[idx],
            })),
          },
        } as any,
      });
    }

    // Output ID取得
    const muxDetailsRefresh = await client.getComponent(muxComp.id);
    const muxOutputId = muxDetailsRefresh.data.members.Output.id;

    // GlobalReference<IValue<string>>
    await client.addComponent({
      containerSlotId: globalRefSlot.id,
      componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<string>>',
    });
    let globalRefData = await client.getSlot({ slotId: globalRefSlot.id, includeComponentData: true });
    const globalRefComp = globalRefData.data?.components?.find((c: any) => c.componentType?.includes('GlobalReference'));
    await client.updateComponent({
      id: globalRefComp.id,
      members: { Reference: { $type: 'reference', targetId: valueFieldValueId } } as any,
    });

    // ObjectValueSource<string>
    await client.addComponent({
      containerSlotId: sourceSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectValueSource<string>',
    });
    let sourceData = await client.getSlot({ slotId: sourceSlot.id, includeComponentData: true });
    const sourceComp = sourceData.data?.components?.find((c: any) => c.componentType?.includes('ObjectValueSource'));
    await client.updateComponent({
      id: sourceComp.id,
      members: { Source: { $type: 'reference', targetId: globalRefComp.id } } as any,
    });

    // ObjectWrite (FrooxEngineContext)
    await client.addComponent({
      containerSlotId: writeSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,string>',
    });
    let writeData = await client.getSlot({ slotId: writeSlot.id, includeComponentData: true });
    const writeComp = writeData.data?.components?.find((c: any) => c.componentType?.includes('ObjectWrite'));
    await client.updateComponent({
      id: writeComp.id,
      members: {
        Value: { $type: 'reference', targetId: muxOutputId },
        Variable: { $type: 'reference', targetId: sourceComp.id },
      } as any,
    });

    // Receiver.OnTriggered → Write
    const receiverDetails = await client.getComponent(receiverComp.id);
    const onTriggeredId = receiverDetails.data.members.OnTriggered.id;
    await client.updateComponent({
      id: receiverComp.id,
      members: {
        OnTriggered: { $type: 'reference', id: onTriggeredId, targetId: writeComp.id },
      } as any,
    });

    console.log('ProtoFlux created');

    // ProtoFluxノードを初期化するため、一度非アクティブ→アクティブにする
    await client.updateSlot({ id: mainId, isActive: false });
    await client.updateSlot({ id: mainId, isActive: true });
    console.log('ProtoFlux initialized (reactivated)');

    console.log(`\nDone! おみくじUIX: ${slotName}`);

  } finally {
    client.disconnect();
  }
}

main().catch(console.error);
