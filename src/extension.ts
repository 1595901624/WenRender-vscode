// 扩展入口
// 负责激活扩展、注册命令、并将命令分发到 PreviewManager
// 命令前缀统一为 wenrender.*，与 package.json 中 contributes.commands 对应

import * as vscode from 'vscode';
import { PreviewManager } from './previewManager';
import { articleThemes } from './themes';
import { codeThemes } from './codeThemes';

let previewManager: PreviewManager | undefined;

/** 扩展激活入口 */
export function activate(context: vscode.ExtensionContext): void {
  previewManager = new PreviewManager(context);

  // 文染：打开预览（在下一列打开）
  context.subscriptions.push(
    vscode.commands.registerCommand('wenrender.openPreview', async (uri?: vscode.Uri) => {
      const document = await resolveMarkdownDocument(uri);
      if (!document) return;
      previewManager!.openPreview(document, false);
    }),
  );

  // 文染：分栏打开预览（强制在第二列打开，与编辑器形成左右分栏）
  context.subscriptions.push(
    vscode.commands.registerCommand('wenrender.openPreviewToSide', async (uri?: vscode.Uri) => {
      const document = await resolveMarkdownDocument(uri);
      if (!document) return;
      previewManager!.openPreview(document, true);
    }),
  );

  // 文染：选择文章主题（QuickPick 中展示色板，应用到当前文档的预览）
  context.subscriptions.push(
    vscode.commands.registerCommand('wenrender.selectTheme', async () => {
      const document = resolveActiveMarkdownDocument();
      if (!document) return;
      const items = articleThemes.map((theme) => ({
        label: theme.name,
        description: theme.description,
        detail: theme.swatches.join('  '),
        picked: false,
        theme,
      }));
      const picked = await vscode.window.showQuickPick(items, {
        title: '选择文章主题',
        placeHolder: '当前主题将立即应用到预览与导出',
      });
      if (!picked) return;
      previewManager!.setTheme(document, picked.theme);
      // 同时更新默认主题，使后续打开的文档也使用该主题
      await vscode.workspace.getConfiguration('wenrender').update(
        'defaultTheme',
        picked.theme.id,
        vscode.ConfigurationTarget.Global,
      );
    }),
  );

  // 文染：选择代码主题
  context.subscriptions.push(
    vscode.commands.registerCommand('wenrender.selectCodeTheme', async () => {
      const document = resolveActiveMarkdownDocument();
      if (!document) return;
      const items = codeThemes.map((theme) => ({
        label: theme.name,
        description: theme.description,
        detail: theme.swatches.join('  '),
        picked: false,
        theme,
      }));
      const picked = await vscode.window.showQuickPick(items, {
        title: '选择代码主题',
        placeHolder: '使用 Highlight.js 官方配色',
      });
      if (!picked) return;
      previewManager!.setCodeTheme(document, picked.theme);
      await vscode.workspace.getConfiguration('wenrender').update(
        'defaultCodeTheme',
        picked.theme.id,
        vscode.ConfigurationTarget.Global,
      );
    }),
  );

  // 文染：复制到公众号（写入剪贴板，带内联样式）
  context.subscriptions.push(
    vscode.commands.registerCommand('wenrender.copyToWechat', async () => {
      const document = resolveActiveMarkdownDocument();
      if (!document) return;
      await previewManager!.copyToWechat(document);
    }),
  );

  // 文染：导出 HTML
  context.subscriptions.push(
    vscode.commands.registerCommand('wenrender.exportHtml', async () => {
      const document = resolveActiveMarkdownDocument();
      if (!document) return;
      await previewManager!.exportHtml(document);
    }),
  );

  // 提示加载完成（仅首次激活时输出）
  console.log('[wenrender] 文染预览扩展已激活');
}

/** 扩展停用入口 */
export function deactivate(): void {
  previewManager?.dispose();
  previewManager = undefined;
}

/**
 * 根据传入的 URI 或当前活动编辑器，取得 Markdown 文档
 * - 若 URI 指向文件且尚未打开，则通过 workspace.openTextDocument 打开
 * - 否则取当前活动编辑器，并校验是否为 Markdown
 */
async function resolveMarkdownDocument(uri?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  if (uri) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      if (!isMarkdown(doc)) {
        vscode.window.showWarningMessage('该文件不是 Markdown 文档。');
        return undefined;
      }
      return doc;
    } catch {
      return undefined;
    }
  }
  return resolveActiveMarkdownDocument();
}

/** 取得当前活动编辑器中的 Markdown 文档；不满足时给出提示并返回 undefined */
function resolveActiveMarkdownDocument(): vscode.TextDocument | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('请先打开一个 Markdown 文件。');
    return undefined;
  }
  if (!isMarkdown(editor.document)) {
    vscode.window.showWarningMessage('当前文件不是 Markdown 文档。');
    return undefined;
  }
  return editor.document;
}

/** 判断文档语言是否属于 Markdown 系列 */
function isMarkdown(document: vscode.TextDocument): boolean {
  return ['markdown', 'markdown-latex'].includes(document.languageId);
}
