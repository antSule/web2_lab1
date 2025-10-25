import express from 'express';
import { pool } from '../db';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.post('/ticket', async (req, res) => {
    const { personal_id, numbers } = req.body;

    if (!personal_id || personal_id.length > 20)
        return res.status(400).send('Nevaljan broj iskaznice');

    if (!Array.isArray(numbers) || numbers.length < 6 || numbers.length > 10)
        return res.status(400).send('Nevaljan broj loto brojeva');

    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== numbers.length)
        return res.status(400).send('Duplikati nisu dozvoljeni');

    for (const num of uniqueNumbers) {
        if (num < 1 || num > 45)
            return res.status(400).send('Brojevi moraju biti izmedu 1 i 45');
    }

    try {
        const roundRes = await pool.query('SELECT id FROM rounds WHERE active = TRUE LIMIT 1');
        if (roundRes.rowCount === 0)
            return res.status(400).send('Ne postoji aktivna runda.');

        const roundId = roundRes.rows[0].id;

        const ticketUUID = uuidv4();

        await pool.query(
            'INSERT INTO tickets (id, round_id, personal_id, numbers) VALUES ($1, $2, $3, $4)',
            [ticketUUID, roundId, personal_id, numbers]
        );

        const ticketURL = `${process.env.BASE_URL || 'http://localhost:3000'}/ticket-details.html?id=${ticketUUID}`;
        const qrCode = await QRCode.toDataURL(ticketURL);

        res.status(200).json({ ticketID: ticketUUID, qrCode });
    } catch (err) {
        res.status(500).send('Greska kod uplacivanja listica.');
    }
});

router.get('/ticket/:id', async (req, res) => {
    const ticketId = req.params.id;

    try {
        const result = await pool.query(
            'SELECT t.id, t.numbers, t.personal_id, r.drawn_numbers, r.active ' +
            'FROM tickets t JOIN rounds r ON t.round_id = r.id WHERE t.id = $1',
            [ticketId]
        );

        if (result.rowCount === 0)
            return res.status(404).send('Listic nije pronaden.');

        const ticket = result.rows[0];
        res.json(ticket);
    } catch (err) {
        res.status(500).send('Greska kod dobavljanja listica.');
    }
});

export default router;
