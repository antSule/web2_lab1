import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import fs from 'fs';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data.json');

function readData(): any {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = {
      settings: { xss_enabled: false, sensitive_enabled: false },
      comments: [],
      users: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(d: any): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
}

const app = express();

app.use(express.static(path.join(ROOT, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'src', 'public', 'index.html'));
});

app.post('/comment', (req, res) => {
  const data = readData();
  const text = req.body.text || req.query.text || '';
  const author = req.body.author || req.query.author || 'anon';

  let storedText = text;
  if (!data.settings.xss_enabled) {
    storedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  data.comments.push({ id: uuidv4(), author: author, text: storedText });
  writeData(data);

  if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
    return res.json({ ok: true });
  }
  res.redirect('/');
});

app.post('/toggle', (req, res) => {
  const data = readData();
  const which = req.body.which;
  const value =
    req.body.value === 'on' ||
    req.body.value === true ||
    req.body.value === 'true';
  if (which === 'xss') data.settings.xss_enabled = value;
  if (which === 'sensitive') data.settings.sensitive_enabled = value;
  writeData(data);
  return res.json({ ok: true, settings: data.settings });
});

app.get('/api/comments', (req, res) => {
  const data = readData();
  return res.json({ comments: data.comments, settings: data.settings });
});

app.get('/api/users', (req, res) => {
  const data = readData();
  if (data.settings.sensitive_enabled) {
    return res.json({ users: data.users });
  } else {
    const masked = data.users.map((u: any) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      password: '********'
    }));
    return res.json({ users: masked });
  }
});

app.delete('/comment/:id', (req, res) => {
  const data = readData();
  const id = req.params.id;

  const index = data.comments.findIndex((c: any) => c.id === id);
  if (index === -1) {
    return res.status(404).json({ ok: false, message: 'Comment not found' });
  }

  data.comments.splice(index, 1);
  writeData(data);

  return res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Listening on', PORT));
