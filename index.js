const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const url = require('url');

const PORT = 3000;

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'todolist',
};

async function queryDB(query, params = []) {
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute(query, params);
  await connection.end();
  return rows;
}

// Получить все задачи
async function retrieveListItems() {
  return queryDB('SELECT id, text FROM items ORDER BY id');
}

// Добавить задачу
async function addItem(text) {
  const result = await queryDB('INSERT INTO items (text) VALUES (?)', [text]);
  return { id: result.insertId, text };
}

// Удалить задачу по id
async function removeItem(id) {
  await queryDB('DELETE FROM items WHERE id = ?', [id]);
}

// Обновить задачу по id
async function updateItem(id, text) {
  await queryDB('UPDATE items SET text = ? WHERE id = ?', [text, id]);
}

// Генерация HTML строк для таблицы с порядковым номером (index + 1)
async function getHtmlRows() {
  const todoItems = await retrieveListItems();
  return todoItems.map((item, index) => `
    <tr data-id="${item.id}">
      <td>${index + 1}</td>
      <td class="text-cell">${item.text}</td>
      <td>
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </td>
    </tr>
  `).join('');
}

// Обработка запросов
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;

  if (req.url === '/' && method === 'GET') {
    try {
      const html = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf8');
      const processedHtml = html.replace('{{rows}}', await getHtmlRows());
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(processedHtml);
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading index.html');
    }
  }
  else if (parsedUrl.pathname === '/api/add' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body);
        if (!text || !text.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Text is required' }));
          return;
        }
        const newItem = await addItem(text.trim());
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newItem));
      } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    });
  }
  else if (parsedUrl.pathname === '/api/delete' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body);
        if (!id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ID is required' }));
          return;
        }
        await removeItem(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    });
  }
  else if (parsedUrl.pathname === '/api/edit' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { id, text } = JSON.parse(body);
        if (!id || !text || !text.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ID and text are required' }));
          return;
        }
        await updateItem(id, text.trim());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    });
  }
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Route not found');
  }
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
