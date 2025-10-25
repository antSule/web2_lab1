import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { auth } from 'express-openid-connect';
import roundsRoutes from './routes/rounds';
import ticketRoutes from './routes/tickets';
import { pool } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    issuerBaseURL: `https://${process.env.AUTH0_ISSUER_BASE_URL}`,
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    clientID: process.env.AUTH0_CLIENT_ID,
    secret: process.env.SESSION_SECRET,
  })
);

app.get('/user', (req, res) => {
  if (req.oidc.isAuthenticated()) {
    res.json({
      loggedIn: true,
      user: req.oidc.user,
    });
  } else {
    res.json({ loggedIn: false });
  }
});

app.get('/rounds-info', async (req, res) => {
  try {
    const roundResult = await pool.query('SELECT id, active, drawn_numbers FROM rounds ORDER BY id DESC LIMIT 1');

    if (roundResult.rowCount === 0)
      return res.json({ ticketCount: 0, drawnNumbers: '-', active: false });

    const round = roundResult.rows[0];
    const ticketsRes = await pool.query('SELECT COUNT(*) FROM tickets WHERE round_id = $1', [round.id]);

    res.json({
      ticketCount: ticketsRes.rows[0].count,
      drawnNumbers: round.drawn_numbers || '-',
      active: round.active,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ticketCount: 0, drawnNumbers: '-', active: false });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use('/', roundsRoutes);
app.use('/', ticketRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
