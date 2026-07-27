// esbuild 构建脚本：将 src 下的 TypeScript 打包为 dist/extension.js
// 同时处理依赖外置（vscode 由运行时提供）与生产模式压缩
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  // vscode 模块由扩展宿主注入，必须外置
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node16',
  sourcemap: !production,
  minify: production,
  outfile: 'dist/extension.js',
  logLevel: 'info',
  // 将 highlight.js 官方主题 CSS 作为纯文本导入，运行时解析提取 token 颜色
  // 对应原仓库 Vite 的 ?inline 写法
  loader: { '.css': 'text' },
};

async function main() {
  if (watch) {
    // 开发模式：监听文件变化并增量构建
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('[wenrender] 监听构建已启动');
  } else {
    // 生产构建：一次性输出
    await esbuild.build(options);
    console.log('[wenrender] 构建完成');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
