const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static('public'));
app.use(morgan('combined'));

const KEYFILE = process.env.KEYFILE;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const sheets = google.sheets({ version: 'v4', auth: null });

async function authorize() {
    const auth = new google.auth.GoogleAuth({
        keyFile: KEYFILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return await auth.getClient();
}

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

async function submitForm(req, res) {
    const { name, phone, message } = req.body;
    const currentTime = formatDate(new Date());
    console.log(`Received form submission: ${currentTime}, ${name}, ${phone}`);

    try {
        const client = await authorize();
        const request = {
            spreadsheetId: SPREADSHEET_ID,
            range: 'main!A:D',
            valueInputOption: 'RAW',
            resource: {
                values: [[currentTime, name, phone]],
            },
            auth: client,
        };

        await sheets.spreadsheets.values.append(request);
        console.log('Form submitted successfully');
        res.json({ message: 'Запрос отправлен. Ответим вам в течение суток!' });
    } catch (error) {
        console.error('Error during form submission:', error);
        if (error.code === 404) {
            res.status(404).json({ message: 'Таблица не найдена' });
        } else if (error.code === 403) {
            res.status(403).json({ message: 'Нет доступа к таблице' });
        } else if (error.response) {
            res.status(error.response.status).json({ message: error.response.data });
        } else {
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    }
}

app.post('/submit', submitForm);

module.exports = app;
