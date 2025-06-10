const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const PORT = 3000;

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'todolist',
};

async function retrieveListItems() {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT id, text FROM items');
    await connection.end();
    return rows;
}

async function addItemToDatabase(text) {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute('INSERT INTO items (text) VALUES (?)', [text]);
    await connection.end();
    return result.insertId;
}

async function deleteListItem(id) {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('DELETE FROM items WHERE id = ?', [id]);
    await connection.end();
}

async function handleRequest(req, res) {
    if (req.url === '/') {
        try {
            const html = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf8');
            const todoItems = await retrieveListItems();
            const rowsHtml = todoItems.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.text}</td>
                    <td><button onclick="removeItem(${item.id})">Remove</button></td>
                </tr>
            `).join('');
            const processedHtml = html.replace('{{rows}}', rowsHtml);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(processedHtml);
        } catch (err) {
            console.error(err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading index.html');
        }
    }
    else if (req.url === '/items' && req.method === 'GET') {
        // Возвращаем JSON со всеми элементами
        try {
            const items = await retrieveListItems();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(items));
        } catch (err) {
            console.error(err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error retrieving items' }));
        }
    }
    else if (req.url === '/add' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { text } = JSON.parse(body);
                const insertId = await addItemToDatabase(text);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Item added', id: insertId }));
            } catch (error) {
                console.error('Error adding item:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Error adding item' }));
            }
        });
    }
    else if (req.url.startsWith('/delete/') && req.method === 'DELETE') {
        const id = parseInt(req.url.split('/').pop(), 10);
        if (isNaN(id)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Invalid ID' }));
            return;
        }
        try {
            await deleteListItem(id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Item deleted' }));
        } catch (error) {
            console.error('Error deleting item:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Error deleting item' }));
        }
    }
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Route not found');
    }
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
