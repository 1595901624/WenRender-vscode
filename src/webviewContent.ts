// Webview 内容生成器
// 为预览面板生成外壳 HTML：包含工具条与承载文章的 iframe
// iframe 用于隔离文章主题的内联 CSS，避免污染 webview 容器
// 扩展与 iframe 之间通过 postMessage 进行实时更新与同步滚动

import * as vscode from 'vscode';

/** 从 webview 派发到扩展的消息类型 */
export type WebviewToHostMessage =
  | { type: 'scroll'; ratio: number }
  | { type: 'copy'; html: string }
  | { type: 'export' }
  | { type: 'ready' };

/** 从扩展派发到 webview 的消息类型 */
export type HostToWebviewMessage =
  | { type: 'update'; html: string; title: string }
  | { type: 'scroll'; ratio: number };

/**
 * 生成 webview 的初始 HTML 外壳
 * @param initialHtml 初始的文章 HTML（来自 wrapHtml 的完整文档）
 * @param cspSource webview 的 CSP 来源（用于允许加载本地图片资源）
 */
export function buildWebviewHtml(
  initialHtml: string,
  cspSource: string,
): { html: string; nonce: string } {
  // 使用随机 nonce 防止注入，CSP 仅允许带该 nonce 的 inline 脚本
  const nonce = getNonce();

  // 将初始 HTML 转为可嵌入字符串：先用 JSON.stringify 包裹，再转义 < 防止提前闭合 script
  const initialPayload = JSON.stringify(initialHtml).replace(/</g, '\\u003c');

  return {
    nonce,
    html: /* html */ `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-src 'self' blob: data:; img-src ${cspSource} data: https: http:;" />
  <style>
    html, body { height: 100%; margin: 0; padding: 0; background: var(--vscode-editor-background); }
    body { display: flex; flex-direction: column; }
    .toolbar {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
      background: var(--vscode-panel-background);
      flex: 0 0 auto;
    }
    .toolbar .title {
      flex: 1;
      font-size: 12px;
      color: var(--vscode-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .toolbar button {
      appearance: none;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      padding: 4px 10px;
      border-radius: 2px;
      font-size: 12px;
      cursor: pointer;
    }
    .toolbar button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .toolbar button:hover { filter: brightness(1.08); }
    .frame-wrap { flex: 1 1 auto; min-height: 0; }
    iframe#article {
      width: 100%; height: 100%; border: 0; display: block;
      background: #ffffff;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="title" id="title">文染预览</span>
    <button id="copy" type="button">复制到公众号</button>
    <button id="export" class="secondary" type="button">导出 HTML</button>
  </div>
  <div class="frame-wrap">
    <iframe id="article" title="微信文章预览"></iframe>
  </div>
  <script nonce="${nonce}">
    // 初始文章 HTML（完整文档字符串），首次加载直接写入 iframe srcdoc
    const initialHtml = ${initialPayload};
    const vscode = acquireVsCodeApi();
    const frame = document.getElementById('article');
    const titleEl = document.getElementById('title');
    let suppressScroll = false;

    // 设置 iframe 内容，并在 onload 后绑定滚动监听
    function setArticle(html, title) {
      frame.srcdoc = html;
      if (title) titleEl.textContent = title;
    }

    // 每次 srcdoc 重载后 iframe 的 window 会变化，因此必须在 onLoad 中重新绑定
    frame.addEventListener('load', () => {
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      if (!win || !doc) return;
      const root = doc.documentElement;
      if (!root) return;
      win.onscroll = () => {
        if (suppressScroll) return;
        const max = Math.max(1, root.scrollHeight - root.clientHeight);
        vscode.postMessage({ type: 'scroll', ratio: win.scrollY / max });
      };
    });

    // 初始渲染
    setArticle(initialHtml, '');

    // 接收扩展下发的更新与同步滚动指令
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message) return;
      if (message.type === 'update') {
        setArticle(message.html, message.title);
      } else if (message.type === 'scroll') {
        const win = frame.contentWindow;
        const doc = frame.contentDocument;
        if (!win || !doc) return;
        const root = doc.documentElement;
        if (!root) return;
        const max = Math.max(0, root.scrollHeight - root.clientHeight);
        suppressScroll = true;
        win.scrollTo({ top: max * message.ratio });
        requestAnimationFrame(() => { suppressScroll = false; });
      }
    });

    // 工具条按钮：复制到公众号 / 导出 HTML
    document.getElementById('copy').addEventListener('click', async () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      const article = doc.querySelector('article');
      const html = article ? article.innerHTML : '';
      vscode.postMessage({ type: 'copy', html });
    });
    document.getElementById('export').addEventListener('click', () => {
      vscode.postMessage({ type: 'export' });
    });

    // 通知扩展 webview 已就绪
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`,
  };
}

/** 生成随机 nonce 字符串，用于 CSP 与 script 标签配对 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/** VSCode WebviewPanel 的状态对象，用于保留上次的滚动位置 */
export interface PanelState {
  scrollRatio: number;
}
