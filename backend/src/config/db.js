require('dotenv').config({path:require('path').resolve(__dirname,'../../../.env')});
const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({
    path: path.resolve(__dirname, '../../../.env')
});

const ssl = process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: true }
    : false;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
    max: 15,
    idleTimeoutMillis: 30000
});

async function query(text, params) {
    return pool.query(text, params);
}

async function closePool() {
    await pool.end();
}

module.exports = {
    pool,
    query,
    closePool
};