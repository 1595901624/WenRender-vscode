// 预览管理器
// 负责创建、跟踪、更新 Markdown 预览 WebviewPanel
// 实现分栏打开、实时更新、编辑器与预览的双向同步滚动、复制到公众号、导出 HTML
// 每个文档对应一个独立的预览面板，切换主题时统一刷新所有面板

import * as path from 'path';
import * as vscode from 'vscode';
import { renderMarkdown, wrapHtml } from './markdownRenderer';
import { articleThemes, findTheme } from './themes';
import { codeThemes, findCodeTheme } from './codeThemes';
import { buildWebviewHtml, type WebviewToHostMessage } from './webviewContent';
import type { ArticleTheme, CodeTheme } from './types';

/** 单个文档对应的预览面板与会话状态 */
interface PreviewEntry {
  panel: vscode.WebviewPanel;
  /** 最后一次渲染得到的文章 HTML 片段（不含外壳），用于复制到公众号 */
  lastRenderedHtml: string;
  /** 最后一次渲染得到的完整 HTML 文档（含外壳），用于导出 */
  lastFullHtml: string;
  /** 当前文章主题（独立保留，便于切换主题时刷新） */
  theme: ArticleTheme;
  /** 当前代码主题 */
  codeTheme: CodeTheme;
  /** 防抖句柄 */
  debounceHandle: ReturnType<typeof setTimeout> | null;
  /** 是否正在等待 webview 就绪 */
  pendingUpdate: string | null;
}

export class PreviewManager implements vscode.Disposable {
  /** 文档 URI 字符串 -> 预览条目 */
  private readonly panels = new Map<string, PreviewEntry>();
  /** 各种事件监听器的卸载函数 */
  private readonly disposables: vscode.Disposable[] = [];
  /** 全局行高覆盖（来自配置） */
  private lineHeight: number;
  /** 是否启用同步滚动 */
  private syncScroll: boolean;
  /** 最后一次编辑器可见范围，用于 editor -> webview 滚动同步 */
  private lastVisibleRanges = new Map<string, vscode.Range>();
  /** 用于 webview -> editor 滚动同步时的循环抑制 */
  private suppressEditorScroll = new Set<string>();

