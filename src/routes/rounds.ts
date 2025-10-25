import express from 'express';
import { pool } from '../db';
import { expressjwt as jwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

const router = express.Router();

const checkJwt = jwt({
        secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: 'https://${process.env.AUTH0_DOMAIN/.well-known/jwks.json',
    }),
    audience: 'https://dev-1s8pormaj7580ys5.eu.auth0.com/api/v2/',
    issuer: 'https://${process.env.AUTH0_DOMAIN}/',
    algorithms: ['RS256']
});

router.post('/new-round', async (req, res) => {
    try {
        await pool.query('BEGIN');
        await pool.query('UPDATE rounds SET active = FALSE WHERE active = TRUE');
        await pool.query('INSERT INTO rounds (active) VALUES (true)');
        await pool.query('COMMIT');
        res.status(204).send('Nova runda zapoceta!');
    } catch (error) {
        await pool.query('ROLLBACK');
        res.status(500).send('Greska kod aktiviranja nove runde.');
    }
});

router.post('/close', async(req, res) => {
    try {
        await pool.query('UPDATE rounds SET active = FALSE WHERE active = TRUE');
        res.status(204).send('Round closed successfully');
    } catch (error) {
        res.status(500).send('Greska kod deaktiviranja nove runde.');
    }
});

router.post('/store-results', async (req, res) => {
  const { numbers } = req.body;

  try {
    const roundResult = await pool.query('SELECT id FROM rounds WHERE active = FALSE AND drawn_numbers IS NULL ORDER BY id DESC LIMIT 1');

    if (roundResult.rowCount === 0)
      return res.status(400).send('Nije pronadena runda');

    const roundId = roundResult.rows[0].id;

    await pool.query('UPDATE rounds SET drawn_numbers = $1 WHERE id = $2', [numbers, roundId]);

    res.status(204).send(`Results stored for round ID: ${roundId}`);
  } catch (error) {
    res.status(500).send('Greska kod spremanja izvucenih brojeva.');
  }
});

export default router;
