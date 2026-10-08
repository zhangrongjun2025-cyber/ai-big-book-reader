# AI帮我读大部头

移动端优先的三层阅读器。当前公开版本收录28本移动阅读版，每本包含“3分钟速览、完整导读、深入阅读”。

## 技术结构

- 原生 HTML、CSS、JavaScript
- `books.json` 作为书籍索引
- `books/` 保存独立 Markdown 正文
- 纯静态运行，不需要数据库和后端 API

## 本地运行

```bash
npm run check
npm start
```

浏览器打开 `http://127.0.0.1:4173/`。

## 内容更新

新增书籍时，把 Markdown 放入 `books/`，并在 `books.json` 中增加对应记录。正文须包含第一层、第二层、第三层三段结构。

## GitHub 与 Netlify 分离规则

默认更新流程到 GitHub 为止：

1. 本地新增或修改移动阅读版；
2. 更新 `books.json`；
3. 执行 `npm run check` 并进行本地检查；
4. 执行 `git add`；
5. 执行 `git commit`；
6. 执行 `git push`；
7. 到此停止，不自动部署 Netlify。

只有项目负责人明确说“现在部署到Netlify”“更新Netlify”或“把当前版本重新部署”时，才允许继续：

8. 手动触发一次 Netlify 部署；
9. 检查线上首页、书籍正文和手机显示。

本项目不配置 GitHub push 自动部署，不建立自动 CI/CD，不把 Netlify 连接为持续部署来源。GitHub 用于保存版本，Netlify 只接受明确授权后的手动发布。