  constructor(private readonly context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('wenrender');
    this.lineHeight = config.get<number>('lineHeight', 1.75);
    this.syncScroll = config.get<boolean>('syncScroll', true);

    // 监听文档内容变化，触发预览更新
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const uri = event.document.uri.toString();
        const entry = this.panels.get(uri);
        if (entry && event.document === this.getDocumentForUri(uri)) {
          this.scheduleUpdate(entry, event.document);
        }
      }),
    );

    // 监听编辑器可见范围变化，用于 editor -> webview 同步滚动
    this.disposables.push(
      vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
        if (!this.syncScroll) return;
        const editor = event.textEditor;
        const uri = editor.document.uri.toString();
        if (!this.panels.has(uri)) return;
        if (this.suppressEditorScroll.has(uri)) return;
        const range = event.visibleRanges[0];
        if (!range) return;
        this.lastVisibleRanges.set(uri, range);
        const ratio = this.computeScrollRatio(editor.document, range);
        const entry = this.panels.get(uri);
        entry?.panel.webview.postMessage({ type: 'scroll', ratio });
      }),
    );

    // 监听配置变化，运行时调整行高与同步滚动
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('wenrender')) {
          const config = vscode.workspace.getConfiguration('wenrender');
          const newLineHeight = config.get<number>('lineHeight', 1.75);
          const newSync = config.get<boolean>('syncScroll', true);
          const lineHeightChanged = newLineHeight !== this.lineHeight;
          const syncChanged = newSync !== this.syncScroll;
          this.lineHeight = newLineHeight;
          this.syncScroll = newSync;
          if (lineHeightChanged) {
            // 行高变化会影响渲染输出，需要刷新所有面板
            for (const entry of this.panels.values()) {
              const doc = this.getDocumentForUri(this.findUriByEntry(entry));
              if (doc) this.scheduleUpdate(entry, doc);
            }
          }
          if (syncChanged && !this.syncScroll) {
            this.suppressEditorScroll.clear();
          }
        }
      }),
    );
  }

  /**
   * 打开（或聚焦）指定文档的预览面板
   * @param document 要预览的 Markdown 文档
   * @param toSide 是否在右侧分栏打开；false 时使用当前列之外的下一列
   */
  public openPreview(document: vscode.TextDocument, toSide: boolean): void {
    const uri = document.uri.toString();
    const existing = this.panels.get(uri);
    if (existing) {
      existing.panel.reveal();
      return;
    }

    const config = vscode.workspace.getConfiguration('wenrender');
    const theme = findTheme(config.get<string>('defaultTheme'));
    const codeTheme = findCodeTheme(config.get<string>('defaultCodeTheme'));

    // 计算面板要显示在哪一列：分栏模式优先使用第二列，已分屏时使用下一列
    const viewColumn = toSide
      ? vscode.ViewColumn.Two
      : this.resolveActiveColumn();

    const panel = vscode.window.createWebviewPanel(
      'wenrender.preview',
      this.panelTitle(document),
      viewColumn,
      {
        enableScripts: true,
        // 允许 webview 直接访问本地图片资源
        localResourceRoots: this.resolveLocalResourceRoots(document),
        retainContextWhenHidden: true,
      },
    );

    const entry: PreviewEntry = {
      panel,
      lastRenderedHtml: '',
      lastFullHtml: '',
      theme,
      codeTheme,
      debounceHandle: null,
      pendingUpdate: null,
    };

    // 初始渲染：构造完整 HTML 文档作为 iframe srcdoc
    const { html: rendered, title } = this.renderFor(document, entry);
    const fullHtml = wrapHtml(rendered, title, entry.theme);
    entry.lastRenderedHtml = rendered;
    entry.lastFullHtml = fullHtml;
    panel.webview.html = buildWebviewHtml(
      fullHtml,
      panel.webview.cspSource,
      entry.theme.name,
      entry.codeTheme.name,
    ).html;

    // 接收 webview 主动发来的消息（滚动、复制、导出、就绪）
    panel.webview.onDidReceiveMessage(
      (message: WebviewToHostMessage) => this.handleMessage(uri, message),
      undefined,
      this.disposables,
    );

    // 面板关闭时清理状态
    panel.onDidDispose(() => {
      if (entry.debounceHandle) clearTimeout(entry.debounceHandle);
      this.panels.delete(uri);
      this.lastVisibleRanges.delete(uri);
      this.suppressEditorScroll.delete(uri);
    }, undefined, this.disposables);

    // 面板状态变化（显隐）：重新可见时立即重发一次内容
    panel.onDidChangeViewState(() => {
      if (panel.visible && entry.pendingUpdate) {
        panel.webview.postMessage({ type: 'update', html: entry.pendingUpdate, title });
        entry.pendingUpdate = null;
      }
    }, undefined, this.disposables);

    this.panels.set(uri, entry);
  }

  /** 切换文章主题：刷新指定文档的预览（如未打开则跳过） */
  public setTheme(document: vscode.TextDocument, theme: ArticleTheme): void {
    const uri = document.uri.toString();
    const entry = this.panels.get(uri);
    if (!entry) return;
    entry.theme = theme;
    this.scheduleUpdate(entry, document, 0);
    // 同步工具条按钮显示的当前主题名
    entry.panel.webview.postMessage({
      type: 'themeChanged',
      themeName: entry.theme.name,
      codeThemeName: entry.codeTheme.name,
    });
  }

  /** 切换代码主题：刷新指定文档的预览（如未打开则跳过） */
  public setCodeTheme(document: vscode.TextDocument, codeTheme: CodeTheme): void {
    const uri = document.uri.toString();
    const entry = this.panels.get(uri);
    if (!entry) return;
    entry.codeTheme = codeTheme;
    this.scheduleUpdate(entry, document, 0);
    entry.panel.webview.postMessage({
      type: 'themeChanged',
      themeName: entry.theme.name,
      codeThemeName: entry.codeTheme.name,
    });
  }

  /** 复制指定文档当前预览内容（article innerHTML）到剪贴板，适配公众号编辑器 */
  public async copyToWechat(document: vscode.TextDocument): Promise<void> {
    const uri = document.uri.toString();
    const entry = this.panels.get(uri);
    if (!entry || !entry.lastRenderedHtml) {
      vscode.window.showWarningMessage('当前文档没有打开的预览，无法复制。');
      return;
    }
    try {
      // 同时写入 HTML 与纯文本，让公众号编辑器优先读取带内联样式的版本
      await vscode.env.clipboard.writeText(entry.lastFullHtml);
      vscode.window.showInformationMessage('已复制 HTML 源码，可粘贴到公众号编辑器。');
    } catch (error) {
      vscode.window.showErrorMessage(`复制失败：${String(error)}`);
    }
  }

  /** 导出指定文档当前预览为完整 HTML 文件 */
  public async exportHtml(document: vscode.TextDocument): Promise<void> {
    const uri = document.uri.toString();
    const entry = this.panels.get(uri);
    if (!entry || !entry.lastFullHtml) {
      vscode.window.showWarningMessage('当前文档没有打开的预览，无法导出。');
      return;
    }
    const defaultName = path.basename(document.fileName).replace(/\.(md|markdown|mdown|txt)$/i, '') + '.html';
    const defaultUri = vscode.Uri.file(path.join(path.dirname(document.fileName), defaultName));
    const target = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'HTML': ['html'] },
      saveLabel: '导出 HTML',
    });
    if (!target) return;
    try {
      await vscode.workspace.fs.writeFile(target, Buffer.from(entry.lastFullHtml, 'utf8'));
      vscode.window.showInformationMessage(`已导出到：${target.fsPath}`);
    } catch (error) {
      vscode.window.showErrorMessage(`导出失败：${String(error)}`);
    }
  }

  /** 释放所有监听器与面板 */
  public dispose(): void {
    for (const entry of this.panels.values()) {
      if (entry.debounceHandle) clearTimeout(entry.debounceHandle);
      entry.panel.dispose();
    }
    this.panels.clear();
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables.length = 0;
  }

  /* ============================== 内部实现 ============================== */

  /**
   * 处理 webview 主动发来的消息
   */
  private handleMessage(uri: string, message: WebviewToHostMessage): void {
    const entry = this.panels.get(uri);
    if (!entry) return;
    switch (message.type) {
      case 'ready':
        // webview 就绪后若已有待更新内容则立即下发
        if (entry.pendingUpdate) {
          entry.panel.webview.postMessage({
            type: 'update',
            html: entry.pendingUpdate,
            title: '',
          });
          entry.pendingUpdate = null;
        }
        break;
      case 'scroll':
        if (!this.syncScroll) return;
        this.applyWebviewScrollToEditor(uri, message.ratio);
        break;
      case 'copy': {
        // 直接使用 webview 上报的 article innerHTML，避免重复渲染
        entry.lastRenderedHtml = message.html;
        // 同时同步一份带外壳的完整 HTML 到剪贴板，便于粘贴到任意编辑器
        const title = this.documentTitle(this.getDocumentForUri(uri)!);
        entry.lastFullHtml = wrapHtml(message.html, title, entry.theme);
        void this.copyToWechat(this.getDocumentForUri(uri)!);
        break;
      }
      case 'export':
        void this.exportHtml(this.getDocumentForUri(uri)!);
        break;
      case 'selectTheme':
        // 工具条“文章主题”按钮：弹出 QuickPick 并应用到当前预览
        void this.pickTheme(uri);
        break;
      case 'selectCodeTheme':
        // 工具条“代码主题”按钮：弹出 QuickPick 并应用到当前预览
        void this.pickCodeTheme(uri);
        break;
    }
  }

  /**
   * 弹出文章主题选择器，选中后应用到指定预览并更新默认配置
   */
  private async pickTheme(uri: string): Promise<void> {
    const entry = this.panels.get(uri);
    if (!entry) return;
    const items = articleThemes.map((theme) => ({
      label: theme.name,
      description: theme.description,
      detail: theme.swatches.join('  '),
      picked: theme.id === entry.theme.id,
      theme,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      title: '选择文章主题',
      placeHolder: '当前主题将立即应用到预览与导出',
    });
    if (!picked) return;
    const document = this.getDocumentForUri(uri);
    if (!document) return;
    this.setTheme(document, picked.theme);
    // 同时更新默认主题，使后续打开的文档也使用该主题
    await vscode.workspace.getConfiguration('wenrender').update(
      'defaultTheme',
      picked.theme.id,
      vscode.ConfigurationTarget.Global,
    );
  }

  /**
   * 弹出代码主题选择器，选中后应用到指定预览并更新默认配置
   */
  private async pickCodeTheme(uri: string): Promise<void> {
    const entry = this.panels.get(uri);
    if (!entry) return;
    const items = codeThemes.map((theme) => ({
      label: theme.name,
      description: theme.description,
      detail: theme.swatches.join('  '),
      picked: theme.id === entry.codeTheme.id,
      theme,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      title: '选择代码主题',
      placeHolder: '使用 Highlight.js 官方配色',
    });
    if (!picked) return;
    const document = this.getDocumentForUri(uri);
    if (!document) return;
    this.setCodeTheme(document, picked.theme);
    await vscode.workspace.getConfiguration('wenrender').update(
      'defaultCodeTheme',
      picked.theme.id,
      vscode.ConfigurationTarget.Global,
    );
  }

  /**
   * 调度一次预览更新，默认 200ms 防抖以避免高频输入时频繁渲染
   */
  private scheduleUpdate(entry: PreviewEntry, document: vscode.TextDocument, delay = 200): void {
    if (entry.debounceHandle) clearTimeout(entry.debounceHandle);
    entry.debounceHandle = setTimeout(() => {
      entry.debounceHandle = null;
      this.updateNow(entry, document);
    }, delay);
  }

  /** 立即重新渲染并发送更新消息到 webview */
  private updateNow(entry: PreviewEntry, document: vscode.TextDocument): void {
    const { html: rendered, title } = this.renderFor(document, entry);
    const fullHtml = wrapHtml(rendered, title, entry.theme);
    entry.lastRenderedHtml = rendered;
    entry.lastFullHtml = fullHtml;
    if (entry.panel.visible) {
      entry.panel.webview.postMessage({ type: 'update', html: fullHtml, title });
    } else {
      // 面板不可见时暂存，待重新可见或就绪时下发
      entry.pendingUpdate = fullHtml;
    }
    entry.panel.title = this.panelTitle(document);
  }

  /**
   * 渲染当前文档为 HTML 片段
   * 同时处理本地图片相对路径到 webview 可访问 URI 的转换
   */
  private renderFor(
    document: vscode.TextDocument,
    entry: PreviewEntry,
  ): { html: string; title: string } {
    // 应用配置中的行高覆盖
    const theme: ArticleTheme = {
      ...entry.theme,
      typography: { ...entry.theme.typography, bodyLineHeight: this.lineHeight },
    };
    const baseDir = path.dirname(document.fileName);
    const webview = entry.panel.webview;
    const resolveImage = (source: string): string => {
      // 远程、data URI 等直接放行
      if (/^(https?:|data:|blob:|vscode-|vscode-resource:)/i.test(source)) return source;
      // 相对路径以文档所在目录为基准
      const resolved = path.isAbsolute(source) ? source : path.join(baseDir, source);
      try {
        return webview.asWebviewUri(vscode.Uri.file(resolved)).toString();
      } catch {
        return source;
      }
    };
    const html = renderMarkdown(document.getText(), {
      theme,
      codeTheme: entry.codeTheme,
      resolveImage,
    });
    return { html, title: this.documentTitle(document) };
  }

  /** 根据 webview 上报的滚动比例，反向设置编辑器可见范围 */
  private applyWebviewScrollToEditor(uri: string, ratio: number): void {
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === uri,
    );
    if (!editor) return;
    const doc = editor.document;
    const lastLine = doc.lineCount - 1;
    // 用比例乘以文档总行数得到目标起始行，并保证不越界
    const targetLine = Math.max(0, Math.min(lastLine, Math.round(ratio * lastLine)));
    const range = new vscode.Range(targetLine, 0, Math.min(lastLine, targetLine + 10), 0);
    this.suppressEditorScroll.add(uri);
    editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
    // 在下一帧解除抑制，避免 onDidChangeVisibleRanges 再次反向同步
    setTimeout(() => this.suppressEditorScroll.delete(uri), 60);
  }

  /**
   * 根据编辑器当前可见范围，计算 webview 应滚动到的比例
   */
  private computeScrollRatio(document: vscode.TextDocument, range: vscode.Range): number {
    const total = document.lineCount;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, range.start.line / total));
  }

  /** 计算面板标题：使用文档 basename */
  private panelTitle(document: vscode.TextDocument): string {
    return `预览：${this.documentTitle(document)}`;
  }

  /** 文档标题：去掉扩展名 */
  private documentTitle(document: vscode.TextDocument): string {
    return path.basename(document.fileName).replace(/\.(md|markdown|mdown|txt)$/i, '');
  }

  /** 通过 URI 字符串取回对应的 TextDocument */
  private getDocumentForUri(uri: string): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri);
  }

  /** 反查 entry 对应的 URI（仅用于配置变化时刷新） */
  private findUriByEntry(target: PreviewEntry): string {
    for (const [uri, entry] of this.panels) {
      if (entry === target) return uri;
    }
    return '';
  }

  /** 选择面板默认显示列：若当前在第一列则用第二列，否则用第一列 */
  private resolveActiveColumn(): vscode.ViewColumn {
    const active = vscode.window.activeTextEditor;
    if (!active || active.viewColumn === vscode.ViewColumn.One) {
      return vscode.ViewColumn.Two;
    }
    return vscode.ViewColumn.One;
  }

  /**
   * 计算 webview 允许访问的本地资源根目录
   * 默认允许文档所在目录与工作区根目录，便于加载相对图片
   */
  private resolveLocalResourceRoots(document: vscode.TextDocument): vscode.Uri[] {
    const roots: vscode.Uri[] = [];
    const docDir = vscode.Uri.file(path.dirname(document.fileName));
    roots.push(docDir);
    const workspace = vscode.workspace.getWorkspaceFolder(document.uri);
    if (workspace) roots.push(workspace.uri);
    return roots;
  }
}
