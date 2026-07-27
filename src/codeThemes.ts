// 代码高亮主题数据
// 对应 Highlight.js 官方 token 类名 -> 颜色的映射
// 渲染时会将 hljs-* class 转换为内联 style，复制到公众号无需加载外部样式

import type { CodeTheme } from './types';

/** GitHub 亮色 */
const githubLight: CodeTheme = {
  id: 'github-light',
  name: 'GitHub 亮色',
  description: '清晰明亮的官方配色',
  background: '#f6f8fa',
  foreground: '#24292e',
  border: '#e1e4e8',
  swatches: ['#d73a49', '#032f62', '#6f42c1', '#22863a'],
  tokens: {
    'hljs-keyword': '#d73a49',
    'hljs-built_in': '#005cc5',
    'hljs-type': '#005cc5',
    'hljs-literal': '#005cc5',
    'hljs-number': '#005cc5',
    'hljs-string': '#032f62',
    'hljs-comment': '#6a737d',
    'hljs-function': '#6f42c1',
    'hljs-title': '#6f42c1',
    'hljs-class': '#6f42c1',
    'hljs-params': '#24292e',
    'hljs-attr': '#005cc5',
    'hljs-attribute': '#005cc5',
    'hljs-variable': '#e36209',
    'hljs-regexp': '#032f62',
    'hljs-meta': '#6a737d',
    'hljs-tag': '#22863a',
    'hljs-name': '#22863a',
    'hljs-symbol': '#005cc5',
    'hljs-bullet': '#005cc5',
    'hljs-addition': '#22863a',
    'hljs-deletion': '#d73a49',
    'hljs-emphasis': '#24292e',
    'hljs-strong': '#24292e',
    'hljs-link': '#032f62',
  },
};

/** GitHub 暗色 */
const githubDark: CodeTheme = {
  id: 'github-dark',
  name: 'GitHub 暗色',
  description: '深色背景下的官方配色',
  background: '#0d1117',
  foreground: '#c9d1d9',
  border: '#30363d',
  swatches: ['#ff7b72', '#a5d6ff', '#d2a8ff', '#7ee787'],
  tokens: {
    'hljs-keyword': '#ff7b72',
    'hljs-built_in': '#ffa657',
    'hljs-type': '#ffa657',
    'hljs-literal': '#79c0ff',
    'hljs-number': '#79c0ff',
    'hljs-string': '#a5d6ff',
    'hljs-comment': '#8b949e',
    'hljs-function': '#d2a8ff',
    'hljs-title': '#d2a8ff',
    'hljs-class': '#d2a8ff',
    'hljs-params': '#c9d1d9',
    'hljs-attr': '#79c0ff',
    'hljs-attribute': '#79c0ff',
    'hljs-variable': '#ffa657',
    'hljs-regexp': '#a5d6ff',
    'hljs-meta': '#8b949e',
    'hljs-tag': '#7ee787',
    'hljs-name': '#7ee787',
    'hljs-symbol': '#79c0ff',
    'hljs-bullet': '#79c0ff',
    'hljs-addition': '#7ee787',
    'hljs-deletion': '#ff7b72',
    'hljs-emphasis': '#c9d1d9',
    'hljs-strong': '#c9d1d9',
    'hljs-link': '#a5d6ff',
  },
};

/** Monokai 经典 */
const monokai: CodeTheme = {
  id: 'monokai',
  name: 'Monokai',
  description: '经典暗色编辑器配色',
  background: '#272822',
  foreground: '#f8f8f2',
  border: '#3e3d32',
  swatches: ['#f92672', '#a6e22e', '#66d9ef', '#fd971f'],
  tokens: {
    'hljs-keyword': '#f92672',
    'hljs-built_in': '#66d9ef',
    'hljs-type': '#66d9ef',
    'hljs-literal': '#ae81ff',
    'hljs-number': '#ae81ff',
    'hljs-string': '#e6db74',
    'hljs-comment': '#75715e',
    'hljs-function': '#a6e22e',
    'hljs-title': '#a6e22e',
    'hljs-class': '#a6e22e',
    'hljs-params': '#f8f8f2',
    'hljs-attr': '#a6e22e',
    'hljs-attribute': '#a6e22e',
    'hljs-variable': '#f8f8f2',
    'hljs-regexp': '#e6db74',
    'hljs-meta': '#75715e',
    'hljs-tag': '#f92672',
    'hljs-name': '#f92672',
    'hljs-symbol': '#66d9ef',
    'hljs-bullet': '#ae81ff',
    'hljs-addition': '#a6e22e',
    'hljs-deletion': '#f92672',
    'hljs-emphasis': '#f8f8f2',
    'hljs-strong': '#f8f8f2',
    'hljs-link': '#e6db74',
  },
};

/** 全部内置代码主题列表 */
export const codeThemes: CodeTheme[] = [githubLight, githubDark, monokai];

/** 默认代码主题 */
export const defaultCodeTheme: CodeTheme = githubLight;

/** 按 ID 查找代码主题，未命中则返回默认 */
export function findCodeTheme(id: string | undefined): CodeTheme {
  if (!id) return defaultCodeTheme;
  return codeThemes.find((item) => item.id === id) ?? defaultCodeTheme;
}

/**
 * 将 Highlight.js 输出的 class 列表转换为内联 style 字符串
 * class 可能是 "hljs-keyword" 或 "hljs-keyword hljs-strong" 这种组合
 */
export function codeTokenStyle(theme: CodeTheme, className: string): string {
  const colors: string[] = [];
  for (const name of className.split(/\s+/)) {
    const color = theme.tokens[name];
    if (color) colors.push(`color:${color}`);
  }
  // 倾斜/加粗：hljs-emphasis 与 hljs-strong 是辅助类
  if (/\bhljs-emphasis\b/.test(className)) colors.push('font-style:italic');
  if (/\bhljs-strong\b/.test(className)) colors.push('font-weight:bold');
  return colors.join(';');
}
