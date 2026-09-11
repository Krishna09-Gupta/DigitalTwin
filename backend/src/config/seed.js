const bcrypt = require('bcrypt');
const { pool } = require('./db');

const stations = [
    {
        code: 'BHR',
        name: 'Bharati',
        description: 'Bharati Antarctic Research Station'
    },
    {
        code: 'MTR',
        name: 'Maitri',
        description: 'Maitri Antarctic Research Station'
    }
];

const profiles = {
    Bharati: [
        ['Energy', 'Solar Array Grid Output', 'kW', 45.2, 5, 60, 1],
        ['Energy', 'Emergency Fuel Reserve Level', '%', 84, 0, 100, 1],
        ['Life Support', 'Habitat Oxygen Saturation', '%', 20.9, 18, 22, 0.1],
        ['Weather', 'External Ambient Temperature', '°C', -32, -70, 5, 1],
        ['Weather', 'Perimeter Wind Velocity', 'knots', 28, 0, 80, 1],
        ['Environment', 'Relative Humidity', '%', 78, 0, 100, 2]
    ],
    Maitri: [
        ['Energy', 'Solar Array Grid Output', 'kW', 38.7, 5, 60, 1],
        ['Energy', 'Emergency Fuel Reserve Level', '%', 91, 0, 100, 1],
        ['Life Support', 'Habitat Oxygen Saturation', '%', 21.0, 18, 22, 0.1],
        ['Weather', 'External Ambient Temperature', '°C', -18, -70, 5, 1],
        ['Weather', 'Perimeter Wind Velocity', 'knots', 14, 0, 80, 1],
        ['Environment', 'Relative Humidity', '%', 73, 0, 100, 2]
    ]
};

const logistics = {
    Bharati: [
        ['Energy', 'diesel_fuel', 'Heating / Diesel Fuel', 'L', 12000, 6800, 3000, 'NOMINAL', 'Fuel Farm', 'Next scheduled cargo'],
        ['Energy', 'emergency_fuel', 'Emergency Fuel Reserve', '%', 100, 84, 30, 'NOMINAL', 'Secure Fuel Store', 'On station'],
        ['Water', 'potable_water', 'Potable Water', 'L', 10000, 7800, 3000, 'NOMINAL', 'Water Module', 'On station'],
        ['Food', 'food_stores', 'Food Stores', 'days', 120, 71, 30, 'ADEQUATE', 'Main Stores', 'Next resupply: 18 days'],
        ['Medical', 'medical_supplies', 'Medical Supplies', '%', 100, 88, 45, 'NOMINAL', 'Medical Unit', 'On station'],
        ['Life Support', 'oxygen_cylinders', 'Oxygen Cylinders', 'cyl', 60, 46, 20, 'NOMINAL', 'Life Support Store', 'On station'],
        ['Maintenance', 'critical_spares', 'Critical Spare Parts', '%', 100, 73, 40, 'ADEQUATE', 'Maintenance Bay', 'Cargo manifest pending'],
        ['Power', 'generator_readiness', 'Emergency Generator Readiness', '%', 100, 96, 75, 'NOMINAL', 'Power House', 'On station'],
        ['Power', 'battery_backup', 'Battery Backup', '%', 100, 79, 40, 'NOMINAL', 'Power House', 'On station'],
        ['Research', 'research_consumables', 'Research Consumables', '%', 100, 68, 35, 'ADEQUATE', 'Research Store', 'Resupply: 26 days'],
        ['Waste', 'waste_capacity', 'Waste Storage Capacity', '%', 100, 24, 80, 'NOMINAL', 'Waste Module', 'Pickup planned'],
        ['Mobility', 'vehicle_readiness', 'Cargo / Vehicle Readiness', '%', 100, 91, 70, 'NOMINAL', 'Vehicle Bay', '2 vehicles available'],
        ['Communications', 'satcom_readiness', 'Satellite Communication Equipment', '%', 100, 93, 70, 'NOMINAL', 'Comms Room', 'On station'],
        ['Safety', 'ppe_stock', 'PPE / Field Safety Stock', '%', 100, 86, 50, 'NOMINAL', 'Safety Store', 'On station']
    ],
    Maitri: [
        ['Energy', 'diesel_fuel', 'Heating / Diesel Fuel', 'L', 15000, 10800, 4000, 'NOMINAL', 'Fuel Farm', 'On station'],
        ['Energy', 'emergency_fuel', 'Emergency Fuel Reserve', '%', 100, 91, 30, 'NOMINAL', 'Secure Fuel Store', 'On station'],
        ['Water', 'potable_water', 'Potable Water', 'L', 12000, 9200, 3500, 'NOMINAL', 'Water Module', 'On station'],
        ['Food', 'food_stores', 'Food Stores', 'days', 150, 96, 35, 'NOMINAL', 'Main Stores', 'Next resupply: 31 days'],
        ['Medical', 'medical_supplies', 'Medical Supplies', '%', 100, 82, 45, 'NOMINAL', 'Medical Unit', 'On station'],
        ['Life Support', 'oxygen_cylinders', 'Oxygen Cylinders', 'cyl', 70, 55, 20, 'NOMINAL', 'Life Support Store', 'On station'],
        ['Maintenance', 'critical_spares', 'Critical Spare Parts', '%', 100, 61, 40, 'ADEQUATE', 'Maintenance Bay', 'Cargo manifest pending'],
        ['Power', 'generator_readiness', 'Emergency Generator Readiness', '%', 100, 94, 75, 'NOMINAL', 'Power House', 'On station'],
        ['Power', 'battery_backup', 'Battery Backup', '%', 100, 84, 40, 'NOMINAL', 'Power House', 'On station'],
        ['Research', 'research_consumables', 'Research Consumables', '%', 100, 76, 35, 'NOMINAL', 'Research Store', 'On station'],
        ['Waste', 'waste_capacity', 'Waste Storage Capacity', '%', 100, 31, 80, 'NOMINAL', 'Waste Module', 'Pickup planned'],
        ['Mobility', 'vehicle_readiness', 'Cargo / Vehicle Readiness', '%', 100, 87, 70, 'NOMINAL', 'Vehicle Bay', '3 vehicles available'],
        ['Communications', 'satcom_readiness', 'Satellite Communication Equipment', '%', 100, 96, 70, 'NOMINAL', 'Comms Room', 'On station'],
        ['Safety', 'ppe_stock', 'PPE / Field Safety Stock', '%', 100, 90, 50, 'NOMINAL', 'Safety Store', 'On station']
    ]
};

