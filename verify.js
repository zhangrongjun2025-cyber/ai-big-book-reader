const fs = require('fs');
const path = require('path');

const root = __dirname;
const books = JSON.parse(fs.readFileSync(path.join(root, 'books.json'), 'utf8'));
const ids = new Set();
const codes = new Set();

if (books.length !== 28) throw new Error(`应有28本，实际为${books.length}本`);

for (const book of books) {
  if (ids.has(book.id)) throw new Error(`重复 id: ${book.id}`);
  if (codes.has(book.code)) throw new Error(`重复编号: ${book.code}`);
  ids.add(book.id);
  codes.add(book.code);

  if (path.isAbsolute(book.path) || book.path.includes('..')) {
    throw new Error(`不是安全相对路径: ${book.path}`);
  }

  const markdownPath = path.join(root, book.path);
  if (!fs.existsSync(markdownPath)) throw new Error(`正文不存在: ${book.path}`);
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  for (const layer of ['第一层', '第二层', '第三层']) {
    if (!markdown.includes(`# ${layer}`)) throw new Error(`${book.code} 缺少${layer}`);
  }
}

console.log(`验证通过：${books.length}本书，路径与三层结构完整。`);
