import { ResoniteLinkClient } from '../client.js';

async function main() {
  const url = process.argv[2] || 'ws://localhost:3343';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    const gymSlotId = 'Reso_428A6';

    console.log('Creating automatic doors (float3 version)...');

    const doorWidth = 2.5;
    const doorHeight = 4;
    const doorThickness = 0.15;
    const frameThickness = 0.3;
    const frameDepth = 0.5;
    const gymLength = 50;
    const gymWallZ = gymLength / 2 + 0.5 / 2;
    const doorZ = gymWallZ + 0.1;

    // ルートスロット作成
    const rootName = `AutoDoor_${Date.now()}`;
    await client.addSlot({
      parentId: gymSlotId,
      name: rootName,
      position: { x: 0, y: 0, z: doorZ },
      isActive: true,
    });

    const gymData = await client.getSlot({ slotId: gymSlotId, depth: 1 });
    const doorRoot = gymData.data?.children?.find((c: any) => c.name?.value === rootName);
    if (!doorRoot?.id) throw new Error('Door root not found');

    // ボックス作成ヘルパー
    async function createBoxPart(
      parentId: string,
      name: string,
      position: { x: number; y: number; z: number },
      size: { x: number; y: number; z: number },
      color: { r: number; g: number; b: number; a: number },
      metallic: number = 0.0,
      smoothness: number = 0.3
    ) {
      await client.addSlot({ parentId, name, position, isActive: true });
      const parentData = await client.getSlot({ slotId: parentId, depth: 1 });
      const slot = parentData.data?.children?.find((c: any) => c.name?.value === name);
      if (!slot?.id) throw new Error(`${name} slot not found`);

      await client.addComponent({ containerSlotId: slot.id, componentType: '[FrooxEngine]FrooxEngine.BoxMesh' });
      await client.addComponent({ containerSlotId: slot.id, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
      await client.addComponent({ containerSlotId: slot.id, componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic' });

      const slotData = await client.getSlot({ slotId: slot.id, includeComponentData: true });
      const mesh = slotData.data?.components?.find((c: any) => c.componentType?.includes('BoxMesh'));
      const renderer = slotData.data?.components?.find((c: any) => c.componentType?.includes('MeshRenderer'));
      const material = slotData.data?.components?.find((c: any) => c.componentType?.includes('PBS_Metallic'));

      await client.updateComponent({
        id: mesh.id,
        members: { Size: { $type: 'float3', value: size } } as any,
      });

      await client.updateComponent({
        id: material.id,
        members: {
          AlbedoColor: { $type: 'colorX', value: { ...color, profile: 'sRGB' } },
          Metallic: { $type: 'float', value: metallic },
          Smoothness: { $type: 'float', value: smoothness },
        } as any,
      });

      await client.updateComponent({
        id: renderer.id,
        members: { Mesh: { $type: 'reference', targetId: mesh.id } } as any,
      });

      await client.updateComponent({
        id: renderer.id,
        members: { Materials: { $type: 'list', elements: [{ $type: 'reference', targetId: material.id }] } } as any,
      });
      const rendererData = await client.getComponent(renderer.id);
      const elementId = rendererData.data.members.Materials.elements[0].id;
      await client.updateComponent({
        id: renderer.id,
        members: { Materials: { $type: 'list', elements: [{ $type: 'reference', id: elementId, targetId: material.id }] } } as any,
      });

      return slot.id;
    }

    const frameColor = { r: 0.3, g: 0.3, b: 0.35, a: 1 };
    const doorColor = { r: 1, g: 0, b: 0, a: 0.8 }; // 赤で目立たせる

    // ドアフレーム
    console.log('Creating door frame...');
    await createBoxPart(doorRoot.id, 'FrameLeft', { x: -(doorWidth + frameThickness / 2), y: doorHeight / 2, z: 0 }, { x: frameThickness, y: doorHeight + frameThickness, z: frameDepth }, frameColor, 0.6, 0.4);
    await createBoxPart(doorRoot.id, 'FrameRight', { x: doorWidth + frameThickness / 2, y: doorHeight / 2, z: 0 }, { x: frameThickness, y: doorHeight + frameThickness, z: frameDepth }, frameColor, 0.6, 0.4);
    await createBoxPart(doorRoot.id, 'FrameTop', { x: 0, y: doorHeight + frameThickness / 2, z: 0 }, { x: doorWidth * 2 + frameThickness * 2, y: frameThickness, z: frameDepth }, frameColor, 0.6, 0.4);

    // スライドドア（閉じた位置で作成）
    console.log('Creating sliding doors...');
    const closedPosL = { x: -doorWidth / 2, y: doorHeight / 2, z: 0 };
    const closedPosR = { x: doorWidth / 2, y: doorHeight / 2, z: 0 };

    const leftDoorId = await createBoxPart(doorRoot.id, 'DoorLeft', closedPosL, { x: doorWidth - 0.05, y: doorHeight - 0.1, z: doorThickness }, doorColor, 0.1, 0.9);
    const rightDoorId = await createBoxPart(doorRoot.id, 'DoorRight', closedPosR, { x: doorWidth - 0.05, y: doorHeight - 0.1, z: doorThickness }, doorColor, 0.1, 0.9);

    // 半透明設定
    const leftDoorData = await client.getSlot({ slotId: leftDoorId, includeComponentData: true });
    const leftMaterial = leftDoorData.data?.components?.find((c: any) => c.componentType?.includes('PBS_Metallic'));
    await client.updateComponent({ id: leftMaterial.id, members: { BlendMode: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode' } } as any });

    const rightDoorData = await client.getSlot({ slotId: rightDoorId, includeComponentData: true });
    const rightMaterial = rightDoorData.data?.components?.find((c: any) => c.componentType?.includes('PBS_Metallic'));
    await client.updateComponent({ id: rightMaterial.id, members: { BlendMode: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode' } } as any });

    // ProtoFlux
    console.log('Creating ProtoFlux logic (float3 version)...');

    await client.addSlot({ parentId: doorRoot.id, name: 'Flux', position: { x: 0, y: 5, z: 0 }, isActive: true });
    const doorRootData = await client.getSlot({ slotId: doorRoot.id, depth: 1 });
    const fluxSlot = doorRootData.data?.children?.find((c: any) => c.name?.value === 'Flux');

    // ノード用スロット
    const nodeNames = [
      'LocalUserSlot', 'GlobalPos', 'DoorPos', 'Distance', 'Threshold', 'Compare',
      'OpenPosL', 'ClosedPosL', 'OpenPosR', 'ClosedPosR',
      'ConditionalL', 'ConditionalR', 'SmoothLerpL', 'SmoothLerpR',
      'DriveL', 'DriveR',
    ];

    for (const name of nodeNames) {
      await client.addSlot({ parentId: fluxSlot!.id, name, position: { x: 0, y: 0, z: 0 }, isActive: true });
    }

    const fluxData = await client.getSlot({ slotId: fluxSlot!.id, depth: 1 });
    const getNodeSlot = (name: string) => fluxData.data?.children?.find((c: any) => c.name?.value === name);

    console.log('Adding ProtoFlux components...');

    // LocalUserSlot
    await client.addComponent({
      containerSlotId: getNodeSlot('LocalUserSlot')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Users.LocalUserSlot',
    });

    // GlobalTransform
    await client.addComponent({
      containerSlotId: getNodeSlot('GlobalPos')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Transform.GlobalTransform',
    });

    // DoorPos (ValueInput<float3>)
    await client.addComponent({
      containerSlotId: getNodeSlot('DoorPos')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float3>',
    });

    // Distance_Float3
    await client.addComponent({
      containerSlotId: getNodeSlot('Distance')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.Distance_Float3',
    });

    // Threshold (ValueInput<float>)
    await client.addComponent({
      containerSlotId: getNodeSlot('Threshold')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float>',
    });

    // Compare (ValueLessThan<float>)
    await client.addComponent({
      containerSlotId: getNodeSlot('Compare')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.ValueLessThan<float>',
    });

    // 開閉位置 (float3)
    await client.addComponent({
      containerSlotId: getNodeSlot('OpenPosL')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float3>',
    });
    await client.addComponent({
      containerSlotId: getNodeSlot('ClosedPosL')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float3>',
    });
    await client.addComponent({
      containerSlotId: getNodeSlot('OpenPosR')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float3>',
    });
    await client.addComponent({
      containerSlotId: getNodeSlot('ClosedPosR')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float3>',
    });

    // Conditional<float3>
    await client.addComponent({
      containerSlotId: getNodeSlot('ConditionalL')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueConditional<float3>',
    });
    await client.addComponent({
      containerSlotId: getNodeSlot('ConditionalR')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueConditional<float3>',
    });

    // SmoothLerp<float3>
    await client.addComponent({
      containerSlotId: getNodeSlot('SmoothLerpL')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Math.ValueSmoothLerp<float3>',
    });
    await client.addComponent({
      containerSlotId: getNodeSlot('SmoothLerpR')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Math.ValueSmoothLerp<float3>',
    });

    // ValueFieldDrive<float3>
    await client.addComponent({
      containerSlotId: getNodeSlot('DriveL')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueFieldDrive<float3>',
    });
    await client.addComponent({
      containerSlotId: getNodeSlot('DriveR')!.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueFieldDrive<float3>',
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    console.log('Getting component references...');

    const getComp = async (slotId: string, typeContains: string) => {
      const data = await client.getSlot({ slotId, includeComponentData: true });
      return data.data?.components?.find((c: any) => c.componentType?.includes(typeContains));
    };

    const localUserComp = await getComp(getNodeSlot('LocalUserSlot')!.id, 'LocalUserSlot');
    const globalPosComp = await getComp(getNodeSlot('GlobalPos')!.id, 'GlobalTransform');
    const doorPosComp = await getComp(getNodeSlot('DoorPos')!.id, 'ValueInput');
    const distanceComp = await getComp(getNodeSlot('Distance')!.id, 'Distance');
    const thresholdComp = await getComp(getNodeSlot('Threshold')!.id, 'ValueInput');
    const compareComp = await getComp(getNodeSlot('Compare')!.id, 'ValueLessThan');
    const openPosLComp = await getComp(getNodeSlot('OpenPosL')!.id, 'ValueInput');
    const closedPosLComp = await getComp(getNodeSlot('ClosedPosL')!.id, 'ValueInput');
    const openPosRComp = await getComp(getNodeSlot('OpenPosR')!.id, 'ValueInput');
    const closedPosRComp = await getComp(getNodeSlot('ClosedPosR')!.id, 'ValueInput');
    const conditionalLComp = await getComp(getNodeSlot('ConditionalL')!.id, 'ValueConditional');
    const conditionalRComp = await getComp(getNodeSlot('ConditionalR')!.id, 'ValueConditional');
    const smoothLerpLComp = await getComp(getNodeSlot('SmoothLerpL')!.id, 'ValueSmoothLerp');
    const smoothLerpRComp = await getComp(getNodeSlot('SmoothLerpR')!.id, 'ValueSmoothLerp');
    const driveLComp = await getComp(getNodeSlot('DriveL')!.id, 'ValueFieldDrive');
    const driveRComp = await getComp(getNodeSlot('DriveR')!.id, 'ValueFieldDrive');

    console.log('Setting values...');

    // ドア検出位置
    await client.updateComponent({
      id: doorPosComp.id,
      members: { Value: { $type: 'float3', value: { x: 0, y: 2, z: 35 } } } as any,
    });

    // 閾値 5m
    await client.updateComponent({
      id: thresholdComp.id,
      members: { Value: { $type: 'float', value: 5 } } as any,
    });

    // 開閉位置 (float3)
    const openL = { x: -doorWidth - 0.3, y: doorHeight / 2, z: 0 };
    const openR = { x: doorWidth + 0.3, y: doorHeight / 2, z: 0 };

    await client.updateComponent({ id: openPosLComp.id, members: { Value: { $type: 'float3', value: openL } } as any });
    await client.updateComponent({ id: closedPosLComp.id, members: { Value: { $type: 'float3', value: closedPosL } } as any });
    await client.updateComponent({ id: openPosRComp.id, members: { Value: { $type: 'float3', value: openR } } as any });
    await client.updateComponent({ id: closedPosRComp.id, members: { Value: { $type: 'float3', value: closedPosR } } as any });

    console.log('Connecting nodes...');

    // GlobalTransform.Instance <- LocalUserSlot
    await client.updateComponent({
      id: globalPosComp.id,
      members: { Instance: { $type: 'reference', targetId: localUserComp.id } } as any,
    });

    // GlobalPositionを取得
    const globalPosDetails = await client.getComponent(globalPosComp.id);
    const globalPositionId = globalPosDetails.data.members.GlobalPosition?.id;

    // Distance接続
    await client.updateComponent({
      id: distanceComp.id,
      members: {
        A: { $type: 'reference', targetId: globalPositionId },
        B: { $type: 'reference', targetId: doorPosComp.id },
      } as any,
    });

    // Compare接続
    await client.updateComponent({
      id: compareComp.id,
      members: {
        A: { $type: 'reference', targetId: distanceComp.id },
        B: { $type: 'reference', targetId: thresholdComp.id },
      } as any,
    });

    // Conditional接続 (左)
    await client.updateComponent({
      id: conditionalLComp.id,
      members: {
        Condition: { $type: 'reference', targetId: compareComp.id },
        OnTrue: { $type: 'reference', targetId: openPosLComp.id },
        OnFalse: { $type: 'reference', targetId: closedPosLComp.id },
      } as any,
    });

    // Conditional接続 (右)
    await client.updateComponent({
      id: conditionalRComp.id,
      members: {
        Condition: { $type: 'reference', targetId: compareComp.id },
        OnTrue: { $type: 'reference', targetId: openPosRComp.id },
        OnFalse: { $type: 'reference', targetId: closedPosRComp.id },
      } as any,
    });

    // SmoothLerp接続
    await client.updateComponent({
      id: smoothLerpLComp.id,
      members: { Input: { $type: 'reference', targetId: conditionalLComp.id } } as any,
    });
    await client.updateComponent({
      id: smoothLerpRComp.id,
      members: { Input: { $type: 'reference', targetId: conditionalRComp.id } } as any,
    });

    // Drive接続
    await client.updateComponent({
      id: driveLComp.id,
      members: { Value: { $type: 'reference', targetId: smoothLerpLComp.id } } as any,
    });
    await client.updateComponent({
      id: driveRComp.id,
      members: { Value: { $type: 'reference', targetId: smoothLerpRComp.id } } as any,
    });

    // DriveのProxyを取得してドアのPositionに接続
    console.log('Connecting drives to door positions...');
    await new Promise(resolve => setTimeout(resolve, 200));

    const driveLSlotData = await client.getSlot({ slotId: getNodeSlot('DriveL')!.id, includeComponentData: true });
    const driveLProxy = driveLSlotData.data?.components?.find((c: any) => c.componentType?.includes('Proxy'));
    const driveRSlotData = await client.getSlot({ slotId: getNodeSlot('DriveR')!.id, includeComponentData: true });
    const driveRProxy = driveRSlotData.data?.components?.find((c: any) => c.componentType?.includes('Proxy'));

    if (driveLProxy && driveRProxy) {
      // 左ドアのPositionフィールドID
      const leftDoorSlotData = await client.getSlot({ slotId: leftDoorId, summary: false });
      const leftPosId = leftDoorSlotData.data?.position?.id;

      // 右ドアのPositionフィールドID
      const rightDoorSlotData = await client.getSlot({ slotId: rightDoorId, summary: false });
      const rightPosId = rightDoorSlotData.data?.position?.id;

      // ProxyのDriveを取得
      const driveLProxyDetails = await client.getComponent(driveLProxy.id);
      const driveLDriveId = driveLProxyDetails.data.members.Drive?.id;
      const driveRProxyDetails = await client.getComponent(driveRProxy.id);
      const driveRDriveId = driveRProxyDetails.data.members.Drive?.id;

      // Drive接続
      await client.updateComponent({
        id: driveLProxy.id,
        members: { Drive: { $type: 'reference', id: driveLDriveId, targetId: leftPosId } } as any,
      });
      await client.updateComponent({
        id: driveRProxy.id,
        members: { Drive: { $type: 'reference', id: driveRDriveId, targetId: rightPosId } } as any,
      });

      console.log('✅ Automatic doors created and fully connected!');
    } else {
      console.log('✅ Automatic doors created!');
      console.log('⚠️  Manual setup needed: Connect DriveL/DriveR to door Position fields');
    }

    console.log(`   Left door: ${leftDoorId}`);
    console.log(`   Right door: ${rightDoorId}`);

  } finally {
    client.disconnect();
  }
}

main().catch(console.error);
