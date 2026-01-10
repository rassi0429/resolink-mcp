/**
 * UIX マルバツゲーム作成スクリプト
 *
 * 使い方: npx tsx src/scripts/create-tic-tac-toe.ts [ws://localhost:3343]
 */
import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:3343';

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Creating Tic-Tac-Toe Game...\n');

    // 1. メインスロット作成
    const slotName = `TicTacToe_${Date.now()}`;
    await client.addSlot({
      name: slotName,
      position: { x: 0, y: 1.5, z: 1.5 },
      isActive: true,
    });

    const mainSlot = await client.findSlotByName(slotName, 'Root', 1);
    if (!mainSlot?.id) throw new Error('Main slot not found');
    const mainId = mainSlot.id;
    console.log(`  Main slot: ${mainId}`);

    // スケールを0.001に設定
    await client.updateSlot({
      id: mainId,
      scale: { x: 0.001, y: 0.001, z: 0.001 },
    });

    // 2. Canvas + Grabbable追加
    await client.addComponent({
      containerSlotId: mainId,
      componentType: '[FrooxEngine]FrooxEngine.UIX.Canvas',
    });
    await client.addComponent({
      containerSlotId: mainId,
      componentType: '[FrooxEngine]FrooxEngine.Grabbable',
    });

    // UI_UnlitMaterial追加（Image描画用）
    await client.addComponent({
      containerSlotId: mainId,
      componentType: '[FrooxEngine]FrooxEngine.UI_UnlitMaterial',
    });

    let slotData = await client.getSlot({ slotId: mainId, includeComponentData: true });
    const canvas = slotData.data?.components?.find((c: any) => c.componentType?.includes('Canvas'));
    const uiMaterial = slotData.data?.components?.find((c: any) => c.componentType?.includes('UI_UnlitMaterial'));

    if (canvas?.id) {
      await client.updateComponent({
        id: canvas.id,
        members: {
          Size: { $type: 'float2', value: { x: 400, y: 480 } },
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
    console.log('  Canvas configured');

    // 3. 背景スロット作成
    await client.addSlot({ parentId: mainId, name: 'Background' });
    slotData = await client.getSlot({ slotId: mainId, depth: 1 });
    const bgSlot = slotData.data?.children?.find((c: any) => c.name?.value === 'Background');
    if (!bgSlot?.id) throw new Error('Background slot not found');

    await client.addComponent({ containerSlotId: bgSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: bgSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Image' });

    let bgData = await client.getSlot({ slotId: bgSlot.id, includeComponentData: true });
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
          Tint: { $type: 'colorX', value: { r: 0.1, g: 0.12, b: 0.18, a: 0.98 } },
          Material: { $type: 'reference', targetId: uiMaterial?.id },
        } as any,
      });
    }
    console.log('  Background created');

    // 4. コンテンツスロット（VerticalLayout）
    await client.addSlot({ parentId: mainId, name: 'Content' });
    slotData = await client.getSlot({ slotId: mainId, depth: 1 });
    const contentSlot = slotData.data?.children?.find((c: any) => c.name?.value === 'Content');
    if (!contentSlot?.id) throw new Error('Content slot not found');
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
          Spacing: { $type: 'float', value: 10 },
          ForceExpandWidth: { $type: 'bool', value: true },
          ForceExpandHeight: { $type: 'bool', value: false },
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'LayoutHorizontalAlignment' },
        } as any,
      });
    }
    console.log('  Content layout created');

    // 5. ヘッダー
    await client.addSlot({ parentId: contentId, name: 'Header' });
    contentData = await client.getSlot({ slotId: contentId, depth: 1 });
    const headerSlot = contentData.data?.children?.find((c: any) => c.name?.value === 'Header');
    if (!headerSlot?.id) throw new Error('Header slot not found');

    await client.addComponent({ containerSlotId: headerSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: headerSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: headerSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

    let headerData = await client.getSlot({ slotId: headerSlot.id, includeComponentData: true });
    const headerLayout = headerData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
    const headerText = headerData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

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

    // 6. ターン表示
    await client.addSlot({ parentId: contentId, name: 'TurnDisplay' });
    contentData = await client.getSlot({ slotId: contentId, depth: 1 });
    const turnSlot = contentData.data?.children?.find((c: any) => c.name?.value === 'TurnDisplay');
    if (!turnSlot?.id) throw new Error('TurnDisplay slot not found');

    await client.addComponent({ containerSlotId: turnSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: turnSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: turnSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

    let turnData = await client.getSlot({ slotId: turnSlot.id, includeComponentData: true });
    const turnLayout = turnData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
    const turnText = turnData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

    if (turnLayout?.id) {
      await client.updateComponent({
        id: turnLayout.id,
        members: { PreferredHeight: { $type: 'float', value: 30 } } as any,
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
    console.log('  Turn display created');

    // 7. ゲームボード（3x3グリッド）
    await client.addSlot({ parentId: contentId, name: 'Board' });
    contentData = await client.getSlot({ slotId: contentId, depth: 1 });
    const boardSlot = contentData.data?.children?.find((c: any) => c.name?.value === 'Board');
    if (!boardSlot?.id) throw new Error('Board slot not found');
    const boardId = boardSlot.id;

    await client.addComponent({ containerSlotId: boardId, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: boardId, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: boardId, componentType: '[FrooxEngine]FrooxEngine.UIX.VerticalLayout' });

    let boardData = await client.getSlot({ slotId: boardId, includeComponentData: true });
    const boardLayout = boardData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
    const boardVLayout = boardData.data?.components?.find((c: any) => c.componentType?.includes('VerticalLayout'));

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
          HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'LayoutHorizontalAlignment' },
        } as any,
      });
    }

    // 3行作成
    const cellIds: string[][] = [];
    for (let row = 0; row < 3; row++) {
      const rowName = `Row${row}`;
      await client.addSlot({ parentId: boardId, name: rowName });
      boardData = await client.getSlot({ slotId: boardId, depth: 1 });
      const rowSlot = boardData.data?.children?.find((c: any) => c.name?.value === rowName);
      if (!rowSlot?.id) continue;

      await client.addComponent({ containerSlotId: rowSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
      await client.addComponent({ containerSlotId: rowSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
      await client.addComponent({ containerSlotId: rowSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.HorizontalLayout' });

      let rowData = await client.getSlot({ slotId: rowSlot.id, includeComponentData: true });
      const rowLayout = rowData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
      const rowHLayout = rowData.data?.components?.find((c: any) => c.componentType?.includes('HorizontalLayout'));

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

      // 3列（セル）作成
      const rowCellIds: string[] = [];
      for (let col = 0; col < 3; col++) {
        const cellName = `Cell_${row}_${col}`;
        await client.addSlot({ parentId: rowSlot.id, name: cellName });
        rowData = await client.getSlot({ slotId: rowSlot.id, depth: 1 });
        const cellSlot = rowData.data?.children?.find((c: any) => c.name?.value === cellName);
        if (!cellSlot?.id) continue;

        await client.addComponent({ containerSlotId: cellSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
        await client.addComponent({ containerSlotId: cellSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
        await client.addComponent({ containerSlotId: cellSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Image' });
        await client.addComponent({ containerSlotId: cellSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Button' });

        let cellData = await client.getSlot({ slotId: cellSlot.id, includeComponentData: true });
        const cellLayout = cellData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
        const cellImage = cellData.data?.components?.find((c: any) => c.componentType?.includes('Image'));

        if (cellLayout?.id) {
          await client.updateComponent({
            id: cellLayout.id,
            members: {
              FlexibleWidth: { $type: 'float', value: 1 },
              FlexibleHeight: { $type: 'float', value: 1 },
            } as any,
          });
        }
        if (cellImage?.id) {
          await client.updateComponent({
            id: cellImage.id,
            members: {
              Tint: { $type: 'colorX', value: { r: 0.2, g: 0.22, b: 0.28, a: 1 } },
            } as any,
          });
        }

        // セル内のテキスト用スロット
        await client.addSlot({ parentId: cellSlot.id, name: 'Text' });
        cellData = await client.getSlot({ slotId: cellSlot.id, depth: 1 });
        const textSlot = cellData.data?.children?.find((c: any) => c.name?.value === 'Text');
        if (!textSlot?.id) continue;

        await client.addComponent({ containerSlotId: textSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
        await client.addComponent({ containerSlotId: textSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

        let textData = await client.getSlot({ slotId: textSlot.id, includeComponentData: true });
        const textRect = textData.data?.components?.find((c: any) => c.componentType?.includes('RectTransform'));
        const cellText = textData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

        if (textRect?.id) {
          await client.updateComponent({
            id: textRect.id,
            members: {
              AnchorMin: { $type: 'float2', value: { x: 0, y: 0 } },
              AnchorMax: { $type: 'float2', value: { x: 1, y: 1 } },
              OffsetMin: { $type: 'float2', value: { x: 0, y: 0 } },
              OffsetMax: { $type: 'float2', value: { x: 0, y: 0 } },
            } as any,
          });
        }
        if (cellText?.id) {
          await client.updateComponent({
            id: cellText.id,
            members: {
              Content: { $type: 'string', value: '' },
              Size: { $type: 'float', value: 48 },
              Color: { $type: 'colorX', value: { r: 1, g: 1, b: 1, a: 1 } },
              HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
              VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
            } as any,
          });
          rowCellIds.push(cellText.id);
        }
      }
      cellIds.push(rowCellIds);
    }
    console.log('  Game board created (3x3)');

    // 8. リセットボタン
    await client.addSlot({ parentId: contentId, name: 'ResetButton' });
    contentData = await client.getSlot({ slotId: contentId, depth: 1 });
    const resetSlot = contentData.data?.children?.find((c: any) => c.name?.value === 'ResetButton');
    if (!resetSlot?.id) throw new Error('ResetButton slot not found');

    await client.addComponent({ containerSlotId: resetSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
    await client.addComponent({ containerSlotId: resetSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.LayoutElement' });
    await client.addComponent({ containerSlotId: resetSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Image' });
    await client.addComponent({ containerSlotId: resetSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Button' });

    let resetData = await client.getSlot({ slotId: resetSlot.id, includeComponentData: true });
    const resetLayout = resetData.data?.components?.find((c: any) => c.componentType?.includes('LayoutElement'));
    const resetImage = resetData.data?.components?.find((c: any) => c.componentType?.includes('Image'));

    if (resetLayout?.id) {
      await client.updateComponent({
        id: resetLayout.id,
        members: { PreferredHeight: { $type: 'float', value: 45 } } as any,
      });
    }
    if (resetImage?.id) {
      await client.updateComponent({
        id: resetImage.id,
        members: {
          Tint: { $type: 'colorX', value: { r: 0.6, g: 0.25, b: 0.25, a: 1 } },
        } as any,
      });
    }

    // リセットボタンテキスト
    await client.addSlot({ parentId: resetSlot.id, name: 'Text' });
    resetData = await client.getSlot({ slotId: resetSlot.id, depth: 1 });
    const resetTextSlot = resetData.data?.children?.find((c: any) => c.name?.value === 'Text');
    if (resetTextSlot?.id) {
      await client.addComponent({ containerSlotId: resetTextSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.RectTransform' });
      await client.addComponent({ containerSlotId: resetTextSlot.id, componentType: '[FrooxEngine]FrooxEngine.UIX.Text' });

      const resetTextData = await client.getSlot({ slotId: resetTextSlot.id, includeComponentData: true });
      const resetTextRect = resetTextData.data?.components?.find((c: any) => c.componentType?.includes('RectTransform'));
      const resetText = resetTextData.data?.components?.find((c: any) => c.componentType?.includes('Text'));

      if (resetTextRect?.id) {
        await client.updateComponent({
          id: resetTextRect.id,
          members: {
            AnchorMin: { $type: 'float2', value: { x: 0, y: 0 } },
            AnchorMax: { $type: 'float2', value: { x: 1, y: 1 } },
            OffsetMin: { $type: 'float2', value: { x: 0, y: 0 } },
            OffsetMax: { $type: 'float2', value: { x: 0, y: 0 } },
          } as any,
        });
      }
      if (resetText?.id) {
        await client.updateComponent({
          id: resetText.id,
          members: {
            Content: { $type: 'string', value: 'リセット' },
            Size: { $type: 'float', value: 22 },
            Color: { $type: 'colorX', value: { r: 1, g: 1, b: 1, a: 1 } },
            HorizontalAlign: { $type: 'enum', value: 'Center', enumType: 'TextHorizontalAlignment' },
            VerticalAlign: { $type: 'enum', value: 'Middle', enumType: 'TextVerticalAlignment' },
          } as any,
        });
      }
    }
    console.log('  Reset button created');

    console.log('\n=== Tic-Tac-Toe Game Created! ===');
    console.log(`  Location: ${slotName}`);
    console.log('\n  Note: ゲームロジック（ターン管理・勝敗判定）は');
    console.log('        ProtoFluxで追加実装が必要です。');
    console.log('        現在はUIのみ作成されています。');

  } finally {
    client.disconnect();
  }
}

main();
