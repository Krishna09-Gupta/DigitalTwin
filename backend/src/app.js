const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { notFound, errorHandler } = require('./middleware/error');
const authRoutes = require('./routes/authRoutes');
const twinRoutes = require('./routes/twinRoutes');

const app = express();

app.disable('x-powered-by');

app.use(helmet());

app.use(
    cors({
        origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
    })
);

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OPERATIONAL',
        service: 'antarctica-twin-api'
    });
});

app.use('/api/auth', authRoutes);
app.use('/api', twinRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;