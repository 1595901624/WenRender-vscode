// 共享类型定义
// 与原仓库 WenRender 桌面版的主题结构保持一致，便于直接复用主题数据

/** 二级标题样式枚举 */
export type HeadingStyle =
  | 'underline'
  | 'left-bar'
  | 'filled'
  | 'centered'
  | 'boxed'
  | 'marker'
  | 'double-line'
  | 'minimal'
  | 'tag'
  | 'newspaper';

/** 引用块样式枚举 */
export type BlockquoteStyle = 'border' | 'soft' | 'quote' | 'card';

/** 文章主题颜色配置 */
export interface ArticleColors {
  /** 主题强调色 */
  accent: string;
  /** 强调色弱化版（背景填充） */
  accentSoft: string;
  /** 标题颜色 */
  heading: string;
  /** 正文文字颜色 */
  text: string;
  /** 次要文字颜色（引用等） */
  muted: string;
  /** 链接颜色 */
  link: string;
  /** 边框颜色 */
  border: string;
  /** 行内代码背景色 */
  inlineCodeBackground: string;
  /** 代码块背景色 */
  codeBackground: string;
  /** 代码块默认前景色 */
  codeText: string;
  /** 文章背景色 */
  articleBackground: string;
}

/** 文章主题排版相关配置 */
export interface ArticleTypography {
  /** 正文字体 */
  fontFamily: string;
  /** 正文字号（px） */
  bodySize: number;
  /** 正文行高 */
  bodyLineHeight: number;
  /** 段落间距（px） */
  paragraphSpacing: number;
  /** 行内代码字号（px） */
  codeSize: number;
  /** 代码块行高 */
  codeLineHeight: number;
  /** 一级标题字号（px） */
  h1Size: number;
  /** 二级标题字号（px） */
  h2Size: number;
}

/** 文章主题外观配置 */
export interface ArticleAppearance {
  /** 二级标题样式 */
  headingStyle: HeadingStyle;
  /** 一级标题对齐方式 */
  h1Align: 'left' | 'center';
  /** 引用块样式 */
  blockquoteStyle: BlockquoteStyle;
  /** 代码块圆角（px） */
  codeRadius: number;
  /** 图片圆角（px） */
  imageRadius: number;
}

/** 完整文章主题 */
export interface ArticleTheme {
  id: string;
  name: string;
  description: string;
  /** 色板，用于选择器预览展示（3 色：主色 / 浅底 / 文字） */
  swatches: [string, string, string];
  colors: ArticleColors;
  typography: ArticleTypography;
  appearance: ArticleAppearance;
}

/** 代码高亮主题 */
export interface CodeTheme {
  id: string;
  name: string;
  description: string;
  /** 代码块背景色 */
  background: string;
  /** 代码块默认前景色 */
  foreground: string;
  /** 代码块边框色 */
  border: string;
  /** 色板，用于选择器预览展示（3 色：背景 / 关键字 / 字符串） */
  swatches: [string, string, string];
  /** token 类名 -> 内联样式 的映射（已包含 color:xxx; 形式） */
  tokenStyles: Record<string, string>;
}
