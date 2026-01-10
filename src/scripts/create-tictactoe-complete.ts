/**
 * 完全動作するマルバツゲーム作成スクリプト
 * UI + ProtoFluxロジック一括作成
 *
 * 使い方: npx tsx src/scripts/create-tictactoe-complete.ts [ws://localhost:3343]
 */
import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:3343';

// ヘルパー: コンポーネントを探す (typeまたはcomponentTypeを確認)
function findComponent(data: any, typeIncludes: string, exclude?: string) {
  return data?.components?.find((c: any) => {
    const typeStr = c.type || c.componentType || '';
    const match = typeStr.includes(typeIncludes);
    if (exclude) return match && !typeStr.includes(exclude);
    return match;
  });
}

// ヘルパー: 複数のコンポーネントを探す
function findComponents(data: any, typeIncludes: string, exclude?: string) {
  return data?.components?.filter((c: any) => {
    const typeStr = c.type || c.componentType || '';
    const match = typeStr.includes(typeIncludes);
    if (exclude) return match && !typeStr.includes(exclude);
    return match;
  }) || [];
}

// ヘルパー: スロットIDを取得
async function getChildSlotId(client: ResoniteLinkClient, parentId: string, name: string): Promise<string> {
  const data = await client.getSlot({ slotId: parentId, depth: 1 });
  const child = data.data?.children?.find((c: any) => c.name?.value === name);
  if (!child?.id) throw new Error(`Child slot "${name}" not found in ${parentId}`);
  return child.id;
}

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Creating Complete Tic-Tac-Toe Game...\n');

    // ========== 1. メインスロット作成 ==========
    const slotName = `TicTacToe_Play_${Date.now()}`;
    await client.addSlot({
      name: slotName,
      position: { x: 0, y: 1.5, z: 1.5 },
      isActive: true,
    });

    const mainSlot = await client.findSlotByName(slotName, 'Root', 1);
    if (!mainSlot?.id) throw new Error('Main slot not found');
    const mainId = mainSlot.id;
    console.log(`Main slot: ${mainId}`);

    await client.updateSlot({
      id: mainId,
      scale: { x: 0.001, y: 0.001, z: 0.001 },
    });

    // ========== 2. Canvas + UI_UnlitMaterial ==========
    await client.addComponent({ containerSlotId: mainId, componentType: '[FrooxEngine]FrooxEngine.UIX.Canvas' });
    await client.addComponent({ containerSlotId: mainId, componentType: '[FrooxEngine]FrooxEngine.Grabbable' });
    await client.addComponent({ containerSlotId: mainId, componentType: '[FrooxEngine]FrooxEngine.UI_UnlitMaterial' });

    let mainData = await client.getSlot({ slotId: mainId, includeComponentData: true });
    const canvas = findComponent(mainData.data, 'Canvas');
    const uiMaterial = findComponent(mainData.data, 'UI_UnlitMaterial');

    if (canvas?.id) {
      await client.updateComponent({
        id: canvas.id,
        members: { Size: { $type: 'float2', value: { x: 400, y: 480 } } } as any,
      });
    }
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

    // ========== 3. GameState スロット（ゲーム状態管理）==========
    await client.addSlot({ parentId: mainId, name: 'GameState' });
    const gameStateId = await getChildSlotId(client, mainId, 'GameState');

    // isOTurn (○のターンかどうか)
    await client.addComponent({ containerSlotId: gameStateId, componentType: '[FrooxEngine]FrooxEngine.ValueField<bool>' });

    // 9個のセル状態 (ValueField<string>)
    for (let i = 0; i < 9; i++) {
      await client.addComponent({ containerSlotId: gameStateId, componentType: '[FrooxEngine]FrooxEngine.ValueField<string>' });
    }

    let gameStateData = await client.getSlot({ slotId: gameStateId, includeComponentData: true });
    const isOTurnField = findComponent(gameStateData.data, 'ValueField<bool>');
    const cellFields = findComponents(gameStateData.data, 'ValueField<string>');

    if (isOTurnField?.id) {
      await client.updateComponent({
        id: isOTurnField.id,
        members: { Value: { $type: 'bool', value: true } } as any,
      });
    }
    console.log(`  GameState: isOTurn=${isOTurnField?.id}, cells=${cellFields.length}`);

    // ========== 4. 背景 ==========
    await client.addSlot({ parentId: mainId, name: 'Background' });
    const bgId = await getChildSlotId(client, mainId, 'Background');

    await client.addComponent({ containerSlotId: bgId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: bgId, componentType: '[FrooxEngine]FrooxEngine.UIX.Image' });

    let bgData = await client.getSlot({ slotId: bgId, includeComponentData: true });
    const bgRect = findComponent(bgData.data, 'RectTransform');
    const bgImage = findComponent(bgData.data, 'Image');

    if (bgRect?.id) {
      await client.updateComponent({
        id: bgRect.id,
        members: {
          AnchorMin: { $type: 'float2', value: { x: 0, y: 0 } },
          AnchorMax: { $type: 'float2', value: { x: 1, y: 1 } },
        } as any,
      });
    }
    if (bgImage?.id) {
      await client.updateComponent({
        id: bgImage.id,
        members: {
          Tint: { $type: 'colorX', value: { r: 0.1, g: 0.12, b: 0.18, a: 0.98 } },
          Material: { $type: 'reference', targetId: uiMaterial?.id },
        } as any,
      });
    }
    console.log('  Background created');

    // ========== 5. Content (VerticalLayout) ==========
    await client.addSlot({ parentId: mainId, name: 'Content' });
    const contentId = await getChildSlotId(client, mainId, 'Content');

    await client.addComponent({ containerSlotId: contentId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: contentId, componentType: '[FrooxEngine]FrooxEngine.UIX.VerticalLayout' });

    let contentData = await client.getSlot({ slotId: contentId, includeComponentData: true });
    const contentRect = findComponent(contentData.data, 'RectTransform');
    const vLayout = findComponent(contentData.data, 'VerticalLayout');

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
          Spacing: { $type: 'float', value: 10 },
          ForceExpandWidth: { $type: 'bool', value: true },
          ForceExpandHeight: { $type: 'bool', value: false },
        } as any,
      });
    }

    // ========== 6. Header ==========
    await client.addSlot({ parentId: contentId, name: 'Header' });
    const headerId = await getChildSlotId(client, contentId, 'Header');

    await client.addComponent({ containerSlotId: headerId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: headerId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: headerId, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

    let headerData = await client.getSlot({ slotId: headerId, includeComponentData: true });
    const headerLayout = findComponent(headerData.data, 'LayoutElement');
    const headerText = findComponent(headerData.data, 'Text', 'TextField');

    if (headerLayout?.id) {
      await client.updateComponent({
        id: headerLayout.id,
        members: { PreferredHeight: { $type: 'float', value: 50 } } as any,
      });
    }
    if (headerText?.id) {
      await client.updateComponent({
        id: headerText.id,
        members: {
          Content: { $type: 'string', value: '○×ゲーム' },
          Size: { $type: 'float', value: 36 },
          Color: { $type: 'colorX', value: { r: 1, g: 1, b: 1, a: 1 } },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
        } as any,
      });
    }
    console.log('  Header created');

    // ========== 7. TurnDisplay ==========
    await client.addSlot({ parentId: contentId, name: 'TurnDisplay' });
    const turnDisplayId = await getChildSlotId(client, contentId, 'TurnDisplay');

    await client.addComponent({ containerSlotId: turnDisplayId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: turnDisplayId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: turnDisplayId, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

    let turnData = await client.getSlot({ slotId: turnDisplayId, includeComponentData: true });
    const turnLayout = findComponent(turnData.data, 'LayoutElement');
    const turnText = findComponent(turnData.data, 'Text', 'TextField');

    if (turnLayout?.id) {
      await client.updateComponent({
        id: turnLayout.id,
        members: { PreferredHeight: { $type: 'float', value: 35 } } as any,
      });
    }
    if (turnText?.id) {
      await client.updateComponent({
        id: turnText.id,
        members: {
          Content: { $type: 'string', value: '○ の番' },
          Size: { $type: 'float', value: 24 },
          Color: { $type: 'colorX', value: { r: 0.5, g: 0.8, b: 1, a: 1 } },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
        } as any,
      });
    }
    console.log('  TurnDisplay created');

    // ========== 8. Board (3x3 Grid) ==========
    await client.addSlot({ parentId: contentId, name: 'Board' });
    const boardId = await getChildSlotId(client, contentId, 'Board');

    await client.addComponent({ containerSlotId: boardId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: boardId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: boardId, componentType: '[FrooxEngine]FrooxEngine.UIX.VerticalLayout' });

    let boardData = await client.getSlot({ slotId: boardId, includeComponentData: true });
    const boardLayout = findComponent(boardData.data, 'LayoutElement');
    const boardVLayout = findComponent(boardData.data, 'VerticalLayout');

    if (boardLayout?.id) {
      await client.updateComponent({
        id: boardLayout.id,
        members: { PreferredHeight: { $type: 'float', value: 300 } } as any,
      });
    }
    if (boardVLayout?.id) {
      await client.updateComponent({
        id: boardVLayout.id,
        members: {
          Spacing: { $type: 'float', value: 8 },
          ForceExpandWidth: { $type: 'bool', value: true },
          ForceExpandHeight: { $type: 'bool', value: true },
        } as any,
      });
    }

    // セル情報を保存
    const cellTextIds: string[] = [];
    const cellTriggerIds: string[] = [];  // ButtonDynamicImpulseTrigger IDs

    // 3行 x 3列 作成
    for (let row = 0; row < 3; row++) {
      await client.addSlot({ parentId: boardId, name: `Row${row}` });
      const rowId = await getChildSlotId(client, boardId, `Row${row}`);

      await client.addComponent({ containerSlotId: rowId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
      await client.addComponent({ containerSlotId: rowId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
      await client.addComponent({ containerSlotId: rowId, componentType: '[FrooxEngine]FrooxEngine.UIX.HorizontalLayout' });

      let rowData = await client.getSlot({ slotId: rowId, includeComponentData: true });
      const rowLayout = findComponent(rowData.data, 'LayoutElement');
      const rowHLayout = findComponent(rowData.data, 'HorizontalLayout');

      if (rowLayout?.id) {
        await client.updateComponent({
          id: rowLayout.id,
          members: { FlexibleHeight: { $type: 'float', value: 1 } } as any,
        });
      }
      if (rowHLayout?.id) {
        await client.updateComponent({
          id: rowHLayout.id,
          members: {
            Spacing: { $type: 'float', value: 8 },
            ForceExpandWidth: { $type: 'bool', value: true },
            ForceExpandHeight: { $type: 'bool', value: true },
          } as any,
        });
      }

      for (let col = 0; col < 3; col++) {
        const cellIdx = row * 3 + col;
        const cellName = `Cell_${row}_${col}`;

        await client.addSlot({ parentId: rowId, name: cellName });
        const cellId = await getChildSlotId(client, rowId, cellName);

        await client.addComponent({ containerSlotId: cellId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
        await client.addComponent({ containerSlotId: cellId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
        await client.addComponent({ containerSlotId: cellId, componentType: '[FrooxEngine]FrooxEngine.UIX.Image' });
        await client.addComponent({ containerSlotId: cellId, componentType: '[FrooxEngine]FrooxEngine.UIX.Button' });
        await client.addComponent({ containerSlotId: cellId, componentType: '[FrooxEngine]FrooxEngine.ButtonDynamicImpulseTrigger' });

        let cellData = await client.getSlot({ slotId: cellId, includeComponentData: true });
        const cellLayout = findComponent(cellData.data, 'LayoutElement');
        const cellImage = findComponent(cellData.data, 'Image');
        const cellTrigger = findComponent(cellData.data, 'ButtonDynamicImpulseTrigger');

        if (cellLayout?.id) {
          await client.updateComponent({
            id: cellLayout.id,
            members: { FlexibleWidth: { $type: 'float', value: 1 }, FlexibleHeight: { $type: 'float', value: 1 } } as any,
          });
        }
        if (cellImage?.id) {
          await client.updateComponent({
            id: cellImage.id,
            members: { Tint: { $type: 'colorX', value: { r: 0.2, g: 0.22, b: 0.28, a: 1 } } } as any,
          });
        }
        if (cellTrigger?.id) {
          await client.updateComponent({
            id: cellTrigger.id,
            members: {
              PressedTag: { $type: 'string', value: `Cell_${cellIdx}` },
              Target: { $type: 'reference', targetId: mainId },  // 同じゲーム内のReceiverのみ反応
            } as any,
          });
          cellTriggerIds.push(cellTrigger.id);
        }

        // セル内テキスト
        await client.addSlot({ parentId: cellId, name: 'Text' });
        const textSlotId = await getChildSlotId(client, cellId, 'Text');

        await client.addComponent({ containerSlotId: textSlotId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
        await client.addComponent({ containerSlotId: textSlotId, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

        let textData = await client.getSlot({ slotId: textSlotId, includeComponentData: true });
        const textRect = findComponent(textData.data, 'RectTransform');
        const textComp = findComponent(textData.data, 'Text', 'TextField');

        if (textRect?.id) {
          await client.updateComponent({
            id: textRect.id,
            members: {
              AnchorMin: { $type: 'float2', value: { x: 0, y: 0 } },
              AnchorMax: { $type: 'float2', value: { x: 1, y: 1 } },
            } as any,
          });
        }
        if (textComp?.id) {
          await client.updateComponent({
            id: textComp.id,
            members: {
              Content: { $type: 'string', value: '' },
              Size: { $type: 'float', value: 56 },
              Color: { $type: 'colorX', value: { r: 1, g: 1, b: 1, a: 1 } },
              HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
              VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
            } as any,
          });
          cellTextIds.push(textComp.id);
        }
      }
    }
    console.log('  Board created (3x3)');

    // ========== 9. ResetButton ==========
    await client.addSlot({ parentId: contentId, name: 'ResetButton' });
    const resetBtnId = await getChildSlotId(client, contentId, 'ResetButton');

    await client.addComponent({ containerSlotId: resetBtnId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: resetBtnId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: resetBtnId, componentType: '[FrooxEngine]FrooxEngine.UIX.Image' });
    await client.addComponent({ containerSlotId: resetBtnId, componentType: '[FrooxEngine]FrooxEngine.UIX.Button' });
    await client.addComponent({ containerSlotId: resetBtnId, componentType: '[FrooxEngine]FrooxEngine.ButtonDynamicImpulseTrigger' });

    let resetData = await client.getSlot({ slotId: resetBtnId, includeComponentData: true });
    const resetLayout = findComponent(resetData.data, 'LayoutElement');
    const resetImage = findComponent(resetData.data, 'Image');
    const resetTrigger = findComponent(resetData.data, 'ButtonDynamicImpulseTrigger');

    if (resetLayout?.id) {
      await client.updateComponent({
        id: resetLayout.id,
        members: { PreferredHeight: { $type: 'float', value: 45 } } as any,
      });
    }
    if (resetImage?.id) {
      await client.updateComponent({
        id: resetImage.id,
        members: { Tint: { $type: 'colorX', value: { r: 0.6, g: 0.25, b: 0.25, a: 1 } } } as any,
      });
    }
    if (resetTrigger?.id) {
      await client.updateComponent({
        id: resetTrigger.id,
        members: {
          PressedTag: { $type: 'string', value: 'Reset' },
          Target: { $type: 'reference', targetId: mainId },  // 同じゲーム内のReceiverのみ反応
        } as any,
      });
    }

    // ResetButton Text
    await client.addSlot({ parentId: resetBtnId, name: 'Text' });
    const resetTextSlotId = await getChildSlotId(client, resetBtnId, 'Text');

    await client.addComponent({ containerSlotId: resetTextSlotId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: resetTextSlotId, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

    let resetTextData = await client.getSlot({ slotId: resetTextSlotId, includeComponentData: true });
    const resetTextRect = findComponent(resetTextData.data, 'RectTransform');
    const resetTextComp = findComponent(resetTextData.data, 'Text', 'TextField');

    if (resetTextRect?.id) {
      await client.updateComponent({
        id: resetTextRect.id,
        members: {
          AnchorMin: { $type: 'float2', value: { x: 0, y: 0 } },
          AnchorMax: { $type: 'float2', value: { x: 1, y: 1 } },
        } as any,
      });
    }
    if (resetTextComp?.id) {
      await client.updateComponent({
        id: resetTextComp.id,
        members: {
          Content: { $type: 'string', value: 'リセット' },
          Size: { $type: 'float', value: 22 },
          Color: { $type: 'colorX', value: { r: 1, g: 1, b: 1, a: 1 } },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
          VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
        } as any,
      });
    }
    console.log('  ResetButton created');

    // ========== 10. ValueFieldDrive でセルテキストをドライブ ==========
    for (let i = 0; i < 9 && i < cellFields.length && i < cellTextIds.length; i++) {
      const cellField = cellFields[i];
      const textCompId = cellTextIds[i];

      await client.addComponent({
        containerSlotId: gameStateId,
        componentType: '[FrooxEngine]FrooxEngine.ValueDriver<string>',
      });

      // 追加されたドライブを取得
      gameStateData = await client.getSlot({ slotId: gameStateId, includeComponentData: true });
      const drives = findComponents(gameStateData.data, 'ValueDriver');
      const drive = drives[drives.length - 1];

      if (drive?.id) {
        // TextコンポーネントのContentフィールドIDを取得
        const textDetails = await client.getComponent(textCompId);
        const contentFieldId = textDetails.data?.members?.Content?.id;

        // ValueField<string>のValueフィールドIDを取得
        const cellFieldDetails = await client.getComponent(cellField.id);
        const cellValueId = cellFieldDetails.data?.members?.Value?.id;

        // ドライブ設定
        const driveDetails = await client.getComponent(drive.id);
        const driveTargetId = driveDetails.data?.members?.DriveTarget?.id;

        await client.updateComponent({
          id: drive.id,
          members: {
            ValueSource: { $type: 'reference', targetId: cellValueId },
            DriveTarget: { $type: 'reference', id: driveTargetId, targetId: contentFieldId },
          } as any,
        });
      }
    }
    console.log('  Cell text drives connected');

    // ========== 11. TurnDisplayをドライブ (BooleanValueDriver) ==========
    await client.addComponent({
      containerSlotId: gameStateId,
      componentType: '[FrooxEngine]FrooxEngine.BooleanValueDriver<string>',
    });

    gameStateData = await client.getSlot({ slotId: gameStateId, includeComponentData: true });
    const turnDriver = findComponent(gameStateData.data, 'BooleanValueDriver');

    if (turnDriver?.id && turnText?.id && isOTurnField?.id) {
      // TurnTextのContentフィールドIDを取得
      const turnTextDetails = await client.getComponent(turnText.id);
      const turnContentId = turnTextDetails.data?.members?.Content?.id;

      // BooleanValueDriverの詳細を取得
      const turnDriverDetails = await client.getComponent(turnDriver.id);
      const targetFieldId = turnDriverDetails.data?.members?.TargetField?.id;

      // TrueValue/FalseValueを設定
      await client.updateComponent({
        id: turnDriver.id,
        members: {
          TrueValue: { $type: 'string', value: '○ の番' },
          FalseValue: { $type: 'string', value: '× の番' },
        } as any,
      });

      // TargetFieldを設定（FieldDrive - ドライブ先）
      await client.updateComponent({
        id: turnDriver.id,
        members: {
          TargetField: { $type: 'reference', id: targetFieldId, targetId: turnContentId },
        } as any,
      });

      // StateをisOTurnからドライブするためにValueDriver<bool>を追加
      await client.addComponent({
        containerSlotId: gameStateId,
        componentType: '[FrooxEngine]FrooxEngine.ValueDriver<bool>',
      });

      gameStateData = await client.getSlot({ slotId: gameStateId, includeComponentData: true });
      const stateDrives = findComponents(gameStateData.data, 'ValueDriver<bool>');
      const stateDrive = stateDrives[stateDrives.length - 1];

      if (stateDrive?.id) {
        // isOTurnFieldのValueフィールドIDを取得
        const isOTurnDetails = await client.getComponent(isOTurnField.id);
        const isOTurnValueId = isOTurnDetails.data?.members?.Value?.id;

        // BooleanValueDriverのStateフィールドIDを取得
        const turnDriverRefresh = await client.getComponent(turnDriver.id);
        const stateFieldId = turnDriverRefresh.data?.members?.State?.id;

        const stateDriveDetails = await client.getComponent(stateDrive.id);
        const driveTargetId = stateDriveDetails.data?.members?.DriveTarget?.id;

        // ValueDriver: isOTurnField.Value → BooleanValueDriver.State
        await client.updateComponent({
          id: stateDrive.id,
          members: {
            ValueSource: { $type: 'reference', targetId: isOTurnValueId },
            DriveTarget: { $type: 'reference', id: driveTargetId, targetId: stateFieldId },
          } as any,
        });
      }
    }
    console.log('  TurnDisplay driver connected');

    // ========== 12. ProtoFlux (ゲームロジック) ==========
    // 重要: 1スロットに1つのProtoFluxコンポーネントのみ
    await client.addSlot({ parentId: mainId, name: 'Flux' });
    const fluxId = await getChildSlotId(client, mainId, 'Flux');

    // 各セル用のProtoFlux
    for (let i = 0; i < 9; i++) {
      const cellField = cellFields[i];
      if (!cellField?.id) continue;

      const row = Math.floor(i / 3);
      const col = i % 3;
      const baseX = (col - 1) * 1.5;
      const baseY = (1 - row) * 1.2;

      // セル用の親スロット
      await client.addSlot({
        parentId: fluxId,
        name: `Cell_${i}`,
        position: { x: baseX, y: baseY, z: 0 },
      });
      const cellLogicId = await getChildSlotId(client, fluxId, `Cell_${i}`);

      // 各ノード用のスロットを作成
      // CellSource = ObjectValueSource<string>, TurnSource = ValueSource<bool>
      // Note: EmptyStrは不要。ValueField<string>の初期値はnullなので、Equals.Bを接続しないことでnull比較になる
      const nodeNames = ['Receiver', 'TagInput', 'If', 'Equals', 'Conditional', 'OInput', 'XInput', 'CellSource', 'TurnSource', 'Write', 'TurnWrite', 'Not'];
      for (const name of nodeNames) {
        await client.addSlot({ parentId: cellLogicId, name });
      }

      // スロットIDを取得
      const cellLogicData = await client.getSlot({ slotId: cellLogicId, depth: 1 });
      const getNodeSlotId = (name: string) => cellLogicData.data?.children?.find((c: any) => c.name?.value === name)?.id;

      const receiverSlotId = getNodeSlotId('Receiver');
      const tagInputSlotId = getNodeSlotId('TagInput');
      const ifSlotId = getNodeSlotId('If');
      const equalsSlotId = getNodeSlotId('Equals');
      const conditionalSlotId = getNodeSlotId('Conditional');
      const oInputSlotId = getNodeSlotId('OInput');
      const xInputSlotId = getNodeSlotId('XInput');
      const cellSourceSlotId = getNodeSlotId('CellSource');
      const turnSourceSlotId = getNodeSlotId('TurnSource');
      const writeSlotId = getNodeSlotId('Write');
      const turnWriteSlotId = getNodeSlotId('TurnWrite');
      const notSlotId = getNodeSlotId('Not');

      // 各スロットにコンポーネントを追加
      await client.addComponent({ containerSlotId: receiverSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Actions.DynamicImpulseReceiver' });
      // GlobalValue<string>はIGlobalValueProxy<string>を実装（DynamicImpulseReceiver.Tagに必要）
      await client.addComponent({ containerSlotId: tagInputSlotId, componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalValue<string>' });
      await client.addComponent({ containerSlotId: ifSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.If' });
      await client.addComponent({ containerSlotId: equalsSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectEquals<string>' });
      await client.addComponent({ containerSlotId: conditionalSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectConditional<string>' });
      await client.addComponent({ containerSlotId: oInputSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueObjectInput<string>' });
      await client.addComponent({ containerSlotId: xInputSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueObjectInput<string>' });
      // ObjectValueSource<string> - セル状態を読み書きするためのSource (IVariable<FrooxEngineContext, T>を実装)
      await client.addComponent({ containerSlotId: cellSourceSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectValueSource<string>' });
      // ValueSource<bool> - ターン状態を読み書きするためのSource (IVariable<FrooxEngineContext, T>を実装)
      await client.addComponent({ containerSlotId: turnSourceSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueSource<bool>' });
      // FrooxEngineContext版のWrite系ノード（ObjectValueSource/ValueSourceと互換性のため）
      await client.addComponent({ containerSlotId: writeSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,string>' });
      await client.addComponent({ containerSlotId: turnWriteSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,bool>' });
      await client.addComponent({ containerSlotId: notSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.NOT_Bool' });

      // 各コンポーネントを取得
      const getComp = async (slotId: string, typeIncludes: string) => {
        const data = await client.getSlot({ slotId, includeComponentData: true });
        return findComponent(data.data, typeIncludes);
      };

      const receiverComp = await getComp(receiverSlotId, 'DynamicImpulseReceiver');
      const tagInputComp = await getComp(tagInputSlotId, 'GlobalValue');
      const ifComp = await getComp(ifSlotId, 'If');
      const equalsComp = await getComp(equalsSlotId, 'ObjectEquals');
      const conditionalComp = await getComp(conditionalSlotId, 'ObjectConditional');
      const oInputComp = await getComp(oInputSlotId, 'ValueObjectInput');
      const xInputComp = await getComp(xInputSlotId, 'ValueObjectInput');
      const cellSourceComp = await getComp(cellSourceSlotId, 'ObjectValueSource');
      const turnSourceComp = await getComp(turnSourceSlotId, 'ValueSource');
      const writeComp = await getComp(writeSlotId, 'ObjectWrite');
      const turnWriteComp = await getComp(turnWriteSlotId, 'ValueWrite');
      const notComp = await getComp(notSlotId, 'NOT_Bool');

      // TagInput設定 & Receiver.Tag ← TagInput
      if (tagInputComp?.id) {
        await client.updateComponent({ id: tagInputComp.id, members: { Value: { $type: 'string', value: `Cell_${i}` } } as any });
      }
      if (receiverComp?.id && tagInputComp?.id) {
        await client.updateComponent({
          id: receiverComp.id,
          members: { Tag: { $type: 'reference', targetId: tagInputComp.id } } as any,
        });
      }

      // 値入力設定
      if (oInputComp?.id) {
        await client.updateComponent({ id: oInputComp.id, members: { Value: { $type: 'string', value: '○' } } as any });
      }
      if (xInputComp?.id) {
        await client.updateComponent({ id: xInputComp.id, members: { Value: { $type: 'string', value: '×' } } as any });
      }

      // ObjectValueSource/ValueSource のSource設定
      // GlobalReferenceを手動で追加し、SourceとReferenceを設定する
      // 重要: GlobalReference.ReferenceにはValueField.Value（IValue<T>を実装）を設定する
      if (cellSourceComp?.id) {
        // GlobalReference<IValue<string>>を追加
        await client.addComponent({
          containerSlotId: cellSourceSlotId,
          componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<string>>',
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        const cellSourceSlotData = await client.getSlot({ slotId: cellSourceSlotId, includeComponentData: true });
        const globalRefComp = findComponent(cellSourceSlotData.data, 'GlobalReference');

        // ValueField<string>.Value のIDを取得
        const cellFieldDetails = await client.getComponent(cellField.id);
        const cellValueId = cellFieldDetails.data?.members?.Value?.id;

        if (globalRefComp?.id && cellValueId) {
          // GlobalReference.Reference → ValueField<string>.Value (IValue<string>)
          await client.updateComponent({
            id: globalRefComp.id,
            members: { Reference: { $type: 'reference', targetId: cellValueId } } as any,
          });
          // ObjectValueSource.Source → GlobalReference
          await client.updateComponent({
            id: cellSourceComp.id,
            members: { Source: { $type: 'reference', targetId: globalRefComp.id } } as any,
          });
        }
      }
      if (turnSourceComp?.id && isOTurnField?.id) {
        // GlobalReference<IValue<bool>>を追加
        await client.addComponent({
          containerSlotId: turnSourceSlotId,
          componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<bool>>',
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        const turnSourceSlotData = await client.getSlot({ slotId: turnSourceSlotId, includeComponentData: true });
        const globalRefComp = findComponent(turnSourceSlotData.data, 'GlobalReference');

        // ValueField<bool>.Value のIDを取得
        const turnFieldDetails = await client.getComponent(isOTurnField.id);
        const turnValueId = turnFieldDetails.data?.members?.Value?.id;

        if (globalRefComp?.id && turnValueId) {
          // GlobalReference.Reference → ValueField<bool>.Value (IValue<bool>)
          await client.updateComponent({
            id: globalRefComp.id,
            members: { Reference: { $type: 'reference', targetId: turnValueId } } as any,
          });
          // ValueSource.Source → GlobalReference
          await client.updateComponent({
            id: turnSourceComp.id,
            members: { Source: { $type: 'reference', targetId: globalRefComp.id } } as any,
          });
        }
      }

      // ノード接続
      // Receiver.OnTriggered → If
      if (receiverComp?.id && ifComp?.id) {
        const receiverDetails = await client.getComponent(receiverComp.id);
        const onTriggeredId = receiverDetails.data?.members?.OnTriggered?.id;
        await client.updateComponent({
          id: receiverComp.id,
          members: { OnTriggered: { $type: 'reference', id: onTriggeredId, targetId: ifComp.id } } as any,
        });
      }

      // If.Condition ← Equals
      if (ifComp?.id && equalsComp?.id) {
        await client.updateComponent({
          id: ifComp.id,
          members: { Condition: { $type: 'reference', targetId: equalsComp.id } } as any,
        });
      }

      // Equals.A ← CellSource, Equals.B は接続しない（null比較になる）
      // ValueField<string>の初期値はnullなので、セルが空かどうかは (cellValue == null) でチェック
      if (equalsComp?.id && cellSourceComp?.id) {
        await client.updateComponent({
          id: equalsComp.id,
          members: {
            A: { $type: 'reference', targetId: cellSourceComp.id },
            // B は未接続のまま（null）
          } as any,
        });
      }

      // If.OnTrue → Write
      if (ifComp?.id && writeComp?.id) {
        const ifDetails = await client.getComponent(ifComp.id);
        const onTrueId = ifDetails.data?.members?.OnTrue?.id;
        await client.updateComponent({
          id: ifComp.id,
          members: { OnTrue: { $type: 'reference', id: onTrueId, targetId: writeComp.id } } as any,
        });
      }

      // Write.Variable ← CellSource (IVariableを実装), Write.Value ← Conditional
      if (writeComp?.id && cellSourceComp?.id && conditionalComp?.id) {
        await client.updateComponent({
          id: writeComp.id,
          members: {
            Variable: { $type: 'reference', targetId: cellSourceComp.id },
            Value: { $type: 'reference', targetId: conditionalComp.id },
          } as any,
        });
      }

      // Conditional.Condition ← TurnSource (bool出力), Conditional.OnTrue ← OInput, Conditional.OnFalse ← XInput
      if (conditionalComp?.id && turnSourceComp?.id && oInputComp?.id && xInputComp?.id) {
        await client.updateComponent({
          id: conditionalComp.id,
          members: {
            Condition: { $type: 'reference', targetId: turnSourceComp.id },
            OnTrue: { $type: 'reference', targetId: oInputComp.id },
            OnFalse: { $type: 'reference', targetId: xInputComp.id },
          } as any,
        });
      }

      // Write.OnWritten → TurnWrite
      if (writeComp?.id && turnWriteComp?.id) {
        const writeDetails = await client.getComponent(writeComp.id);
        const onWrittenId = writeDetails.data?.members?.OnWritten?.id;
        await client.updateComponent({
          id: writeComp.id,
          members: { OnWritten: { $type: 'reference', id: onWrittenId, targetId: turnWriteComp.id } } as any,
        });
      }

      // TurnWrite.Variable ← TurnSource (IVariableを実装), TurnWrite.Value ← Not
      if (turnWriteComp?.id && turnSourceComp?.id && notComp?.id) {
        await client.updateComponent({
          id: turnWriteComp.id,
          members: {
            Variable: { $type: 'reference', targetId: turnSourceComp.id },
            Value: { $type: 'reference', targetId: notComp.id },
          } as any,
        });
      }

      // Not.A ← TurnSource (bool出力)
      if (notComp?.id && turnSourceComp?.id) {
        await client.updateComponent({
          id: notComp.id,
          members: { A: { $type: 'reference', targetId: turnSourceComp.id } } as any,
        });
      }

      console.log(`  Cell_${i}: ProtoFlux nodes created and connected`);
    }

    // リセット用ロジック
    await client.addSlot({ parentId: fluxId, name: 'Reset', position: { x: 5, y: 0, z: 0 } });
    const resetId = await getChildSlotId(client, fluxId, 'Reset');

    // リセット用ノード作成
    // EmptyStrは不要 - ObjectWrite.Valueを接続しないことでnullが書き込まれる
    const resetNodeNames = ['Receiver', 'TagInput', 'TrueInput'];
    // 9個のセルクリア用 + 1個のターンリセット用
    for (let i = 0; i < 9; i++) {
      resetNodeNames.push(`CellSource_${i}`, `CellWrite_${i}`);
    }
    resetNodeNames.push('TurnSource', 'TurnWrite');

    for (const name of resetNodeNames) {
      await client.addSlot({ parentId: resetId, name });
    }

    const resetSlotData = await client.getSlot({ slotId: resetId, depth: 1 });
    const getResetSlotId = (name: string) => resetSlotData.data?.children?.find((c: any) => c.name?.value === name)?.id;

    const resetReceiverSlotId = getResetSlotId('Receiver');
    const resetTagInputSlotId = getResetSlotId('TagInput');
    const resetTrueInputSlotId = getResetSlotId('TrueInput');

    // 基本コンポーネント追加
    await client.addComponent({ containerSlotId: resetReceiverSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Actions.DynamicImpulseReceiver' });
    await client.addComponent({ containerSlotId: resetTagInputSlotId, componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalValue<string>' });
    await client.addComponent({ containerSlotId: resetTrueInputSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<bool>' });

    // 各セル用のSource + Writeを追加
    const cellWriteComps: any[] = [];
    for (let i = 0; i < 9; i++) {
      const cellSourceSlotId = getResetSlotId(`CellSource_${i}`);
      const cellWriteSlotId = getResetSlotId(`CellWrite_${i}`);

      // ObjectValueSource + GlobalReference
      await client.addComponent({ containerSlotId: cellSourceSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectValueSource<string>' });
      await client.addComponent({ containerSlotId: cellSourceSlotId, componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<string>>' });
      // ObjectWrite (FrooxEngineContext)
      await client.addComponent({ containerSlotId: cellWriteSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,string>' });

      await new Promise(resolve => setTimeout(resolve, 30));

      // コンポーネント取得
      const cellSourceData = await client.getSlot({ slotId: cellSourceSlotId, includeComponentData: true });
      const cellSourceComp = findComponent(cellSourceData.data, 'ObjectValueSource');
      const cellGlobalRefComp = findComponent(cellSourceData.data, 'GlobalReference');
      const cellWriteData = await client.getSlot({ slotId: cellWriteSlotId, includeComponentData: true });
      const cellWriteComp = findComponent(cellWriteData.data, 'ObjectWrite');

      // cellFields[i]のValue IDを取得
      if (cellFields[i]?.id) {
        const cellFieldDetails = await client.getComponent(cellFields[i].id);
        const cellValueId = cellFieldDetails.data?.members?.Value?.id;

        if (cellGlobalRefComp?.id && cellValueId) {
          await client.updateComponent({
            id: cellGlobalRefComp.id,
            members: { Reference: { $type: 'reference', targetId: cellValueId } } as any,
          });
        }
        if (cellSourceComp?.id && cellGlobalRefComp?.id) {
          await client.updateComponent({
            id: cellSourceComp.id,
            members: { Source: { $type: 'reference', targetId: cellGlobalRefComp.id } } as any,
          });
        }
      }

      cellWriteComps.push({ sourceComp: cellSourceComp, writeComp: cellWriteComp });
    }

    // ターン用のSource + Write
    const resetTurnSourceSlotId = getResetSlotId('TurnSource');
    const resetTurnWriteSlotId = getResetSlotId('TurnWrite');

    await client.addComponent({ containerSlotId: resetTurnSourceSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueSource<bool>' });
    await client.addComponent({ containerSlotId: resetTurnSourceSlotId, componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<bool>>' });
    await client.addComponent({ containerSlotId: resetTurnWriteSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,bool>' });

    await new Promise(resolve => setTimeout(resolve, 30));

    const resetTurnSourceData = await client.getSlot({ slotId: resetTurnSourceSlotId, includeComponentData: true });
    const resetTurnSourceComp = findComponent(resetTurnSourceData.data, 'ValueSource');
    const resetTurnGlobalRefComp = findComponent(resetTurnSourceData.data, 'GlobalReference');
    const resetTurnWriteData = await client.getSlot({ slotId: resetTurnWriteSlotId, includeComponentData: true });
    const resetTurnWriteComp = findComponent(resetTurnWriteData.data, 'ValueWrite');

    if (isOTurnField?.id && resetTurnGlobalRefComp?.id) {
      const turnFieldDetails = await client.getComponent(isOTurnField.id);
      const turnValueId = turnFieldDetails.data?.members?.Value?.id;

      if (turnValueId) {
        await client.updateComponent({
          id: resetTurnGlobalRefComp.id,
          members: { Reference: { $type: 'reference', targetId: turnValueId } } as any,
        });
      }
      if (resetTurnSourceComp?.id) {
        await client.updateComponent({
          id: resetTurnSourceComp.id,
          members: { Source: { $type: 'reference', targetId: resetTurnGlobalRefComp.id } } as any,
        });
      }
    }

    // 基本コンポーネント取得
    const resetReceiverData2 = await client.getSlot({ slotId: resetReceiverSlotId, includeComponentData: true });
    const resetReceiverComp = findComponent(resetReceiverData2.data, 'DynamicImpulseReceiver');
    const resetTagInputData = await client.getSlot({ slotId: resetTagInputSlotId, includeComponentData: true });
    const resetTagInputComp = findComponent(resetTagInputData.data, 'GlobalValue');
    const resetTrueInputData = await client.getSlot({ slotId: resetTrueInputSlotId, includeComponentData: true });
    const resetTrueInputComp = findComponent(resetTrueInputData.data, 'ValueInput');

    // 値設定
    if (resetTagInputComp?.id) {
      await client.updateComponent({
        id: resetTagInputComp.id,
        members: { Value: { $type: 'string', value: 'Reset' } } as any,
      });
    }
    if (resetTrueInputComp?.id) {
      await client.updateComponent({
        id: resetTrueInputComp.id,
        members: { Value: { $type: 'bool', value: true } } as any,
      });
    }

    // Receiver.Tag接続
    if (resetReceiverComp?.id && resetTagInputComp?.id) {
      await client.updateComponent({
        id: resetReceiverComp.id,
        members: { Tag: { $type: 'reference', targetId: resetTagInputComp.id } } as any,
      });
    }

    // 実行フロー接続: Receiver → CellWrite_0 → CellWrite_1 → ... → CellWrite_8 → TurnWrite
    // 各CellWriteのVariable/Value接続 + OnWritten接続
    let prevWriteComp = null;
    for (let i = 0; i < 9; i++) {
      const { sourceComp, writeComp } = cellWriteComps[i];
      if (!writeComp?.id) continue;

      // Variable ← Source, Value は接続しない（nullが書き込まれる）
      if (sourceComp?.id) {
        await client.updateComponent({
          id: writeComp.id,
          members: {
            Variable: { $type: 'reference', targetId: sourceComp.id },
            // Value は未接続（null）
          } as any,
        });
      }

      // 前のノードからの接続
      if (i === 0 && resetReceiverComp?.id) {
        // Receiver.OnTriggered → CellWrite_0
        const receiverDetails = await client.getComponent(resetReceiverComp.id);
        const onTriggeredId = receiverDetails.data?.members?.OnTriggered?.id;
        await client.updateComponent({
          id: resetReceiverComp.id,
          members: { OnTriggered: { $type: 'reference', id: onTriggeredId, targetId: writeComp.id } } as any,
        });
      } else if (prevWriteComp?.id) {
        // prevWrite.OnWritten → currentWrite
        const prevDetails = await client.getComponent(prevWriteComp.id);
        const onWrittenId = prevDetails.data?.members?.OnWritten?.id;
        await client.updateComponent({
          id: prevWriteComp.id,
          members: { OnWritten: { $type: 'reference', id: onWrittenId, targetId: writeComp.id } } as any,
        });
      }

      prevWriteComp = writeComp;
    }

    // 最後のCellWrite → TurnWrite
    if (prevWriteComp?.id && resetTurnWriteComp?.id) {
      const prevDetails = await client.getComponent(prevWriteComp.id);
      const onWrittenId = prevDetails.data?.members?.OnWritten?.id;
      await client.updateComponent({
        id: prevWriteComp.id,
        members: { OnWritten: { $type: 'reference', id: onWrittenId, targetId: resetTurnWriteComp.id } } as any,
      });
    }

    // TurnWrite: Variable ← TurnSource, Value ← TrueInput
    if (resetTurnWriteComp?.id && resetTurnSourceComp?.id && resetTrueInputComp?.id) {
      await client.updateComponent({
        id: resetTurnWriteComp.id,
        members: {
          Variable: { $type: 'reference', targetId: resetTurnSourceComp.id },
          Value: { $type: 'reference', targetId: resetTrueInputComp.id },
        } as any,
      });
    }

    console.log('  Reset logic created and connected');
    console.log('  ProtoFlux logic created and connected');

    // ========== 完了 ==========
    console.log('\n========================================');
    console.log('=== Tic-Tac-Toe Game Created! ===');
    console.log('========================================');
    console.log(`\nLocation: ${slotName}`);
    console.log('\n【機能】');
    console.log('- セルクリック: ○/×を交互に配置');
    console.log('- 空セルチェック: 既にマークがあるセルはクリック無効');
    console.log('- ターン表示: 現在の手番を表示');
    console.log('- リセットボタン: 全セルクリア + ターンを○に戻す');

  } finally {
    client.disconnect();
  }
}

main();
