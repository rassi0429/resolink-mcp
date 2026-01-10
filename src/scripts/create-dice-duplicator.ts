/**
 * ダイス複製ボタン
 *
 * 「2」スロット内のダイスからランダムに1つ選んで複製し、DropPositionに移動させる
 *
 * 使い方: npx tsx src/scripts/create-dice-duplicator.ts [ws://localhost:3343]
 */
import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:3343';

// 既存スロットのID（事前に調査済み）
const DICE_PARENT_ID = 'Reso_33A8F';  // 「2」スロット
const DROP_POSITION_ID = 'Reso_3863C';  // DropPosition

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Creating Dice Duplicator Button...\n');

    // 1. メインスロット作成
    const slotName = `DiceDuplicator_${Date.now()}`;
    await client.addSlot({
      name: slotName,
      position: { x: -3.5, y: 1.5, z: 1 },
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
    // 物理ボタン
    // ============================================================
    await client.addSlot({
      parentId: mainId,
      name: 'Button',
      position: { x: 0, y: 0, z: 0 },
    });
    let mainData = await client.getSlot({ slotId: mainId, depth: 1 });
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
          Size: { $type: 'float3', value: { x: 0.15, y: 0.08, z: 0.08 } },
        } as any,
      });
    }

    // BoxCollider設定
    if (boxCollider?.id) {
      await client.updateComponent({
        id: boxCollider.id,
        members: {
          Size: { $type: 'float3', value: { x: 0.15, y: 0.08, z: 0.08 } },
        } as any,
      });
    }

    // マテリアル設定（オレンジ）
    if (material?.id) {
      await client.updateComponent({
        id: material.id,
        members: {
          AlbedoColor: { $type: 'colorX', value: { r: 1, g: 0.5, b: 0.2, a: 1 } },
          Smoothness: { $type: 'float', value: 0.7 },
          Metallic: { $type: 'float', value: 0.3 },
        } as any,
      });
    }

    // MeshRenderer設定
    if (meshRenderer?.id && boxMesh?.id && material?.id) {
      await client.updateComponent({
        id: meshRenderer.id,
        members: {
          Mesh: { $type: 'reference', targetId: boxMesh.id },
        } as any,
      });

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
    const fluxNodes = [
      { name: 'GlobalRef', pos: { x: -1.2, y: 0, z: 0 } },
      { name: 'ButtonEvents', pos: { x: -1.0, y: 0, z: 0 } },
      { name: 'DiceParentRef', pos: { x: -0.8, y: 0.15, z: 0 } },
      { name: 'DropPosRef', pos: { x: 0.2, y: 0.15, z: 0 } },
      { name: 'MinValue', pos: { x: -0.8, y: -0.1, z: 0 } },
      { name: 'MaxValue', pos: { x: -0.8, y: -0.2, z: 0 } },
      { name: 'RandomInt', pos: { x: -0.6, y: -0.15, z: 0 } },
      { name: 'GetChild', pos: { x: -0.4, y: 0, z: 0 } },
      { name: 'DuplicateSlot', pos: { x: -0.2, y: 0, z: 0 } },
      { name: 'GlobalTransform', pos: { x: 0.2, y: 0, z: 0 } },
      { name: 'SetPosition', pos: { x: 0.4, y: 0, z: 0 } },
      // 回転用ノード
      { name: 'RotMinValue', pos: { x: 0.4, y: -0.2, z: 0 } },
      { name: 'RotMaxValue', pos: { x: 0.4, y: -0.3, z: 0 } },
      { name: 'RandomFloat3', pos: { x: 0.5, y: -0.25, z: 0 } },
      { name: 'FromEuler', pos: { x: 0.6, y: -0.15, z: 0 } },
      { name: 'SetRotation', pos: { x: 0.7, y: 0, z: 0 } },
      // 物理起動用ノード
      { name: 'FindCharController', pos: { x: 0.8, y: -0.1, z: 0 } },
      { name: 'InitialVelocity', pos: { x: 0.8, y: -0.2, z: 0 } },
      { name: 'SetVelocity', pos: { x: 0.9, y: 0, z: 0 } },
      // DynamicImpulseTrigger用ノード
      { name: 'ActivateTag', pos: { x: 1.0, y: -0.15, z: 0 } },
      { name: 'DynamicTrigger', pos: { x: 1.1, y: 0, z: 0 } },
    ];

    for (const node of fluxNodes) {
      await client.addSlot({ parentId: fluxId, name: node.name, position: node.pos });
    }

    let fluxData = await client.getSlot({ slotId: fluxId, depth: 1 });
    const getFluxChild = (name: string) => fluxData.data?.children?.find((c: any) => c.name?.value === name);

    const globalRefSlot = getFluxChild('GlobalRef');
    const buttonEventsSlot = getFluxChild('ButtonEvents');
    const diceParentRefSlot = getFluxChild('DiceParentRef');
    const dropPosRefSlot = getFluxChild('DropPosRef');
    const minValueSlot = getFluxChild('MinValue');
    const maxValueSlot = getFluxChild('MaxValue');
    const randomIntSlot = getFluxChild('RandomInt');
    const getChildSlot = getFluxChild('GetChild');
    const duplicateSlotSlot = getFluxChild('DuplicateSlot');
    const globalTransformSlot = getFluxChild('GlobalTransform');
    const setPositionSlot = getFluxChild('SetPosition');
    // 回転用
    const rotMinValueSlot = getFluxChild('RotMinValue');
    const rotMaxValueSlot = getFluxChild('RotMaxValue');
    const randomFloat3Slot = getFluxChild('RandomFloat3');
    const fromEulerSlot = getFluxChild('FromEuler');
    const setRotationSlot = getFluxChild('SetRotation');
    // 物理起動用
    const findCharControllerSlot = getFluxChild('FindCharController');
    const initialVelocitySlot = getFluxChild('InitialVelocity');
    const setVelocitySlot = getFluxChild('SetVelocity');
    // DynamicImpulseTrigger用
    const activateTagSlot = getFluxChild('ActivateTag');
    const dynamicTriggerSlot = getFluxChild('DynamicTrigger');

    // コンポーネント追加
    await client.addComponent({
      containerSlotId: globalRefSlot.id,
      componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IButton>',
    });
    await client.addComponent({
      containerSlotId: buttonEventsSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Interaction.ButtonEvents',
    });
    await client.addComponent({
      containerSlotId: diceParentRefSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.RefObjectInput<[FrooxEngine]FrooxEngine.Slot>',
    });
    await client.addComponent({
      containerSlotId: dropPosRefSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.RefObjectInput<[FrooxEngine]FrooxEngine.Slot>',
    });
    await client.addComponent({
      containerSlotId: minValueSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>',
    });
    await client.addComponent({
      containerSlotId: maxValueSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>',
    });
    await client.addComponent({
      containerSlotId: randomIntSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Math.Random.RandomInt',
    });
    await client.addComponent({
      containerSlotId: getChildSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Slots.GetChild',
    });
    await client.addComponent({
      containerSlotId: duplicateSlotSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Slots.DuplicateSlot',
    });
    await client.addComponent({
      containerSlotId: globalTransformSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Transform.GlobalTransform',
    });
    await client.addComponent({
      containerSlotId: setPositionSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Transform.SetGlobalPosition',
    });
    // 回転用コンポーネント
    await client.addComponent({
      containerSlotId: rotMinValueSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float3>',
    });
    await client.addComponent({
      containerSlotId: rotMaxValueSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float3>',
    });
    await client.addComponent({
      containerSlotId: randomFloat3Slot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Math.Random.RandomFloat3',
    });
    await client.addComponent({
      containerSlotId: fromEulerSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Math.Quaternions.FromEuler_floatQ',
    });
    await client.addComponent({
      containerSlotId: setRotationSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Transform.SetGlobalRotation',
    });
    // 物理起動用コンポーネント
    await client.addComponent({
      containerSlotId: findCharControllerSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Physics.FindCharacterControllerFromSlot',
    });
    await client.addComponent({
      containerSlotId: initialVelocitySlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float3>',
    });
    await client.addComponent({
      containerSlotId: setVelocitySlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Physics.SetCharacterVelocity',
    });
    // DynamicImpulseTrigger用コンポーネント
    await client.addComponent({
      containerSlotId: activateTagSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueObjectInput<string>',
    });
    await client.addComponent({
      containerSlotId: dynamicTriggerSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Actions.DynamicImpulseTrigger',
    });
    console.log('  ProtoFlux nodes created');

    // コンポーネントID取得
    const [
      globalRefData,
      buttonEventsData,
      diceParentRefData,
      dropPosRefData,
      minValueData,
      maxValueData,
      randomIntData,
      getChildData,
      duplicateSlotData,
      globalTransformData,
      setPositionData,
      rotMinValueData,
      rotMaxValueData,
      randomFloat3Data,
      fromEulerData,
      setRotationData,
      findCharControllerData,
      initialVelocityData,
      setVelocityData,
      activateTagData,
      dynamicTriggerData,
    ] = await Promise.all([
      client.getSlot({ slotId: globalRefSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: buttonEventsSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: diceParentRefSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: dropPosRefSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: minValueSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: maxValueSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: randomIntSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: getChildSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: duplicateSlotSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: globalTransformSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: setPositionSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: rotMinValueSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: rotMaxValueSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: randomFloat3Slot.id, includeComponentData: true }),
      client.getSlot({ slotId: fromEulerSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: setRotationSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: findCharControllerSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: initialVelocitySlot.id, includeComponentData: true }),
      client.getSlot({ slotId: setVelocitySlot.id, includeComponentData: true }),
      client.getSlot({ slotId: activateTagSlot.id, includeComponentData: true }),
      client.getSlot({ slotId: dynamicTriggerSlot.id, includeComponentData: true }),
    ]);

    const globalRefComp = globalRefData.data?.components?.find((c: any) => c.componentType?.includes('GlobalReference'));
    const buttonEventsComp = buttonEventsData.data?.components?.find((c: any) => c.componentType?.includes('ButtonEvents'));
    const diceParentRefComp = diceParentRefData.data?.components?.find((c: any) => c.componentType?.includes('RefObjectInput'));
    const dropPosRefComp = dropPosRefData.data?.components?.find((c: any) => c.componentType?.includes('RefObjectInput'));
    const minValueComp = minValueData.data?.components?.find((c: any) => c.componentType?.includes('ValueInput'));
    const maxValueComp = maxValueData.data?.components?.find((c: any) => c.componentType?.includes('ValueInput'));
    const randomIntComp = randomIntData.data?.components?.find((c: any) => c.componentType?.includes('RandomInt'));
    const getChildComp = getChildData.data?.components?.find((c: any) => c.componentType?.includes('GetChild'));
    const duplicateSlotComp = duplicateSlotData.data?.components?.find((c: any) => c.componentType?.includes('DuplicateSlot'));
    const globalTransformComp = globalTransformData.data?.components?.find((c: any) => c.componentType?.includes('GlobalTransform'));
    const setPositionComp = setPositionData.data?.components?.find((c: any) => c.componentType?.includes('SetGlobalPosition'));
    // 回転用
    const rotMinValueComp = rotMinValueData.data?.components?.find((c: any) => c.componentType?.includes('ValueInput'));
    const rotMaxValueComp = rotMaxValueData.data?.components?.find((c: any) => c.componentType?.includes('ValueInput'));
    const randomFloat3Comp = randomFloat3Data.data?.components?.find((c: any) => c.componentType?.includes('RandomFloat3'));
    const fromEulerComp = fromEulerData.data?.components?.find((c: any) => c.componentType?.includes('FromEuler'));
    const setRotationComp = setRotationData.data?.components?.find((c: any) => c.componentType?.includes('SetGlobalRotation'));
    // 物理起動用
    const findCharControllerComp = findCharControllerData.data?.components?.find((c: any) => c.componentType?.includes('FindCharacterControllerFromSlot'));
    const initialVelocityComp = initialVelocityData.data?.components?.find((c: any) => c.componentType?.includes('ValueInput'));
    const setVelocityComp = setVelocityData.data?.components?.find((c: any) => c.componentType?.includes('SetCharacterVelocity'));
    // DynamicImpulseTrigger用
    const activateTagComp = activateTagData.data?.components?.find((c: any) => c.componentType?.includes('ValueObjectInput'));
    const dynamicTriggerComp = dynamicTriggerData.data?.components?.find((c: any) => c.componentType?.includes('DynamicImpulseTrigger'));

    // 値設定
    // Min = 1 (Fluxをスキップ)
    if (minValueComp?.id) {
      await client.updateComponent({
        id: minValueComp.id,
        members: { Value: { $type: 'int', value: 1 } } as any,
      });
    }
    // Max = 10 (RandomIntは排他的なので1-9を生成)
    if (maxValueComp?.id) {
      await client.updateComponent({
        id: maxValueComp.id,
        members: { Value: { $type: 'int', value: 10 } } as any,
      });
    }
    console.log('  Min/Max values set (1-9)');

    // スロット参照設定
    // DiceParentRef → ダイス親スロット
    if (diceParentRefComp?.id) {
      await client.updateComponent({
        id: diceParentRefComp.id,
        members: { Target: { $type: 'reference', targetId: DICE_PARENT_ID } } as any,
      });
      console.log('  DiceParentRef → ' + DICE_PARENT_ID);
    }
    // DropPosRef → DropPosition
    if (dropPosRefComp?.id) {
      await client.updateComponent({
        id: dropPosRefComp.id,
        members: { Target: { $type: 'reference', targetId: DROP_POSITION_ID } } as any,
      });
      console.log('  DropPosRef → ' + DROP_POSITION_ID);
    }

    // ボタン接続
    // GlobalReference.Reference → PhysicalButton
    if (globalRefComp?.id && physicalButton?.id) {
      await client.updateComponent({
        id: globalRefComp.id,
        members: { Reference: { $type: 'reference', targetId: physicalButton.id } } as any,
      });
    }
    // ButtonEvents.Button → GlobalReference
    if (buttonEventsComp?.id && globalRefComp?.id) {
      await client.updateComponent({
        id: buttonEventsComp.id,
        members: { Button: { $type: 'reference', targetId: globalRefComp.id } } as any,
      });
    }
    console.log('  Button connected');

    // RandomInt接続
    if (randomIntComp?.id) {
      await client.updateComponent({
        id: randomIntComp.id,
        members: {
          Min: { $type: 'reference', targetId: minValueComp.id },
          Max: { $type: 'reference', targetId: maxValueComp.id },
        } as any,
      });
    }

    // GetChild接続
    if (getChildComp?.id) {
      await client.updateComponent({
        id: getChildComp.id,
        members: {
          Instance: { $type: 'reference', targetId: diceParentRefComp.id },
          ChildIndex: { $type: 'reference', targetId: randomIntComp.id },
        } as any,
      });
    }
    console.log('  GetChild connected');

    // DuplicateSlot接続
    if (duplicateSlotComp?.id) {
      await client.updateComponent({
        id: duplicateSlotComp.id,
        members: {
          Template: { $type: 'reference', targetId: getChildComp.id },
        } as any,
      });
    }

    // フロー接続: ButtonEvents.Pressed → DuplicateSlot
    if (buttonEventsComp?.id && duplicateSlotComp?.id) {
      await client.updateComponent({
        id: buttonEventsComp.id,
        members: { Pressed: { $type: 'reference', targetId: duplicateSlotComp.id } } as any,
      });
    }
    console.log('  DuplicateSlot connected');

    // GlobalTransform接続（DropPositionの位置取得）
    if (globalTransformComp?.id && dropPosRefComp?.id) {
      await client.updateComponent({
        id: globalTransformComp.id,
        members: { Instance: { $type: 'reference', targetId: dropPosRefComp.id } } as any,
      });
    }

    // GlobalTransformのGlobalPosition出力IDを取得
    const globalTransformDetails = await client.getComponent(globalTransformComp.id);
    const globalPositionId = globalTransformDetails.data.members.GlobalPosition?.id;

    // DuplicateSlotのDuplicate出力IDを取得
    const duplicateSlotDetails = await client.getComponent(duplicateSlotComp.id);
    const duplicateOutputId = duplicateSlotDetails.data.members.Duplicate?.id;

    // SetGlobalPosition接続
    if (setPositionComp?.id) {
      await client.updateComponent({
        id: setPositionComp.id,
        members: {
          Instance: { $type: 'reference', targetId: duplicateOutputId },
          Position: { $type: 'reference', targetId: globalPositionId },
        } as any,
      });
    }

    // フロー接続: DuplicateSlot.Next → SetGlobalPosition
    const nextId = duplicateSlotDetails.data.members.Next?.id;
    if (nextId && setPositionComp?.id) {
      await client.updateComponent({
        id: duplicateSlotComp.id,
        members: { Next: { $type: 'reference', id: nextId, targetId: setPositionComp.id } } as any,
      });
    }
    console.log('  SetGlobalPosition connected');

    // ============================================================
    // 回転用ノード設定
    // ============================================================
    // RotMinValue = (0, 0, 0)
    if (rotMinValueComp?.id) {
      await client.updateComponent({
        id: rotMinValueComp.id,
        members: { Value: { $type: 'float3', value: { x: 0, y: 0, z: 0 } } } as any,
      });
    }
    // RotMaxValue = (360, 360, 360)
    if (rotMaxValueComp?.id) {
      await client.updateComponent({
        id: rotMaxValueComp.id,
        members: { Value: { $type: 'float3', value: { x: 360, y: 360, z: 360 } } } as any,
      });
    }
    console.log('  Rotation Min/Max values set (0-360)');

    // RandomFloat3接続
    if (randomFloat3Comp?.id) {
      await client.updateComponent({
        id: randomFloat3Comp.id,
        members: {
          Min: { $type: 'reference', targetId: rotMinValueComp.id },
          Max: { $type: 'reference', targetId: rotMaxValueComp.id },
        } as any,
      });
    }

    // FromEuler接続（RandomFloat3 → FromEuler）
    if (fromEulerComp?.id && randomFloat3Comp?.id) {
      await client.updateComponent({
        id: fromEulerComp.id,
        members: { Angles: { $type: 'reference', targetId: randomFloat3Comp.id } } as any,
      });
    }

    // SetGlobalRotation接続
    if (setRotationComp?.id) {
      await client.updateComponent({
        id: setRotationComp.id,
        members: {
          Instance: { $type: 'reference', targetId: duplicateOutputId },
          Rotation: { $type: 'reference', targetId: fromEulerComp.id },
        } as any,
      });
    }

    // フロー接続: SetGlobalPosition.Next → SetGlobalRotation
    const setPositionDetails = await client.getComponent(setPositionComp.id);
    const positionNextId = setPositionDetails.data.members.Next?.id;
    if (positionNextId && setRotationComp?.id) {
      await client.updateComponent({
        id: setPositionComp.id,
        members: { Next: { $type: 'reference', id: positionNextId, targetId: setRotationComp.id } } as any,
      });
    }
    console.log('  SetGlobalRotation connected');

    // ============================================================
    // 物理起動用ノード設定
    // ============================================================
    // InitialVelocity = (0, -0.1, 0) - 軽い下向き初速
    if (initialVelocityComp?.id) {
      await client.updateComponent({
        id: initialVelocityComp.id,
        members: { Value: { $type: 'float3', value: { x: 0, y: -0.1, z: 0 } } } as any,
      });
    }
    console.log('  InitialVelocity set (0, -0.1, 0)');

    // FindCharacterControllerFromSlot.Source ← DuplicateSlot.Duplicate
    if (findCharControllerComp?.id && duplicateOutputId) {
      await client.updateComponent({
        id: findCharControllerComp.id,
        members: { Source: { $type: 'reference', targetId: duplicateOutputId } } as any,
      });
    }

    // SetCharacterVelocity接続
    if (setVelocityComp?.id) {
      await client.updateComponent({
        id: setVelocityComp.id,
        members: {
          Character: { $type: 'reference', targetId: findCharControllerComp.id },
          Velocity: { $type: 'reference', targetId: initialVelocityComp.id },
        } as any,
      });
    }

    // フロー接続: SetGlobalRotation.Next → SetCharacterVelocity
    const setRotationDetails = await client.getComponent(setRotationComp.id);
    const rotationNextId = setRotationDetails.data.members.Next?.id;
    if (rotationNextId && setVelocityComp?.id) {
      await client.updateComponent({
        id: setRotationComp.id,
        members: { Next: { $type: 'reference', id: rotationNextId, targetId: setVelocityComp.id } } as any,
      });
    }
    console.log('  SetCharacterVelocity connected');

    // ============================================================
    // DynamicImpulseTrigger設定
    // ============================================================
    // GlobalValue<string>にタグ設定
    if (activateTagComp?.id) {
      await client.updateComponent({
        id: activateTagComp.id,
        members: { Value: { $type: 'string', value: 'ActivateDice' } } as any,
      });
    }
    console.log('  ActivateTag set to "ActivateDice"');

    // DynamicImpulseTrigger接続
    if (dynamicTriggerComp?.id) {
      await client.updateComponent({
        id: dynamicTriggerComp.id,
        members: {
          Tag: { $type: 'reference', targetId: activateTagComp.id },
          TargetHierarchy: { $type: 'reference', targetId: duplicateOutputId },
        } as any,
      });
    }

    // フロー接続: SetCharacterVelocity.Next → DynamicImpulseTrigger
    const setVelocityDetails = await client.getComponent(setVelocityComp.id);
    const velocityNextId = setVelocityDetails.data.members.Next?.id;
    if (velocityNextId && dynamicTriggerComp?.id) {
      await client.updateComponent({
        id: setVelocityComp.id,
        members: { Next: { $type: 'reference', id: velocityNextId, targetId: dynamicTriggerComp.id } } as any,
      });
    }
    console.log('  DynamicImpulseTrigger connected');

    console.log('\n========================================');
    console.log('Dice Duplicator created!');
    console.log(`  Location: ${slotName}`);
    console.log('\nボタンを押すとランダムなダイスを複製して');
    console.log('DropPositionにランダム回転+物理起動で移動します');
    console.log('========================================');

  } finally {
    client.disconnect();
  }
}

main();
