// 代码高亮主题
// 完整移植自原仓库 WenRender 桌面版，共 8 套主题
// 策略：在构建时导入 highlight.js 官方主题 CSS（esbuild text loader 转为字符串），
// 运行时解析 CSS 提取 .hljs-* 规则，转换为 token 类名 -> 内联样式 的映射
// 这样复制到公众号后无需加载外部样式表，与文章主题的内联样式策略保持一致

import atomOneDarkCss from 'highlight.js/styles/atom-one-dark.css';
import githubCss from 'highlight.js/styles/github.css';
import githubDarkCss from 'highlight.js/styles/github-dark.css';
import monokaiSublimeCss from 'highlight.js/styles/monokai-sublime.css';
import vs2015Css from 'highlight.js/styles/vs2015.css';
import nordCss from 'highlight.js/styles/nord.css';
import nightOwlCss from 'highlight.js/styles/night-owl.css';
import stackOverflowLightCss from 'highlight.js/styles/stackoverflow-light.css';

import type { CodeTheme } from './types';

/** 代码主题来源：官方 CSS 文本 + 元信息 */
interface CodeThemeSource {
  id: string;
  name: string;
  description: string;
  /** 官方主题 CSS 文本（构建时内联） */
  css: string;
  /** 代码块边框色（CSS 中未统一约定，单独指定） */
  border: string;
}

/** 全部代码主题来源（8 套） */
const themeSources: CodeThemeSource[] = [
  {
    id: 'atom-one-dark',
    name: 'Atom 暗色',
    description: '柔和均衡，适合多数语言',
    css: atomOneDarkCss,
    border: '#3a404b',
  },
  {
    id: 'github-light',
    name: 'GitHub 亮色',
    description: '清晰克制的浅色代码风格',
    css: githubCss,
    border: '#d8dee4',
  },
  {
    id: 'github-dark',
    name: 'GitHub 暗色',
    description: '高辨识度的深色代码风格',
    css: githubDarkCss,
    border: '#30363d',
  },
  {
    id: 'monokai-sublime',
    name: 'Monokai',
    description: '鲜明活跃的经典编辑器配色',
    css: monokaiSublimeCss,
    border: '#414238',
  },
  {
    id: 'vs2015',
    name: '微软开发工具',
    description: '接近经典微软开发工具的配色',
    css: vs2015Css,
    border: '#3d3d3d',
  },
  {
    id: 'nord',
    name: 'Nord 极夜',
    description: '冷静柔和的北欧蓝灰色调',
    css: nordCss,
    border: '#4c566a',
  },
  {
    id: 'night-owl',
    name: '夜猫子',
    description: '深蓝背景与高对比暖色',
    css: nightOwlCss,
    border: '#17344d',
  },
  {
    id: 'stackoverflow-light',
    name: '问答社区亮色',
    description: '适合教程和问答内容的浅色主题',
    css: stackOverflowLightCss,
    border: '#d6d9dc',
  },
];

// 解析每个来源 CSS，生成完整的 CodeTheme 对象
export const codeThemes: CodeTheme[] = themeSources.map(createCodeTheme);

/** 默认代码主题（Atom 暗色） */
export const defaultCodeTheme: CodeTheme = codeThemes[0];

/** 按 ID 查找代码主题，未命中则返回默认 */
export function findCodeTheme(id: string | undefined): CodeTheme {
  if (!id) return defaultCodeTheme;
  return codeThemes.find((item) => item.id === id) ?? defaultCodeTheme;
}

/**
 * 将 token class 列表转换为内联 style 字符串
 * class 可能是 "hljs-keyword" 或 "hljs-keyword hljs-strong" 这种组合
 * 未命中任何 token 时回退到主题默认前景色
 */
export function codeTokenStyle(theme: CodeTheme, className: string): string {
  const styles = className
    .split(/\s+/)
    .map((name) => theme.tokenStyles[name])
    .filter(Boolean);
  return styles.length > 0 ? styles.join('') : `color:${theme.foreground};`;
}

/**
 * 解析单个主题来源，生成 CodeTheme
 * 提取 .hljs 根规则得到背景/前景，提取 .hljs-* token 规则得到各 token 颜色
 */
function createCodeTheme(source: CodeThemeSource): CodeTheme {
  const { root, tokenStyles } = parseHighlightTheme(source.css);
  const background = root.background ?? root.backgroundColor ?? '#282c34';
  const foreground = root.color ?? '#abb2bf';
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    background,
    foreground,
    border: source.border,
    swatches: [
      background,
      extractColor(tokenStyles['hljs-keyword']) ?? foreground,
      extractColor(tokenStyles['hljs-string']) ?? foreground,
    ],
    tokenStyles,
  };
}

/** 解析 highlight.js 主题 CSS，分离根规则与 token 规则 */
function parseHighlightTheme(css: string): {
  root: Record<string, string>;
  tokenStyles: Record<string, string>;
} {
  // 先去除注释
  const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const root: Record<string, string> = {};
  const tokenStyles: Record<string, string> = {};

  // 逐条匹配 selector { declarations } 规则
  for (const match of cleanCss.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    const selectors = match[1].split(',').map((selector) => selector.trim());
    const declarations = parseDeclarations(match[2]);
    const inlineStyle = toInlineStyle(declarations);
    if (!inlineStyle) continue;

    for (const selector of selectors) {
      // .hljs 根选择器：收集背景与默认前景
      if (selector === '.hljs') Object.assign(root, declarations);
      // 从选择器中提取最后一个 hljs-* 类名作为 token 键
      const classes = [...selector.matchAll(/\.([\w-]+)/g)].map((item) => item[1]);
      const tokenClass = [...classes].reverse().find((name) => name.startsWith('hljs-'));
      if (tokenClass) {
        // 同一 token 可能出现在多个组合选择器中，按属性合并避免重复 style
        tokenStyles[tokenClass] = toInlineStyle({
          ...parseDeclarations(tokenStyles[tokenClass] ?? ''),
          ...declarations,
        });
      }
    }
  }

  return { root, tokenStyles };
}

/** 将声明块字符串解析为属性 -> 值的对象 */
function parseDeclarations(source: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  for (const declaration of source.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator < 0) continue;
    const property = declaration.slice(0, separator).trim();
    const value = declaration.slice(separator + 1).trim();
    if (property && value) declarations[property] = value;
  }
  return declarations;
}

/** 将声明对象转换为内联 style 字符串，仅保留微信可识别的颜色/字重相关属性 */
function toInlineStyle(declarations: Record<string, string>): string {
  const supported = [
    'color',
    'background',
    'background-color',
    'font-style',
    'font-weight',
    'text-decoration',
  ];
  return supported
    .filter((property) => declarations[property])
    .map((property) => `${property}:${declarations[property]};`)
    .join('');
}

/** 从内联 style 字符串中提取 color 值，用于色板展示 */
function extractColor(style?: string): string | null {
  return style?.match(/(?:^|;)color:([^;]+)/)?.[1] ?? null;
}
