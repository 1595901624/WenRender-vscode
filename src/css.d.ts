// CSS 模块类型声明
// esbuild 将 .css 文件以 text loader 导入为字符串，此处声明模块类型
// 使 TypeScript 能识别 import xxx from '*.css' 语法

declare module '*.css' {
  const content: string;
  export default content;
}
