const express = require('express');
const dotenv = require('dotenv');
const { addUser, removeUser } = require('./xrayGrpc');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PROXY_API_PORT || 8080;
const API_TOKEN = process.env.PROXY_API_TOKEN || 'supersecrettoken';

// Простая авторизация
app.use((req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];
  // if (token !== API_TOKEN) {
  //   return res.status(403).json({ success: false, message: 'Forbidden' });
  // }
  next();
});

app.get('/checkcreate', async (req, res) => {
  const {uuid, remark} = req.query;
  if (!uuid || !remark)
    return res.status(400).json({ success: false, message: 'Missing uuid or remark' });

  try {
    await addUser(uuid, remark);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
})

app.post('/create', async (req, res) => {
  const { uuid, remark } = req.body;
  if (!uuid || !remark)
    return res.status(400).json({ success: false, message: 'Missing uuid or remark' });

  try {
    await addUser(uuid, remark);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/delete', async (req, res) => {
  const { remark } = req.body;
  if (!remark)
    return res.status(400).json({ success: false, message: 'Missing remark' });

  try {
    await removeUser(remark);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy API запущен на http://localhost:${PORT}`);
});
