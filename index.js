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

async function queryDb(query, params = []) {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(query, params);
    await connection.end();
    return rows;
}

async function retrieveListItems() {
    return await queryDb('SELECT id, text FROM items');
}

async function addItem(text) {
    const result = await queryDb('INSERT INTO items (text) VALUES (?)', [text]);
    return { id: result.insertId, text };
}

async function removeItem(id) {
    await queryDb('DELETE FROM items WHERE id = ?', [id]);
}

async function updateItem(id, text) {
    await queryDb('UPDATE items SET text = ? WHERE id = ?', [text, id]);
}

// Читаем index.html
async function getIndexHtml() {
    return await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf8');
}

async function handleRequest(req, res) {
    if (req.method === 'GET' && req.url === '/') {
        try {
            const html = await getIndexHtml();
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        } catch (err) {
            console.error(err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading index.html');
        }
    } else if (req.method === 'GET' && req.url === '/items') {
        try {
            const items = await retrieveListItems();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(items));
        } catch (err) {
            res.writeHead(500);
            res.end('Error retrieving items');
        }
    } else if (req.method === 'POST' && req.url === '/add') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { text } = JSON.parse(body);
                if (!text) throw new Error('Text is required');
                const newItem = await addItem(text);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newItem));
            } catch (err) {
                res.writeHead(400);
                res.end('Invalid request');
            }
        });
    } else if (req.method === 'POST' && req.url === '/delete') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { id } = JSON.parse(body);
                if (!id) throw new Error('ID is required');
                await removeItem(id);
                res.writeHead(200);
                res.end('Deleted');
            } catch (err) {
                res.writeHead(400);
                res.end('Invalid request');
            }
        });
    } else if (req.method === 'POST' && req.url === '/update') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { id, text } = JSON.parse(body);
                if (!id || !text) throw new Error('ID and text are required');
                await updateItem(id, text);
                res.writeHead(200);
                res.end('Updated');
            } catch (err) {
                res.writeHead(400);
                res.end('Invalid request');
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Route not found');
    }
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
