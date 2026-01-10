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
    // isGameOver (ゲーム終了フラグ)
    await client.addComponent({ containerSlotId: gameStateId, componentType: '[FrooxEngine]FrooxEngine.ValueField<bool>' });

    // 9個のセル状態 (ValueField<string>)
    for (let i = 0; i < 9; i++) {
      await client.addComponent({ containerSlotId: gameStateId, componentType: '[FrooxEngine]FrooxEngine.ValueField<string>' });
    }
    // resultText (結果表示用)
    await client.addComponent({ containerSlotId: gameStateId, componentType: '[FrooxEngine]FrooxEngine.ValueField<string>' });

    let gameStateData = await client.getSlot({ slotId: gameStateId, includeComponentData: true });
    const boolFields = findComponents(gameStateData.data, 'ValueField<bool>');
    const stringFields = findComponents(gameStateData.data, 'ValueField<string>');
    const isOTurnField = boolFields[0];  // 最初のbool
    const isGameOverField = boolFields[1];  // 2番目のbool
    const cellFields = stringFields.slice(0, 9);  // 最初の9個のstring
    const resultTextField = stringFields[9];  // 10番目のstring

    if (isOTurnField?.id) {
      await client.updateComponent({
        id: isOTurnField.id,
        members: { Value: { $type: 'bool', value: true } } as any,
      });
    }
    if (isGameOverField?.id) {
      await client.updateComponent({
        id: isGameOverField.id,
        members: { Value: { $type: 'bool', value: false } } as any,
      });
    }
    console.log(`  GameState: isOTurn=${isOTurnField?.id}, isGameOver=${isGameOverField?.id}, cells=${cellFields.length}, resultText=${resultTextField?.id}`);

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

    // ========== 7.5. ResultDisplay (勝敗結果表示) ==========
    await client.addSlot({ parentId: contentId, name: 'ResultDisplay' });
    const resultDisplayId = await getChildSlotId(client, contentId, 'ResultDisplay');

    await client.addComponent({ containerSlotId: resultDisplayId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: resultDisplayId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: resultDisplayId, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

    let resultDisplayData = await client.getSlot({ slotId: resultDisplayId, includeComponentData: true });
    const resultLayout = findComponent(resultDisplayData.data, 'LayoutElement');
    const resultText = findComponent(resultDisplayData.data, 'Text', 'TextField');

    if (resultLayout?.id) {
      await client.updateComponent({
        id: resultLayout.id,
        members: { PreferredHeight: { $type: 'float', value: 35 } } as any,
      });
    }
    if (resultText?.id) {
      await client.updateComponent({
        id: resultText.id,
        members: {
          Content: { $type: 'string', value: '' },
          Size: { $type: 'float', value: 28 },
          Color: { $type: 'colorX', value: { r: 1, g: 0.9, b: 0.3, a: 1 } },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
        } as any,
      });
    }

    // ResultDisplayは常に表示（空文字なら見えない、結果が入ったら表示される）
    console.log('  ResultDisplay created');

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

    // ========== 11.5. 表示切り替え（一時的に無効化） ==========
    // 注意: SlotのActiveSelfをドライブするにはコンポーネントIDが必要だが、
    // スロットはコンポーネントではないためResoniteLinkで直接取得できない。
    // 現時点では、TurnDisplayとResultDisplayの両方を表示する。
    // ResultDisplayはゲーム終了時のみ結果テキストを表示する（それ以外は空）。
    console.log('  Display visibility drivers skipped (not implemented yet)');

    // ResultDisplay.Text.Content を resultTextField.Value でドライブ
    if (resultText?.id && resultTextField?.id) {
      await client.addComponent({
        containerSlotId: gameStateId,
        componentType: '[FrooxEngine]FrooxEngine.ValueDriver<string>',
      });
      gameStateData = await client.getSlot({ slotId: gameStateId, includeComponentData: true });
      const resultTextDrives = findComponents(gameStateData.data, 'ValueDriver<string>');
      const resultTextDrive = resultTextDrives[resultTextDrives.length - 1];

      if (resultTextDrive?.id) {
        const resultTextFieldDetails = await client.getComponent(resultTextField.id);
        const resultTextValueId = resultTextFieldDetails.data?.members?.Value?.id;
        const resultTextCompDetails = await client.getComponent(resultText.id);
        const resultContentId = resultTextCompDetails.data?.members?.Content?.id;
        const resultTextDriveDetails = await client.getComponent(resultTextDrive.id);
        const driveTargetId = resultTextDriveDetails.data?.members?.DriveTarget?.id;

        await client.updateComponent({
          id: resultTextDrive.id,
          members: {
            ValueSource: { $type: 'reference', targetId: resultTextValueId },
            DriveTarget: { $type: 'reference', id: driveTargetId, targetId: resultContentId },
          } as any,
        });
      }
    }
    console.log('  ResultDisplay text driver connected');

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
      // GameOverSource, NotGameOver, ConditionAnd: ゲーム終了チェック用
      // CheckWinTrigger: セル更新後に勝敗チェックを呼び出す
      const nodeNames = ['Receiver', 'TagInput', 'If', 'Equals', 'Conditional', 'OInput', 'XInput', 'CellSource', 'TurnSource', 'Write', 'TurnWrite', 'Not', 'GameOverSource', 'NotGameOver', 'ConditionAnd', 'CheckWinTrigger', 'CheckWinTag'];
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
      const gameOverSourceSlotId = getNodeSlotId('GameOverSource');
      const notGameOverSlotId = getNodeSlotId('NotGameOver');
      const conditionAndSlotId = getNodeSlotId('ConditionAnd');
      const checkWinTriggerSlotId = getNodeSlotId('CheckWinTrigger');
      const checkWinTagSlotId = getNodeSlotId('CheckWinTag');

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
      // ゲーム終了チェック用
      await client.addComponent({ containerSlotId: gameOverSourceSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueSource<bool>' });
      await client.addComponent({ containerSlotId: notGameOverSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.NOT_Bool' });
      await client.addComponent({ containerSlotId: conditionAndSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });
      // 勝敗チェック用Trigger
      await client.addComponent({ containerSlotId: checkWinTriggerSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Actions.DynamicImpulseTrigger' });
      // DynamicImpulseTrigger.Tag は INodeObjectOutput<string> を期待するので ValueObjectInput を使う
      await client.addComponent({ containerSlotId: checkWinTagSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueObjectInput<string>' });

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
      const gameOverSourceComp = await getComp(gameOverSourceSlotId, 'ValueSource');
      const notGameOverComp = await getComp(notGameOverSlotId, 'NOT_Bool');
      const conditionAndComp = await getComp(conditionAndSlotId, 'AND_Bool');
      const checkWinTriggerComp = await getComp(checkWinTriggerSlotId, 'DynamicImpulseTrigger');
      const checkWinTagComp = await getComp(checkWinTagSlotId, 'ValueObjectInput');

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

      // GameOverSource の設定（isGameOverFieldを参照）
      if (gameOverSourceComp?.id && isGameOverField?.id) {
        await client.addComponent({
          containerSlotId: gameOverSourceSlotId,
          componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<bool>>',
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        const gameOverSourceSlotData = await client.getSlot({ slotId: gameOverSourceSlotId, includeComponentData: true });
        const globalRefComp = findComponent(gameOverSourceSlotData.data, 'GlobalReference');

        const gameOverFieldDetails = await client.getComponent(isGameOverField.id);
        const gameOverValueId = gameOverFieldDetails.data?.members?.Value?.id;

        if (globalRefComp?.id && gameOverValueId) {
          await client.updateComponent({
            id: globalRefComp.id,
            members: { Reference: { $type: 'reference', targetId: gameOverValueId } } as any,
          });
          await client.updateComponent({
            id: gameOverSourceComp.id,
            members: { Source: { $type: 'reference', targetId: globalRefComp.id } } as any,
          });
        }
      }

      // NotGameOver.A ← GameOverSource（ゲーム終了していない = NOT(isGameOver)）
      if (notGameOverComp?.id && gameOverSourceComp?.id) {
        await client.updateComponent({
          id: notGameOverComp.id,
          members: { A: { $type: 'reference', targetId: gameOverSourceComp.id } } as any,
        });
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

      // If.Condition ← ConditionAnd（セル空 AND ゲーム終了していない）
      if (ifComp?.id && conditionAndComp?.id) {
        await client.updateComponent({
          id: ifComp.id,
          members: { Condition: { $type: 'reference', targetId: conditionAndComp.id } } as any,
        });
      }

      // ConditionAnd.A ← Equals（セルが空か）, ConditionAnd.B ← NotGameOver（ゲーム終了していないか）
      if (conditionAndComp?.id && equalsComp?.id && notGameOverComp?.id) {
        await client.updateComponent({
          id: conditionAndComp.id,
          members: {
            A: { $type: 'reference', targetId: equalsComp.id },
            B: { $type: 'reference', targetId: notGameOverComp.id },
          } as any,
        });
      }

      // Equals.A ← CellSource（セル値）, Equals.B は未接続（null比較）
      if (equalsComp?.id && cellSourceComp?.id) {
        await client.updateComponent({
          id: equalsComp.id,
          members: {
            A: { $type: 'reference', targetId: cellSourceComp.id },
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

      // CheckWinTag設定（"CheckWin"タグ）
      if (checkWinTagComp?.id) {
        await client.updateComponent({
          id: checkWinTagComp.id,
          members: { Value: { $type: 'string', value: 'CheckWin' } } as any,
        });
      }

      // TargetHierarchy用のRefObjectInput<Slot>を追加
      await client.addSlot({ parentId: cellLogicId, name: 'TargetSlot' });
      const targetSlotSlotId = await getChildSlotId(client, cellLogicId, 'TargetSlot');
      await client.addComponent({
        containerSlotId: targetSlotSlotId,
        componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.RefObjectInput<[FrooxEngine]FrooxEngine.Slot>',
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      const targetSlotData = await client.getSlot({ slotId: targetSlotSlotId, includeComponentData: true });
      const targetSlotComp = findComponent(targetSlotData.data, 'RefObjectInput');

      // TargetSlot に mainId を設定
      if (targetSlotComp?.id) {
        await client.updateComponent({
          id: targetSlotComp.id,
          members: { Target: { $type: 'reference', targetId: mainId } } as any,
        });
      }

      // CheckWinTrigger設定: Tag ← CheckWinTag, TargetHierarchy ← TargetSlot
      if (checkWinTriggerComp?.id && checkWinTagComp?.id && targetSlotComp?.id) {
        await client.updateComponent({
          id: checkWinTriggerComp.id,
          members: {
            Tag: { $type: 'reference', targetId: checkWinTagComp.id },
            TargetHierarchy: { $type: 'reference', targetId: targetSlotComp.id },
          } as any,
        });
      }

      // TurnWrite.OnWritten → CheckWinTrigger（ターン更新後に勝敗チェック）
      if (turnWriteComp?.id && checkWinTriggerComp?.id) {
        const turnWriteDetails = await client.getComponent(turnWriteComp.id);
        const onWrittenId = turnWriteDetails.data?.members?.OnWritten?.id;
        await client.updateComponent({
          id: turnWriteComp.id,
          members: { OnWritten: { $type: 'reference', id: onWrittenId, targetId: checkWinTriggerComp.id } } as any,
        });
      }

      console.log(`  Cell_${i}: ProtoFlux nodes created and connected`);
    }

    // ========== 勝敗判定ロジック ==========
    console.log('  Creating win check logic...');
    await client.addSlot({ parentId: fluxId, name: 'WinCheck', position: { x: 3, y: 0, z: 0 } });
    const winCheckId = await getChildSlotId(client, fluxId, 'WinCheck');

    // 8ラインの定義: [セルA, セルB, セルC]
    const lines = [
      [0, 1, 2], // 横1行目
      [3, 4, 5], // 横2行目
      [6, 7, 8], // 横3行目
      [0, 3, 6], // 縦1列目
      [1, 4, 7], // 縦2列目
      [2, 5, 8], // 縦3列目
      [0, 4, 8], // 斜め左上→右下
      [2, 4, 6], // 斜め右上→左下
    ];

    // 勝敗判定用ノードを作成
    const winCheckNodes = [
      'Receiver', 'TagInput',  // DynamicImpulse受信
      'IfWinner', 'IfDraw',    // 勝者/引き分け判定分岐
      'GameOverWrite', 'GameOverSource', // isGameOver書き込み用
      'ResultWrite', 'ResultSource', // resultText書き込み用
      'TrueInput',             // true定数
      'OWinText', 'XWinText', 'DrawText', // 結果テキスト
      'WinnerConditional',     // 勝者マーク選択
      'DrawConditional',       // 引き分けテキスト選択
    ];
    // 8ライン分のセルソースと比較ノード
    for (let l = 0; l < 8; l++) {
      winCheckNodes.push(`L${l}_CellA`, `L${l}_CellB`, `L${l}_CellC`);  // 3セル読み取り
      winCheckNodes.push(`L${l}_EqAB`, `L${l}_EqBC`, `L${l}_NotNull`);  // 比較ノード
      winCheckNodes.push(`L${l}_And1`, `L${l}_And2`);                   // AND
    }
    // 8ラインのOR（チェーン構造）
    winCheckNodes.push('Or_01', 'Or_23', 'Or_45', 'Or_67', 'Or_0123', 'Or_4567', 'OrAll');
    // 引き分け判定（9セルがnullでない）
    for (let c = 0; c < 9; c++) {
      winCheckNodes.push(`Draw_Cell${c}`, `Draw_NotNull${c}`);
    }
    // 9セルのANDチェーン: And_01, And_012, ..., And_01234567, Draw_AndAll
    winCheckNodes.push('Draw_And_01', 'Draw_And_012', 'Draw_And_0123', 'Draw_And_01234', 'Draw_And_012345', 'Draw_And_0123456', 'Draw_And_01234567', 'Draw_AndAll', 'Draw_NotWin', 'Draw_Final');
    // 勝者マーク取得用
    winCheckNodes.push('WinnerMark');

    for (const name of winCheckNodes) {
      await client.addSlot({ parentId: winCheckId, name });
    }

    const winCheckData = await client.getSlot({ slotId: winCheckId, depth: 1 });
    const getWinSlotId = (name: string) => winCheckData.data?.children?.find((c: any) => c.name?.value === name)?.id;

    // 基本ノードのコンポーネント追加
    const receiverWinSlotId = getWinSlotId('Receiver');
    const tagInputWinSlotId = getWinSlotId('TagInput');
    const ifWinnerSlotId = getWinSlotId('IfWinner');
    const ifDrawSlotId = getWinSlotId('IfDraw');
    const gameOverWriteSlotId = getWinSlotId('GameOverWrite');
    const gameOverSourceSlotId2 = getWinSlotId('GameOverSource');
    const resultWriteSlotId = getWinSlotId('ResultWrite');
    const resultSourceSlotId = getWinSlotId('ResultSource');
    const trueInputWinSlotId = getWinSlotId('TrueInput');
    const oWinTextSlotId = getWinSlotId('OWinText');
    const xWinTextSlotId = getWinSlotId('XWinText');
    const drawTextSlotId = getWinSlotId('DrawText');
    const winnerConditionalSlotId = getWinSlotId('WinnerConditional');
    const winnerMarkSlotId = getWinSlotId('WinnerMark');

    await client.addComponent({ containerSlotId: receiverWinSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Actions.DynamicImpulseReceiver' });
    await client.addComponent({ containerSlotId: tagInputWinSlotId, componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalValue<string>' });
    await client.addComponent({ containerSlotId: ifWinnerSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.If' });
    await client.addComponent({ containerSlotId: ifDrawSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.If' });
    await client.addComponent({ containerSlotId: gameOverWriteSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,bool>' });
    await client.addComponent({ containerSlotId: gameOverSourceSlotId2, componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueSource<bool>' });
    await client.addComponent({ containerSlotId: resultWriteSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,string>' });
    await client.addComponent({ containerSlotId: resultSourceSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectValueSource<string>' });
    await client.addComponent({ containerSlotId: trueInputWinSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<bool>' });
    await client.addComponent({ containerSlotId: oWinTextSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueObjectInput<string>' });
    await client.addComponent({ containerSlotId: xWinTextSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueObjectInput<string>' });
    await client.addComponent({ containerSlotId: drawTextSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueObjectInput<string>' });
    await client.addComponent({ containerSlotId: winnerConditionalSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectConditional<string>' });
    await client.addComponent({ containerSlotId: winnerMarkSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectValueSource<string>' });

    // 8ライン分のノード追加
    for (let l = 0; l < 8; l++) {
      await client.addComponent({ containerSlotId: getWinSlotId(`L${l}_CellA`), componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectValueSource<string>' });
      await client.addComponent({ containerSlotId: getWinSlotId(`L${l}_CellB`), componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectValueSource<string>' });
      await client.addComponent({ containerSlotId: getWinSlotId(`L${l}_CellC`), componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectValueSource<string>' });
      await client.addComponent({ containerSlotId: getWinSlotId(`L${l}_EqAB`), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectEquals<string>' });
      await client.addComponent({ containerSlotId: getWinSlotId(`L${l}_EqBC`), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectEquals<string>' });
      await client.addComponent({ containerSlotId: getWinSlotId(`L${l}_NotNull`), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectNotEquals<string>' });
      await client.addComponent({ containerSlotId: getWinSlotId(`L${l}_And1`), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });
      await client.addComponent({ containerSlotId: getWinSlotId(`L${l}_And2`), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });
    }

    // ORノード追加（チェーン構造）
    await client.addComponent({ containerSlotId: getWinSlotId('Or_01'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.OR_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Or_23'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.OR_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Or_45'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.OR_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Or_67'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.OR_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Or_0123'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.OR_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Or_4567'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.OR_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('OrAll'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.OR_Bool' });

    // 引き分け判定用ノード追加
    for (let c = 0; c < 9; c++) {
      await client.addComponent({ containerSlotId: getWinSlotId(`Draw_Cell${c}`), componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectValueSource<string>' });
      await client.addComponent({ containerSlotId: getWinSlotId(`Draw_NotNull${c}`), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectNotEquals<string>' });
    }
    // ANDチェーン（9セル判定）
    await client.addComponent({ containerSlotId: getWinSlotId('Draw_And_01'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Draw_And_012'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Draw_And_0123'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Draw_And_01234'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Draw_And_012345'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Draw_And_0123456'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Draw_And_01234567'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Draw_AndAll'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Draw_NotWin'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.NOT_Bool' });
    await client.addComponent({ containerSlotId: getWinSlotId('Draw_Final'), componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.AND_Bool' });

    await new Promise(resolve => setTimeout(resolve, 100));

    // コンポーネント取得用ヘルパー
    const getWinComp = async (name: string, typeIncludes: string) => {
      const slotId = getWinSlotId(name);
      if (!slotId) return null;
      const data = await client.getSlot({ slotId, includeComponentData: true });
      return findComponent(data.data, typeIncludes);
    };

    // 基本ノード設定
    const receiverWinComp = await getWinComp('Receiver', 'DynamicImpulseReceiver');
    const tagInputWinComp = await getWinComp('TagInput', 'GlobalValue');
    const ifWinnerComp = await getWinComp('IfWinner', 'If');
    const ifDrawComp = await getWinComp('IfDraw', 'If');
    const gameOverWriteComp = await getWinComp('GameOverWrite', 'ValueWrite');
    const gameOverSourceComp2 = await getWinComp('GameOverSource', 'ValueSource');
    const resultWriteComp = await getWinComp('ResultWrite', 'ObjectWrite');
    const resultSourceComp = await getWinComp('ResultSource', 'ObjectValueSource');
    const trueInputWinComp = await getWinComp('TrueInput', 'ValueInput');
    const oWinTextComp = await getWinComp('OWinText', 'ValueObjectInput');
    const xWinTextComp = await getWinComp('XWinText', 'ValueObjectInput');
    const drawTextComp = await getWinComp('DrawText', 'ValueObjectInput');
    const winnerConditionalComp = await getWinComp('WinnerConditional', 'ObjectConditional');
    const winnerMarkComp = await getWinComp('WinnerMark', 'ObjectValueSource');
    const or_01Comp = await getWinComp('Or_01', 'OR_Bool');
    const or_23Comp = await getWinComp('Or_23', 'OR_Bool');
    const or_45Comp = await getWinComp('Or_45', 'OR_Bool');
    const or_67Comp = await getWinComp('Or_67', 'OR_Bool');
    const or_0123Comp = await getWinComp('Or_0123', 'OR_Bool');
    const or_4567Comp = await getWinComp('Or_4567', 'OR_Bool');
    const orAllComp = await getWinComp('OrAll', 'OR_Bool');

    // タグ設定
    if (tagInputWinComp?.id) {
      await client.updateComponent({ id: tagInputWinComp.id, members: { Value: { $type: 'string', value: 'CheckWin' } } as any });
    }
    if (receiverWinComp?.id && tagInputWinComp?.id) {
      await client.updateComponent({
        id: receiverWinComp.id,
        members: { Tag: { $type: 'reference', targetId: tagInputWinComp.id } } as any,
      });
    }

    // 値設定
    if (trueInputWinComp?.id) {
      await client.updateComponent({ id: trueInputWinComp.id, members: { Value: { $type: 'bool', value: true } } as any });
    }
    if (oWinTextComp?.id) {
      await client.updateComponent({ id: oWinTextComp.id, members: { Value: { $type: 'string', value: '○の勝ち!' } } as any });
    }
    if (xWinTextComp?.id) {
      await client.updateComponent({ id: xWinTextComp.id, members: { Value: { $type: 'string', value: '×の勝ち!' } } as any });
    }
    if (drawTextComp?.id) {
      await client.updateComponent({ id: drawTextComp.id, members: { Value: { $type: 'string', value: '引き分け!' } } as any });
    }

    // GameOverSource/ResultSource の GlobalReference設定
    if (gameOverSourceComp2?.id && isGameOverField?.id) {
      await client.addComponent({
        containerSlotId: gameOverSourceSlotId2,
        componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<bool>>',
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      const slotData = await client.getSlot({ slotId: gameOverSourceSlotId2, includeComponentData: true });
      const globalRefComp = findComponent(slotData.data, 'GlobalReference');
      const fieldDetails = await client.getComponent(isGameOverField.id);
      const valueId = fieldDetails.data?.members?.Value?.id;
      if (globalRefComp?.id && valueId) {
        await client.updateComponent({ id: globalRefComp.id, members: { Reference: { $type: 'reference', targetId: valueId } } as any });
        await client.updateComponent({ id: gameOverSourceComp2.id, members: { Source: { $type: 'reference', targetId: globalRefComp.id } } as any });
      }
    }

    if (resultSourceComp?.id && resultTextField?.id) {
      await client.addComponent({
        containerSlotId: resultSourceSlotId,
        componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<string>>',
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      const slotData = await client.getSlot({ slotId: resultSourceSlotId, includeComponentData: true });
      const globalRefComp = findComponent(slotData.data, 'GlobalReference');
      const fieldDetails = await client.getComponent(resultTextField.id);
      const valueId = fieldDetails.data?.members?.Value?.id;
      if (globalRefComp?.id && valueId) {
        await client.updateComponent({ id: globalRefComp.id, members: { Reference: { $type: 'reference', targetId: valueId } } as any });
        await client.updateComponent({ id: resultSourceComp.id, members: { Source: { $type: 'reference', targetId: globalRefComp.id } } as any });
      }
    }

    // 8ライン分のセルソース設定と比較接続
    const lineResults: any[] = [];
    for (let l = 0; l < 8; l++) {
      const [a, b, c] = lines[l];

      // CellA/B/C の Source設定
      for (const [suffix, cellIdx] of [['CellA', a], ['CellB', b], ['CellC', c]] as const) {
        const cellSourceComp = await getWinComp(`L${l}_${suffix}`, 'ObjectValueSource');
        const cellField = cellFields[cellIdx];
        if (cellSourceComp?.id && cellField?.id) {
          const slotId = getWinSlotId(`L${l}_${suffix}`);
          await client.addComponent({
            containerSlotId: slotId,
            componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<string>>',
          });
          await new Promise(resolve => setTimeout(resolve, 30));
          const slotData = await client.getSlot({ slotId, includeComponentData: true });
          const globalRefComp = findComponent(slotData.data, 'GlobalReference');
          const fieldDetails = await client.getComponent(cellField.id);
          const valueId = fieldDetails.data?.members?.Value?.id;
          if (globalRefComp?.id && valueId) {
            await client.updateComponent({ id: globalRefComp.id, members: { Reference: { $type: 'reference', targetId: valueId } } as any });
            await client.updateComponent({ id: cellSourceComp.id, members: { Source: { $type: 'reference', targetId: globalRefComp.id } } as any });
          }
        }
      }

      const cellAComp = await getWinComp(`L${l}_CellA`, 'ObjectValueSource');
      const cellBComp = await getWinComp(`L${l}_CellB`, 'ObjectValueSource');
      const cellCComp = await getWinComp(`L${l}_CellC`, 'ObjectValueSource');
      const eqABComp = await getWinComp(`L${l}_EqAB`, 'ObjectEquals');
      const eqBCComp = await getWinComp(`L${l}_EqBC`, 'ObjectEquals');
      const notNullComp = await getWinComp(`L${l}_NotNull`, 'ObjectNotEquals');
      const and1Comp = await getWinComp(`L${l}_And1`, 'AND_Bool');
      const and2Comp = await getWinComp(`L${l}_And2`, 'AND_Bool');

      // EqAB: A == B
      if (eqABComp?.id && cellAComp?.id && cellBComp?.id) {
        await client.updateComponent({
          id: eqABComp.id,
          members: { A: { $type: 'reference', targetId: cellAComp.id }, B: { $type: 'reference', targetId: cellBComp.id } } as any,
        });
      }

      // EqBC: B == C
      if (eqBCComp?.id && cellBComp?.id && cellCComp?.id) {
        await client.updateComponent({
          id: eqBCComp.id,
          members: { A: { $type: 'reference', targetId: cellBComp.id }, B: { $type: 'reference', targetId: cellCComp.id } } as any,
        });
      }

      // NotNull: A != null（Bを未接続でnull比較）
      if (notNullComp?.id && cellAComp?.id) {
        await client.updateComponent({
          id: notNullComp.id,
          members: { A: { $type: 'reference', targetId: cellAComp.id } } as any,
        });
      }

      // And1: EqAB AND EqBC
      if (and1Comp?.id && eqABComp?.id && eqBCComp?.id) {
        await client.updateComponent({
          id: and1Comp.id,
          members: { A: { $type: 'reference', targetId: eqABComp.id }, B: { $type: 'reference', targetId: eqBCComp.id } } as any,
        });
      }

      // And2: And1 AND NotNull （3つ同じ AND nullでない）
      if (and2Comp?.id && and1Comp?.id && notNullComp?.id) {
        await client.updateComponent({
          id: and2Comp.id,
          members: { A: { $type: 'reference', targetId: and1Comp.id }, B: { $type: 'reference', targetId: notNullComp.id } } as any,
        });
      }

      lineResults.push(and2Comp);
    }

    // ORチェーン: 8ラインを2つずつOR → 4つを2つずつOR → 最終OR
    // Or_01: line0 OR line1
    if (or_01Comp?.id && lineResults[0]?.id && lineResults[1]?.id) {
      await client.updateComponent({
        id: or_01Comp.id,
        members: { A: { $type: 'reference', targetId: lineResults[0].id }, B: { $type: 'reference', targetId: lineResults[1].id } } as any,
      });
    }
    // Or_23: line2 OR line3
    if (or_23Comp?.id && lineResults[2]?.id && lineResults[3]?.id) {
      await client.updateComponent({
        id: or_23Comp.id,
        members: { A: { $type: 'reference', targetId: lineResults[2].id }, B: { $type: 'reference', targetId: lineResults[3].id } } as any,
      });
    }
    // Or_45: line4 OR line5
    if (or_45Comp?.id && lineResults[4]?.id && lineResults[5]?.id) {
      await client.updateComponent({
        id: or_45Comp.id,
        members: { A: { $type: 'reference', targetId: lineResults[4].id }, B: { $type: 'reference', targetId: lineResults[5].id } } as any,
      });
    }
    // Or_67: line6 OR line7
    if (or_67Comp?.id && lineResults[6]?.id && lineResults[7]?.id) {
      await client.updateComponent({
        id: or_67Comp.id,
        members: { A: { $type: 'reference', targetId: lineResults[6].id }, B: { $type: 'reference', targetId: lineResults[7].id } } as any,
      });
    }
    // Or_0123: Or_01 OR Or_23
    if (or_0123Comp?.id && or_01Comp?.id && or_23Comp?.id) {
      await client.updateComponent({
        id: or_0123Comp.id,
        members: { A: { $type: 'reference', targetId: or_01Comp.id }, B: { $type: 'reference', targetId: or_23Comp.id } } as any,
      });
    }
    // Or_4567: Or_45 OR Or_67
    if (or_4567Comp?.id && or_45Comp?.id && or_67Comp?.id) {
      await client.updateComponent({
        id: or_4567Comp.id,
        members: { A: { $type: 'reference', targetId: or_45Comp.id }, B: { $type: 'reference', targetId: or_67Comp.id } } as any,
      });
    }
    // OrAll: Or_0123 OR Or_4567
    if (orAllComp?.id && or_0123Comp?.id && or_4567Comp?.id) {
      await client.updateComponent({
        id: orAllComp.id,
        members: { A: { $type: 'reference', targetId: or_0123Comp.id }, B: { $type: 'reference', targetId: or_4567Comp.id } } as any,
      });
    }

    // 引き分け判定用のセルソース設定
    const drawNotNullComps: any[] = [];
    for (let c = 0; c < 9; c++) {
      const cellSourceComp = await getWinComp(`Draw_Cell${c}`, 'ObjectValueSource');
      const cellField = cellFields[c];
      if (cellSourceComp?.id && cellField?.id) {
        const slotId = getWinSlotId(`Draw_Cell${c}`);
        await client.addComponent({
          containerSlotId: slotId,
          componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<string>>',
        });
        await new Promise(resolve => setTimeout(resolve, 30));
        const slotData = await client.getSlot({ slotId, includeComponentData: true });
        const globalRefComp = findComponent(slotData.data, 'GlobalReference');
        const fieldDetails = await client.getComponent(cellField.id);
        const valueId = fieldDetails.data?.members?.Value?.id;
        if (globalRefComp?.id && valueId) {
          await client.updateComponent({ id: globalRefComp.id, members: { Reference: { $type: 'reference', targetId: valueId } } as any });
          await client.updateComponent({ id: cellSourceComp.id, members: { Source: { $type: 'reference', targetId: globalRefComp.id } } as any });
        }
      }

      const notNullComp = await getWinComp(`Draw_NotNull${c}`, 'ObjectNotEquals');
      if (notNullComp?.id && cellSourceComp?.id) {
        await client.updateComponent({
          id: notNullComp.id,
          members: { A: { $type: 'reference', targetId: cellSourceComp.id } } as any,
        });
      }
      drawNotNullComps.push(notNullComp);
    }

    // ANDチェーン: 9セルすべてがnullでないかチェック
    // Draw_And_01: NotNull0 AND NotNull1
    const drawAnd_01Comp = await getWinComp('Draw_And_01', 'AND_Bool');
    if (drawAnd_01Comp?.id && drawNotNullComps[0]?.id && drawNotNullComps[1]?.id) {
      await client.updateComponent({
        id: drawAnd_01Comp.id,
        members: { A: { $type: 'reference', targetId: drawNotNullComps[0].id }, B: { $type: 'reference', targetId: drawNotNullComps[1].id } } as any,
      });
    }
    // Draw_And_012: Draw_And_01 AND NotNull2
    const drawAnd_012Comp = await getWinComp('Draw_And_012', 'AND_Bool');
    if (drawAnd_012Comp?.id && drawAnd_01Comp?.id && drawNotNullComps[2]?.id) {
      await client.updateComponent({
        id: drawAnd_012Comp.id,
        members: { A: { $type: 'reference', targetId: drawAnd_01Comp.id }, B: { $type: 'reference', targetId: drawNotNullComps[2].id } } as any,
      });
    }
    // Draw_And_0123: Draw_And_012 AND NotNull3
    const drawAnd_0123Comp = await getWinComp('Draw_And_0123', 'AND_Bool');
    if (drawAnd_0123Comp?.id && drawAnd_012Comp?.id && drawNotNullComps[3]?.id) {
      await client.updateComponent({
        id: drawAnd_0123Comp.id,
        members: { A: { $type: 'reference', targetId: drawAnd_012Comp.id }, B: { $type: 'reference', targetId: drawNotNullComps[3].id } } as any,
      });
    }
    // Draw_And_01234: Draw_And_0123 AND NotNull4
    const drawAnd_01234Comp = await getWinComp('Draw_And_01234', 'AND_Bool');
    if (drawAnd_01234Comp?.id && drawAnd_0123Comp?.id && drawNotNullComps[4]?.id) {
      await client.updateComponent({
        id: drawAnd_01234Comp.id,
        members: { A: { $type: 'reference', targetId: drawAnd_0123Comp.id }, B: { $type: 'reference', targetId: drawNotNullComps[4].id } } as any,
      });
    }
    // Draw_And_012345: Draw_And_01234 AND NotNull5
    const drawAnd_012345Comp = await getWinComp('Draw_And_012345', 'AND_Bool');
    if (drawAnd_012345Comp?.id && drawAnd_01234Comp?.id && drawNotNullComps[5]?.id) {
      await client.updateComponent({
        id: drawAnd_012345Comp.id,
        members: { A: { $type: 'reference', targetId: drawAnd_01234Comp.id }, B: { $type: 'reference', targetId: drawNotNullComps[5].id } } as any,
      });
    }
    // Draw_And_0123456: Draw_And_012345 AND NotNull6
    const drawAnd_0123456Comp = await getWinComp('Draw_And_0123456', 'AND_Bool');
    if (drawAnd_0123456Comp?.id && drawAnd_012345Comp?.id && drawNotNullComps[6]?.id) {
      await client.updateComponent({
        id: drawAnd_0123456Comp.id,
        members: { A: { $type: 'reference', targetId: drawAnd_012345Comp.id }, B: { $type: 'reference', targetId: drawNotNullComps[6].id } } as any,
      });
    }
    // Draw_And_01234567: Draw_And_0123456 AND NotNull7
    const drawAnd_01234567Comp = await getWinComp('Draw_And_01234567', 'AND_Bool');
    if (drawAnd_01234567Comp?.id && drawAnd_0123456Comp?.id && drawNotNullComps[7]?.id) {
      await client.updateComponent({
        id: drawAnd_01234567Comp.id,
        members: { A: { $type: 'reference', targetId: drawAnd_0123456Comp.id }, B: { $type: 'reference', targetId: drawNotNullComps[7].id } } as any,
      });
    }
    // Draw_AndAll: Draw_And_01234567 AND NotNull8
    const drawAndAllComp = await getWinComp('Draw_AndAll', 'AND_Bool');
    if (drawAndAllComp?.id && drawAnd_01234567Comp?.id && drawNotNullComps[8]?.id) {
      await client.updateComponent({
        id: drawAndAllComp.id,
        members: { A: { $type: 'reference', targetId: drawAnd_01234567Comp.id }, B: { $type: 'reference', targetId: drawNotNullComps[8].id } } as any,
      });
    }

    // Draw_NotWin: NOT(勝者あり)
    const drawNotWinComp = await getWinComp('Draw_NotWin', 'NOT_Bool');
    if (drawNotWinComp?.id && orAllComp?.id) {
      await client.updateComponent({
        id: drawNotWinComp.id,
        members: { A: { $type: 'reference', targetId: orAllComp.id } } as any,
      });
    }

    // Draw_Final: 全セル埋まっている AND 勝者なし
    const drawFinalComp = await getWinComp('Draw_Final', 'AND_Bool');
    if (drawFinalComp?.id && drawAndAllComp?.id && drawNotWinComp?.id) {
      await client.updateComponent({
        id: drawFinalComp.id,
        members: { A: { $type: 'reference', targetId: drawAndAllComp.id }, B: { $type: 'reference', targetId: drawNotWinComp.id } } as any,
      });
    }

    // WinnerMark: 勝利ライン0のCellAを使用（最初のライン）
    // 注意: どのラインで勝ったかを判定するのは複雑なので、簡略化してTurnSourceを使う
    // 勝者は直前のターンのプレイヤーなので、現在のターンの逆
    // TurnSource = isOTurn なので、勝者は NOT(isOTurn) ? "○" : "×"
    // しかし、勝敗判定時点ではターンが既に切り替わっているため、isOTurn ? "×" : "○" となる

    // WinnerConditional設定: isOTurn ? "×の勝ち" : "○の勝ち"
    // 勝者マーク取得用のValueSource<bool>を追加
    await client.addSlot({ parentId: winCheckId, name: 'WinnerTurnSource' });
    const winnerTurnSourceSlotId = await getChildSlotId(client, winCheckId, 'WinnerTurnSource');
    await client.addComponent({ containerSlotId: winnerTurnSourceSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueSource<bool>' });

    await new Promise(resolve => setTimeout(resolve, 50));
    const winnerTurnSourceData = await client.getSlot({ slotId: winnerTurnSourceSlotId, includeComponentData: true });
    const winnerTurnSourceComp = findComponent(winnerTurnSourceData.data, 'ValueSource');

    if (winnerTurnSourceComp?.id && isOTurnField?.id) {
      await client.addComponent({
        containerSlotId: winnerTurnSourceSlotId,
        componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<bool>>',
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      const slotData = await client.getSlot({ slotId: winnerTurnSourceSlotId, includeComponentData: true });
      const globalRefComp = findComponent(slotData.data, 'GlobalReference');
      const fieldDetails = await client.getComponent(isOTurnField.id);
      const valueId = fieldDetails.data?.members?.Value?.id;
      if (globalRefComp?.id && valueId) {
        await client.updateComponent({ id: globalRefComp.id, members: { Reference: { $type: 'reference', targetId: valueId } } as any });
        await client.updateComponent({ id: winnerTurnSourceComp.id, members: { Source: { $type: 'reference', targetId: globalRefComp.id } } as any });
      }
    }

    // WinnerConditional: isOTurn(現在) ? "×の勝ち" : "○の勝ち"
    // 勝敗判定時点ではターンが切り替わっているので、isOTurn=trueなら×が勝ち
    if (winnerConditionalComp?.id && winnerTurnSourceComp?.id && xWinTextComp?.id && oWinTextComp?.id) {
      await client.updateComponent({
        id: winnerConditionalComp.id,
        members: {
          Condition: { $type: 'reference', targetId: winnerTurnSourceComp.id },
          OnTrue: { $type: 'reference', targetId: xWinTextComp.id },  // isOTurn=true → ×の勝ち
          OnFalse: { $type: 'reference', targetId: oWinTextComp.id }, // isOTurn=false → ○の勝ち
        } as any,
      });
    }

    // 実行フロー接続
    // Receiver.OnTriggered → IfWinner
    if (receiverWinComp?.id && ifWinnerComp?.id) {
      const details = await client.getComponent(receiverWinComp.id);
      const onTriggeredId = details.data?.members?.OnTriggered?.id;
      await client.updateComponent({
        id: receiverWinComp.id,
        members: { OnTriggered: { $type: 'reference', id: onTriggeredId, targetId: ifWinnerComp.id } } as any,
      });
    }

    // IfWinner.Condition ← OrAll（勝者がいるか）
    if (ifWinnerComp?.id && orAllComp?.id) {
      await client.updateComponent({
        id: ifWinnerComp.id,
        members: { Condition: { $type: 'reference', targetId: orAllComp.id } } as any,
      });
    }

    // IfWinner.OnTrue → GameOverWrite（勝者あり）
    if (ifWinnerComp?.id && gameOverWriteComp?.id) {
      const details = await client.getComponent(ifWinnerComp.id);
      const onTrueId = details.data?.members?.OnTrue?.id;
      await client.updateComponent({
        id: ifWinnerComp.id,
        members: { OnTrue: { $type: 'reference', id: onTrueId, targetId: gameOverWriteComp.id } } as any,
      });
    }

    // IfWinner.OnFalse → IfDraw（勝者なし → 引き分けチェック）
    if (ifWinnerComp?.id && ifDrawComp?.id) {
      const details = await client.getComponent(ifWinnerComp.id);
      const onFalseId = details.data?.members?.OnFalse?.id;
      await client.updateComponent({
        id: ifWinnerComp.id,
        members: { OnFalse: { $type: 'reference', id: onFalseId, targetId: ifDrawComp.id } } as any,
      });
    }

    // GameOverWrite設定
    if (gameOverWriteComp?.id && gameOverSourceComp2?.id && trueInputWinComp?.id) {
      await client.updateComponent({
        id: gameOverWriteComp.id,
        members: {
          Variable: { $type: 'reference', targetId: gameOverSourceComp2.id },
          Value: { $type: 'reference', targetId: trueInputWinComp.id },
        } as any,
      });
    }

    // GameOverWrite.OnWritten → ResultWrite
    if (gameOverWriteComp?.id && resultWriteComp?.id) {
      const details = await client.getComponent(gameOverWriteComp.id);
      const onWrittenId = details.data?.members?.OnWritten?.id;
      await client.updateComponent({
        id: gameOverWriteComp.id,
        members: { OnWritten: { $type: 'reference', id: onWrittenId, targetId: resultWriteComp.id } } as any,
      });
    }

    // ResultWrite設定（勝者テキスト）
    if (resultWriteComp?.id && resultSourceComp?.id && winnerConditionalComp?.id) {
      await client.updateComponent({
        id: resultWriteComp.id,
        members: {
          Variable: { $type: 'reference', targetId: resultSourceComp.id },
          Value: { $type: 'reference', targetId: winnerConditionalComp.id },
        } as any,
      });
    }

    // IfDraw.Condition ← Draw_Final（引き分けか）
    if (ifDrawComp?.id && drawFinalComp?.id) {
      await client.updateComponent({
        id: ifDrawComp.id,
        members: { Condition: { $type: 'reference', targetId: drawFinalComp.id } } as any,
      });
    }

    // IfDraw.OnTrue → 引き分け用GameOverWrite
    // 引き分け用のGameOverWriteとResultWriteを追加
    await client.addSlot({ parentId: winCheckId, name: 'DrawGameOverWrite' });
    await client.addSlot({ parentId: winCheckId, name: 'DrawResultWrite' });
    const drawGameOverWriteSlotId = await getChildSlotId(client, winCheckId, 'DrawGameOverWrite');
    const drawResultWriteSlotId = await getChildSlotId(client, winCheckId, 'DrawResultWrite');

    await client.addComponent({ containerSlotId: drawGameOverWriteSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,bool>' });
    await client.addComponent({ containerSlotId: drawResultWriteSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,string>' });

    await new Promise(resolve => setTimeout(resolve, 50));
    const drawGameOverWriteData = await client.getSlot({ slotId: drawGameOverWriteSlotId, includeComponentData: true });
    const drawGameOverWriteComp = findComponent(drawGameOverWriteData.data, 'ValueWrite');
    const drawResultWriteData = await client.getSlot({ slotId: drawResultWriteSlotId, includeComponentData: true });
    const drawResultWriteComp = findComponent(drawResultWriteData.data, 'ObjectWrite');

    // IfDraw.OnTrue → DrawGameOverWrite
    if (ifDrawComp?.id && drawGameOverWriteComp?.id) {
      const details = await client.getComponent(ifDrawComp.id);
      const onTrueId = details.data?.members?.OnTrue?.id;
      await client.updateComponent({
        id: ifDrawComp.id,
        members: { OnTrue: { $type: 'reference', id: onTrueId, targetId: drawGameOverWriteComp.id } } as any,
      });
    }

    // DrawGameOverWrite設定
    if (drawGameOverWriteComp?.id && gameOverSourceComp2?.id && trueInputWinComp?.id) {
      await client.updateComponent({
        id: drawGameOverWriteComp.id,
        members: {
          Variable: { $type: 'reference', targetId: gameOverSourceComp2.id },
          Value: { $type: 'reference', targetId: trueInputWinComp.id },
        } as any,
      });
    }

    // DrawGameOverWrite.OnWritten → DrawResultWrite
    if (drawGameOverWriteComp?.id && drawResultWriteComp?.id) {
      const details = await client.getComponent(drawGameOverWriteComp.id);
      const onWrittenId = details.data?.members?.OnWritten?.id;
      await client.updateComponent({
        id: drawGameOverWriteComp.id,
        members: { OnWritten: { $type: 'reference', id: onWrittenId, targetId: drawResultWriteComp.id } } as any,
      });
    }

    // DrawResultWrite設定（引き分けテキスト）
    if (drawResultWriteComp?.id && resultSourceComp?.id && drawTextComp?.id) {
      await client.updateComponent({
        id: drawResultWriteComp.id,
        members: {
          Variable: { $type: 'reference', targetId: resultSourceComp.id },
          Value: { $type: 'reference', targetId: drawTextComp.id },
        } as any,
      });
    }

    console.log('  Win check logic created');

    // リセット用ロジック
    await client.addSlot({ parentId: fluxId, name: 'Reset', position: { x: 5, y: 0, z: 0 } });
    const resetId = await getChildSlotId(client, fluxId, 'Reset');

    // リセット用ノード作成
    // EmptyStrは不要 - ObjectWrite.Valueを接続しないことでnullが書き込まれる
    const resetNodeNames = ['Receiver', 'TagInput', 'TrueInput', 'FalseInput'];
    // 9個のセルクリア用 + 1個のターンリセット用 + isGameOver/resultTextリセット用
    for (let i = 0; i < 9; i++) {
      resetNodeNames.push(`CellSource_${i}`, `CellWrite_${i}`);
    }
    resetNodeNames.push('TurnSource', 'TurnWrite');
    resetNodeNames.push('GameOverSource', 'GameOverWrite', 'ResultSource', 'ResultWrite');

    for (const name of resetNodeNames) {
      await client.addSlot({ parentId: resetId, name });
    }

    const resetSlotData = await client.getSlot({ slotId: resetId, depth: 1 });
    const getResetSlotId = (name: string) => resetSlotData.data?.children?.find((c: any) => c.name?.value === name)?.id;

    const resetReceiverSlotId = getResetSlotId('Receiver');
    const resetTagInputSlotId = getResetSlotId('TagInput');
    const resetTrueInputSlotId = getResetSlotId('TrueInput');
    const resetFalseInputSlotId = getResetSlotId('FalseInput');
    const resetGameOverSourceSlotId = getResetSlotId('GameOverSource');
    const resetGameOverWriteSlotId = getResetSlotId('GameOverWrite');
    const resetResultSourceSlotId = getResetSlotId('ResultSource');
    const resetResultWriteSlotId = getResetSlotId('ResultWrite');

    // 基本コンポーネント追加
    await client.addComponent({ containerSlotId: resetReceiverSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Actions.DynamicImpulseReceiver' });
    await client.addComponent({ containerSlotId: resetTagInputSlotId, componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalValue<string>' });
    await client.addComponent({ containerSlotId: resetTrueInputSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<bool>' });
    await client.addComponent({ containerSlotId: resetFalseInputSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<bool>' });
    // GameOver用のSource + Write
    await client.addComponent({ containerSlotId: resetGameOverSourceSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ValueSource<bool>' });
    await client.addComponent({ containerSlotId: resetGameOverSourceSlotId, componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<bool>>' });
    await client.addComponent({ containerSlotId: resetGameOverWriteSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,bool>' });
    // ResultText用のSource + Write
    await client.addComponent({ containerSlotId: resetResultSourceSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.FrooxEngine.ProtoFlux.CoreNodes.ObjectValueSource<string>' });
    await client.addComponent({ containerSlotId: resetResultSourceSlotId, componentType: '[FrooxEngine]FrooxEngine.ProtoFlux.GlobalReference<[FrooxEngine]FrooxEngine.IValue<string>>' });
    await client.addComponent({ containerSlotId: resetResultWriteSlotId, componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ObjectWrite<[FrooxEngine]FrooxEngine.ProtoFlux.FrooxEngineContext,string>' });

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

    // FalseInput/GameOver/Result のコンポーネント取得と設定
    await new Promise(resolve => setTimeout(resolve, 50));

    const resetFalseInputData = await client.getSlot({ slotId: resetFalseInputSlotId, includeComponentData: true });
    const resetFalseInputComp = findComponent(resetFalseInputData.data, 'ValueInput');
    const resetGameOverSourceData = await client.getSlot({ slotId: resetGameOverSourceSlotId, includeComponentData: true });
    const resetGameOverSourceComp = findComponent(resetGameOverSourceData.data, 'ValueSource');
    const resetGameOverGlobalRefComp = findComponent(resetGameOverSourceData.data, 'GlobalReference');
    const resetGameOverWriteData = await client.getSlot({ slotId: resetGameOverWriteSlotId, includeComponentData: true });
    const resetGameOverWriteComp = findComponent(resetGameOverWriteData.data, 'ValueWrite');
    const resetResultSourceData = await client.getSlot({ slotId: resetResultSourceSlotId, includeComponentData: true });
    const resetResultSourceComp = findComponent(resetResultSourceData.data, 'ObjectValueSource');
    const resetResultGlobalRefComp = findComponent(resetResultSourceData.data, 'GlobalReference');
    const resetResultWriteData = await client.getSlot({ slotId: resetResultWriteSlotId, includeComponentData: true });
    const resetResultWriteComp = findComponent(resetResultWriteData.data, 'ObjectWrite');

    // FalseInput の値設定
    if (resetFalseInputComp?.id) {
      await client.updateComponent({
        id: resetFalseInputComp.id,
        members: { Value: { $type: 'bool', value: false } } as any,
      });
    }

    // GameOverSource の GlobalReference 設定
    if (resetGameOverGlobalRefComp?.id && isGameOverField?.id) {
      const fieldDetails = await client.getComponent(isGameOverField.id);
      const valueId = fieldDetails.data?.members?.Value?.id;
      if (valueId) {
        await client.updateComponent({
          id: resetGameOverGlobalRefComp.id,
          members: { Reference: { $type: 'reference', targetId: valueId } } as any,
        });
        if (resetGameOverSourceComp?.id) {
          await client.updateComponent({
            id: resetGameOverSourceComp.id,
            members: { Source: { $type: 'reference', targetId: resetGameOverGlobalRefComp.id } } as any,
          });
        }
      }
    }

    // ResultSource の GlobalReference 設定
    if (resetResultGlobalRefComp?.id && resultTextField?.id) {
      const fieldDetails = await client.getComponent(resultTextField.id);
      const valueId = fieldDetails.data?.members?.Value?.id;
      if (valueId) {
        await client.updateComponent({
          id: resetResultGlobalRefComp.id,
          members: { Reference: { $type: 'reference', targetId: valueId } } as any,
        });
        if (resetResultSourceComp?.id) {
          await client.updateComponent({
            id: resetResultSourceComp.id,
            members: { Source: { $type: 'reference', targetId: resetResultGlobalRefComp.id } } as any,
          });
        }
      }
    }

    // TurnWrite.OnWritten → GameOverWrite
    if (resetTurnWriteComp?.id && resetGameOverWriteComp?.id) {
      const details = await client.getComponent(resetTurnWriteComp.id);
      const onWrittenId = details.data?.members?.OnWritten?.id;
      await client.updateComponent({
        id: resetTurnWriteComp.id,
        members: { OnWritten: { $type: 'reference', id: onWrittenId, targetId: resetGameOverWriteComp.id } } as any,
      });
    }

    // GameOverWrite: Variable ← GameOverSource, Value ← FalseInput
    if (resetGameOverWriteComp?.id && resetGameOverSourceComp?.id && resetFalseInputComp?.id) {
      await client.updateComponent({
        id: resetGameOverWriteComp.id,
        members: {
          Variable: { $type: 'reference', targetId: resetGameOverSourceComp.id },
          Value: { $type: 'reference', targetId: resetFalseInputComp.id },
        } as any,
      });
    }

    // GameOverWrite.OnWritten → ResultWrite
    if (resetGameOverWriteComp?.id && resetResultWriteComp?.id) {
      const details = await client.getComponent(resetGameOverWriteComp.id);
      const onWrittenId = details.data?.members?.OnWritten?.id;
      await client.updateComponent({
        id: resetGameOverWriteComp.id,
        members: { OnWritten: { $type: 'reference', id: onWrittenId, targetId: resetResultWriteComp.id } } as any,
      });
    }

    // ResultWrite: Variable ← ResultSource, Value は未接続（null）
    if (resetResultWriteComp?.id && resetResultSourceComp?.id) {
      await client.updateComponent({
        id: resetResultWriteComp.id,
        members: {
          Variable: { $type: 'reference', targetId: resetResultSourceComp.id },
          // Value は未接続（nullを書き込む）
        } as any,
      });
    }

    console.log('  Reset logic created and connected (includes GameOver/Result reset)');
    console.log('  ProtoFlux logic created and connected');

    // ========== 完了 ==========
    console.log('\n========================================');
    console.log('=== Tic-Tac-Toe Game Created! ===');
    console.log('========================================');
    console.log(`\nLocation: ${slotName}`);
    console.log('\n【機能】');
    console.log('- セルクリック: ○/×を交互に配置');
    console.log('- 空セルチェック: 既にマークがあるセルはクリック無効');
    console.log('- ゲームオーバーチェック: 勝敗確定後はクリック無効');
    console.log('- ターン表示: 現在の手番を表示');
    console.log('- 勝敗判定: 8ライン（横3、縦3、斜め2）をチェック');
    console.log('- 引き分け判定: 全セルが埋まり勝者なしの場合');
    console.log('- 結果表示: 勝者または引き分けを表示');
    console.log('- リセットボタン: 全セルクリア + ゲーム状態を初期化');

  } finally {
    client.disconnect();
  }
}

main();