async function seed() {
    if (process.env.SEED_DEMO_DATA !== 'true') {
        console.log('[SEED] SEED_DEMO_DATA is not true; nothing seeded.');
        return;
    }

    for (const station of stations) {
        await pool.query(
            `INSERT INTO stations(code, name, description)
             VALUES($1, $2, $3)
             ON CONFLICT(name) DO UPDATE SET
                 code = EXCLUDED.code,
                 description = EXCLUDED.description`,
            [station.code, station.name, station.description]
        );
    }

    for (const [stationName, rows] of Object.entries(profiles)) {
        const station = (
            await pool.query(
                'SELECT id FROM stations WHERE name = $1',
                [stationName]
            )
        ).rows[0];

        for (const [domain, metricName, unit, current, min, max, step] of rows) {
            await pool.query(
                `INSERT INTO telemetry_metrics(
                    station_id,
                    domain,
                    metric_name,
                    unit,
                    current_value,
                    min_value,
                    max_value
                )
                VALUES($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT(station_id, metric_name) DO NOTHING`,
                [station.id, domain, metricName, unit, current, min, max]
            );

            await pool.query(
                `INSERT INTO simulation_profiles(
                    station_id,
                    metric_name,
                    step,
                    min_value,
                    max_value
                )
                VALUES($1, $2, $3, $4, $5)
                ON CONFLICT(station_id, metric_name) DO NOTHING`,
                [station.id, metricName, step, min, max]
            );
        }
    }

    for (const [stationName, rows] of Object.entries(logistics)) {
        const station = (
            await pool.query(
                'SELECT id FROM stations WHERE name = $1',
                [stationName]
            )
        ).rows[0];

        for (const row of rows) {
            const [
                category,
                itemKey,
                itemName,
                unit,
                capacity,
                currentQuantity,
                reorderThreshold,
                status,
                location,
                eta
            ] = row;

            await pool.query(
                `INSERT INTO station_logistics(
                    station_id,
                    category,
                    item_key,
                    item_name,
                    unit,
                    capacity,
                    current_quantity,
                    reorder_threshold,
                    status,
                    storage_location,
                    eta
                )
                VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT(station_id, item_key) DO NOTHING`,
                [
                    station.id,
                    category,
                    itemKey,
                    itemName,
                    unit,
                    capacity,
                    currentQuantity,
                    reorderThreshold,
                    status,
                    location,
                    eta
                ]
            );
        }
    }

    const users = [
        {
            username: 'station_commander',
            password: 'Commander@NCPOR2026',
            role: 'admin',
            station: null,
            question: 'Headquarters verification phrase?',
            answer: 'goa'
        },
        {
            username: 'dr_sharma',
            password: 'Bharati#Scientist2026',
            role: 'visiting_scientist',
            station: 'Bharati',
            question: 'Assigned research vessel?',
            answer: 'vasudha'
        },
        {
            username: 'dr_maitri_lead',
            password: 'Maitri#Scientist2026',
            role: 'visiting_scientist',
            station: 'Maitri',
            question: 'Assigned research vessel?',
            answer: 'akademik'
        }
    ];

    for (const u of users) {
        const stationId = u.station
            ? (
                await pool.query(
                    'SELECT id FROM stations WHERE name = $1',
                    [u.station]
                )
            ).rows[0].id
            : null;

        const passwordHash = await bcrypt.hash(u.password, 12);
        const answerHash = await bcrypt.hash(
            u.answer.trim().toLowerCase(),
            12
        );

        await pool.query(
            `INSERT INTO users(
                username,
                password_hash,
                role,
                station_id,
                security_question,
                security_answer_hash
            )
            VALUES($1, $2, $3, $4, $5, $6)
            ON CONFLICT(username) DO NOTHING`,
            [
                u.username,
                passwordHash,
                u.role,
                stationId,
                u.question,
                answerHash
            ]
        );
    }

    console.log(
        '[SEED] Demo stations, telemetry, logistics and accounts ready.'
    );
}

seed()
    .catch(err => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => setTimeout(() => pool.end(), 100));