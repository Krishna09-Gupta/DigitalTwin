require('dotenv').config({path:require('path').resolve(__dirname,'../../.env')});
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const app = require('./src/app');
const { pool } = require('./src/config/db');

const PORT = Number(process.env.PORT || 3000);

const server = http.createServer(app);

const wss = new WebSocket.Server({
    server,
    path: '/ws/telemetry'
});

function authorizeStation(user, stationId) {
    return (
        user.role === 'admin' ||
        Number(user.station_id) === Number(stationId)
    );
}

wss.on('connection', ws => {
    ws.user = null;
    ws.subscriptions = new Set();

    ws.on('error',(err)=>{
        console.error('WebSocket error:',err.message);
    })

    ws.on('close',()=>{
        console.log('Websocket client disconnected');
    })

    ws.send(
        JSON.stringify({
            type: 'WS_READY',
            message: 'Authenticate with an AUTH message.'
        })
    );

    ws.on('message', async raw => {
        try {
            const message = JSON.parse(raw.toString());

            if (message.type === 'AUTH') {
                const payload = jwt.verify(
                    message.token,
                    process.env.JWT_SECRET
                );

                const session = await pool.query(
                    `SELECT
                        s.*,
                        u.role,
                        u.station_id,
                        u.active,
                        u.must_change_password
                     FROM sessions s
                     JOIN users u ON u.id = s.user_id
                     WHERE s.jti = $1`,
                    [payload.jti]
                );


                if (
                    !session.rowCount ||
                    session.rows[0].revoked_at ||
                    new Date(session.rows[0].expires_at)<=new Date()||
                    !session.rows[0].active
                ) {
                    ws.close(1008, 'Invalid session');
                    return;
                }

                if (session.rows[0].must_change_password) {
                    ws.close(1008, 'Password change required');
                    return;
                }

                ws.user = {
                    id: session.rows[0].user_id,
                    role: session.rows[0].role,
                    station_id: session.rows[0].station_id
                };

                ws.send(
                    JSON.stringify({
                        type: 'AUTH_OK'
                    })
                );

                return;
            }

            if (!ws.user) {
                ws.close(1008, 'Authenticate first');
                return;
            }

            if (message.type === 'SUBSCRIBE') {
                const ids = Array.isArray(message.station_ids)
                    ? message.station_ids
                    : [message.station_id];

                for (const id of ids) {
                    if (id === 'ALL' && ws.user.role === 'admin') {
                        ws.subscriptions.add('ALL');
                    } else if (
                        Number.isInteger(Number(id)) &&
                        authorizeStation(ws.user, Number(id))
                    ) {
                        ws.subscriptions.add(String(id));
                    }
                }

                ws.send(
                    JSON.stringify({
                        type: 'SUBSCRIPTIONS',
                        station_ids: [...ws.subscriptions]
                    })
                );
            }
        } catch(err) {
            console.error('[WS MESSAGE]',err);
            ws.close(1008, 'Invalid websocket message');
        }
    });
});

async function startNotifyListener() {
    const client = await pool.connect();

    await client.query('LISTEN telemetry_update');

    client.on('notification', async msg => {

        try {
            const payload = JSON.parse(msg.payload);

            const metricResult = await pool.query(
                `SELECT
                    tm.*,
                    s.name AS station_name
                 FROM telemetry_metrics tm
                 JOIN stations s ON s.id = tm.station_id
                 WHERE tm.id = $1`,
                [payload.metricId]
            );

            if (!metricResult.rowCount) {
                return;
            }

            const data = metricResult.rows[0];

            for (const ws of wss.clients) {
                if (
                    ws.readyState !== WebSocket.OPEN ||
                    !ws.user
                ) {
                    continue;
                }

                const allowed =
                    ws.subscriptions.has('ALL') ||
                    ws.subscriptions.has(String(data.station_id));

                if (allowed) {
                    ws.send(
                        JSON.stringify({
                            type: 'TELEMETRY_UPDATE',
                            data
                        })
                    );
                }
            }
        } catch (err) {
            console.error('[NOTIFY]', err.message);
        }
    });
}

startNotifyListener().catch(err => {
    console.error('[WS LISTENER]', err);
    process.exit(1);
});

server.listen(PORT, () => {
    console.log(`[API] Mission control listening on ${PORT}`);
});

function shutdown() {
    server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);