// 文章主题数据
// 参考 WenRender 桌面版主题结构，精选三款常用主题
// 切换主题后，预览与导出 HTML 会同时使用当前主题的内联样式

import type { ArticleTheme } from './types';

/** 经典绿：技术教程与通用文章 */
const classicGreen: ArticleTheme = {
  id: 'classic-green',
  name: '经典绿',
  description: '技术教程与通用文章',
  swatches: ['#1a8a4f', '#e8f5ee', '#272825', '#f6f6f4'],
  colors: {
    text: '#272825',
    heading: '#1a8a4f',
    muted: '#6b7280',
    link: '#1a8a4f',
    accent: '#1a8a4f',
    accentSoft: '#e8f5ee',
    inlineCodeBackground: '#e8f5ee',
    articleBackground: '#ffffff',
    border: '#e5e7eb',
  },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    bodySize: 15,
    bodyLineHeight: 1.75,
    paragraphSpacing: 18,
    codeSize: 13,
    codeLineHeight: 1.6,
    h1Size: 24,
    h2Size: 19,
  },
  appearance: {
    headingStyle: 'left-bar',
    blockquoteStyle: 'border',
    h1Align: 'left',
    imageRadius: 6,
    codeRadius: 6,
  },
};

/** 极简黑白：长文阅读与简洁排版 */
const minimalMono: ArticleTheme = {
  id: 'minimal-mono',
  name: '极简黑白',
  description: '长文阅读与简洁排版',
  swatches: ['#111111', '#f5f5f5', '#222222', '#fafafa'],
  colors: {
    text: '#222222',
    heading: '#111111',
    muted: '#6b7280',
    link: '#111111',
    accent: '#111111',
    accentSoft: '#f5f5f5',
    inlineCodeBackground: '#f5f5f5',
    articleBackground: '#ffffff',
    border: '#e5e7eb',
  },
  typography: {
    fontFamily: "'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    bodySize: 15,
    bodyLineHeight: 1.8,
    paragraphSpacing: 20,
    codeSize: 13,
    codeLineHeight: 1.6,
    h1Size: 24,
    h2Size: 19,
  },
  appearance: {
    headingStyle: 'minimal',
    blockquoteStyle: 'quote',
    h1Align: 'left',
    imageRadius: 0,
    codeRadius: 0,
  },
};

/** 深海科技：工程、编程与人工智能文章 */
const deepTech: ArticleTheme = {
  id: 'deep-tech',
  name: '深海科技',
  description: '工程、编程与人工智能文章',
  swatches: ['#0ea5e9', '#0f172a', '#e2e8f0', '#0b1220'],
  colors: {
    text: '#1e293b',
    heading: '#0f172a',
    muted: '#64748b',
    link: '#0ea5e9',
    accent: '#0ea5e9',
    accentSoft: '#e0f2fe',
    inlineCodeBackground: '#e0f2fe',
    articleBackground: '#ffffff',
    border: '#cbd5e1',
  },
  typography: {
    fontFamily: "'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    bodySize: 15,
    bodyLineHeight: 1.75,
    paragraphSpacing: 18,
    codeSize: 13,
    codeLineHeight: 1.6,
    h1Size: 24,
    h2Size: 19,
  },
  appearance: {
    headingStyle: 'underline',
    blockquoteStyle: 'card',
    h1Align: 'left',
    imageRadius: 8,
    codeRadius: 8,
  },
};

/** 全部内置主题列表 */
export const articleThemes: ArticleTheme[] = [classicGreen, minimalMono, deepTech];

/** 默认主题 */
export const defaultTheme: ArticleTheme = classicGreen;

/** 按 ID 查找主题，未命中则返回默认主题 */
export function findTheme(id: string | undefined): ArticleTheme {
  if (!id) return defaultTheme;
  return articleThemes.find((item) => item.id === id) ?? defaultTheme;
}
