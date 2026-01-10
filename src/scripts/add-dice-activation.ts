/**
 * すべてのダイスにDynamicImpulseReceiver設定を追加
 *
 * 使い方: npx tsx src/scripts/add-dice-activation.ts [ws://localhost:3343]
 */
import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:3343';

// ダイス情報（FluxスロットID）
const DICE_FLUX_SLOTS = [
  { name: 'D4', fluxId: 'Reso_3A6E1' },
  { name: 'D10x10', fluxId: 'Reso_3BC9E' },
  { name: 'D12', fluxId: 'Reso_3C0F7' },
  { name: 'D6 (33AFD)', fluxId: 'Reso_3C9A9' },
  { name: 'D6 (3D2EE)', fluxId: 'Reso_3D53A' },
  // D6 (33AB7) - Reso_3AB3A は既に設定済み
];

async function addActivationToFlux(client: ResoniteLinkClient, diceName: string, fluxId: string) {
  console.log(`\n--- ${diceName} (${fluxId}) ---`);

  // 1. Fluxスロットの子を取得してReferenceSource<User>とStartAsyncTaskを見つける
  const fluxData = await client.getSlot({ slotId: fluxId, depth: 1 });
  if (!fluxData.success) {
    console.log(`  ERROR: Failed to get flux data`);
    return;
  }

  const fluxChildren = fluxData.data?.children || [];

  // ReferenceSource<User>を持つUserFieldスロットを探す
  const userFieldSlot = fluxChildren.find((c: any) => c.name?.value?.includes('UserField'));
  if (!userFieldSlot) {
    console.log(`  ERROR: UserField not found`);
    return;
  }

  // StartAsyncTaskを探す (OnGrabbableReleasedの次のノード)
  const startAsyncSlot = fluxChildren.find((c: any) =>
    c.name?.value === 'StartAsyncTask' || c.name?.value?.includes('StartAsyncTask')
  );
  if (!startAsyncSlot) {
    console.log(`  ERROR: StartAsyncTask not found`);
    return;
  }

  // UserFieldスロットのコンポーネントを取得
  const userFieldData = await client.getSlot({ slotId: userFieldSlot.id, includeComponentData: true });
  const refSourceComp = userFieldData.data?.components?.find((c: any) =>
    c.componentType?.includes('ReferenceSource') && c.componentType?.includes('User')
  );
  if (!refSourceComp) {
    console.log(`  ERROR: ReferenceSource<User> not found`);
    return;
  }
  console.log(`  ReferenceSource<User>: ${refSourceComp.id}`);

  // StartAsyncTaskスロットのコンポーネントを取得
  const startAsyncData = await client.getSlot({ slotId: startAsyncSlot.id, includeComponentData: true });
  const startAsyncComp = startAsyncData.data?.components?.find((c: any) =>
    c.componentType?.includes('StartAsyncTask')
  );
  if (!startAsyncComp) {
    console.log(`  ERROR: StartAsyncTask component not found`);
    return;
  }
  console.log(`  StartAsyncTask: ${startAsyncComp.id}`);

  // 2. 新しいノード用スロットを作成
  const nodes = [
    { name: 'ActivateTag', pos: { x: 0.5, y: -0.3, z: 0 } },
    { name: 'DynamicReceiver', pos: { x: 0.6, y: -0.15, z: 0 } },
    { name: 'ActivateLocalUser', pos: { x: 0.7, y: -0.3, z: 0 } },
    { name: 'ActivateWrite', pos: { x: 0.8, y: -0.15, z: 0 } },
  ];

  for (const node of nodes) {
    await client.addSlot({ parentId: fluxId, name: node.name, position: node.pos });
  }

  // 作成したスロットを取得
  const fluxData2 = await client.getSlot({ slotId: fluxId, depth: 1 });
  const getChild = (name: string) => fluxData2.data?.children?.find((c: any) => c.name?.value === name);

  const activateTagSlot = getChild('ActivateTag');
  const dynamicReceiverSlot = getChild('DynamicReceiver');
  const activateLocalUserSlot = getChild('ActivateLocalUser');
  const activateWriteSlot = getChild('ActivateWrite');

  if (!activateTagSlot || !dynamicReceiverSlot || !activateLocalUserSlot || !activateWriteSlot) {
    console.log(`  ERROR: Failed to create slots`);
    return;
  }

  // 3. コンポーネントを追加
  await client.addComponent({
    containerSlotId: activateTagSlot.id,
    componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalValue<string>',
  });
  await client.addComponent({
    containerSlotId: dynamicReceiverSlot.id,
    componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Actions.DynamicImpulseReceiver',
  });
  await client.addComponent({
    containerSlotId: activateLocalUserSlot.id,
    componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Users.LocalUser',
  });
  await client.addComponent({
    containerSlotId: activateWriteSlot.id,
    componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,[FrooxEngine]FrooxEngine.User>',
  });

  // 少し待つ
  await new Promise(resolve => setTimeout(resolve, 100));

  // コンポーネントIDを取得
  const [tagData, receiverData, localUserData, writeData] = await Promise.all([
    client.getSlot({ slotId: activateTagSlot.id, includeComponentData: true }),
    client.getSlot({ slotId: dynamicReceiverSlot.id, includeComponentData: true }),
    client.getSlot({ slotId: activateLocalUserSlot.id, includeComponentData: true }),
    client.getSlot({ slotId: activateWriteSlot.id, includeComponentData: true }),
  ]);

  const tagComp = tagData.data?.components?.find((c: any) => c.componentType?.includes('GlobalValue'));
  const receiverComp = receiverData.data?.components?.find((c: any) => c.componentType?.includes('DynamicImpulseReceiver'));
  const localUserComp = localUserData.data?.components?.find((c: any) => c.componentType?.includes('LocalUser'));
  const writeComp = writeData.data?.components?.find((c: any) => c.componentType?.includes('ObjectWrite'));

  if (!tagComp || !receiverComp || !localUserComp || !writeComp) {
    console.log(`  ERROR: Failed to get component IDs`);
    return;
  }

  // 4. 値と接続を設定
  // GlobalValue<string>.Value = "ActivateDice"
  await client.updateComponent({
    id: tagComp.id,
    members: { Value: { $type: 'string', value: 'ActivateDice' } } as any,
  });

  // DynamicImpulseReceiver.Tag → GlobalValue<string>
  await client.updateComponent({
    id: receiverComp.id,
    members: { Tag: { $type: 'reference', targetId: tagComp.id } } as any,
  });

  // DynamicImpulseReceiver.OnTriggered → ObjectWrite<User>
  await client.updateComponent({
    id: receiverComp.id,
    members: { OnTriggered: { $type: 'reference', targetId: writeComp.id } } as any,
  });

  // ObjectWrite<User>.Value ← LocalUser
  await client.updateComponent({
    id: writeComp.id,
    members: { Value: { $type: 'reference', targetId: localUserComp.id } } as any,
  });

  // ObjectWrite<User>.Variable ← ReferenceSource<User>
  await client.updateComponent({
    id: writeComp.id,
    members: { Variable: { $type: 'reference', targetId: refSourceComp.id } } as any,
  });

  // ObjectWrite<User>.OnWritten → StartAsyncTask
  const writeDetails = await client.getComponent(writeComp.id);
  const onWrittenId = writeDetails.data.members.OnWritten?.id;
  await client.updateComponent({
    id: writeComp.id,
    members: { OnWritten: { $type: 'reference', id: onWrittenId, targetId: startAsyncComp.id } } as any,
  });

  console.log(`  Done!`);
}

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Adding DynamicImpulseReceiver to all dice...');

    for (const dice of DICE_FLUX_SLOTS) {
      await addActivationToFlux(client, dice.name, dice.fluxId);
    }

    console.log('\n========================================');
    console.log('All dice updated!');
    console.log('========================================');

  } finally {
    client.disconnect();
  }
}

main();
