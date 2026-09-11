const WebSocket = require('ws');

const PORT = 5001;

const wss = new WebSocket.Server({
  port: PORT
});

console.log(
  `[SEISMIC] Local seismic simulator running on ws://localhost:${PORT}`
);


const STATIONS = [
  {
    name: 'Bharati',
    latitude: -69.413,
    longitude: 76.190
  },
  {
    name: 'Maitri',
    latitude: -70.769,
    longitude: 11.733
  }
];


function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}


function randomInteger(min, max) {
  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;
}


/*
 * Creates a synthetic seismic waveform.
 *
 * The waveform contains:
 *
 * 1. Background noise
 * 2. P-wave arrival
 * 3. Stronger S-wave
 * 4. Signal decay
 */
function generateWaveform(
  magnitude,
  frequency
) {

  const samples = [];

  const totalSamples = 240;

  const pWaveIndex = 45;

  const sWaveIndex = 95;

  const amplitude =
    0.35 + magnitude * 0.18;

  for (
    let i = 0;
    i < totalSamples;
    i++
  ) {

    let value =
      (Math.random() - 0.5) * 0.12;


    /*
     * P-wave
     */

    if (i >= pWaveIndex) {

      const pProgress =
        i - pWaveIndex;

      const pEnvelope =
        Math.min(
          1,
          pProgress / 20
        );

      value +=
        Math.sin(
          pProgress * frequency * 0.16
        ) *
        amplitude *
        0.35 *
        pEnvelope;

    }


    /*
     * S-wave
     */

    if (i >= sWaveIndex) {

      const sProgress =
        i - sWaveIndex;

      const decay =
        Math.exp(
          -sProgress / 100
        );

      value +=
        Math.sin(
          sProgress * frequency * 0.28
        ) *
        amplitude *
        1.2 *
        decay;

    }


    samples.push(
      Number(value.toFixed(4))
    );

  }

  return {
    samples,
    pWaveIndex,
    sWaveIndex
  };
}


function generateEvent() {

  const station =
    STATIONS[
      randomInteger(
        0,
        STATIONS.length - 1
      )
    ];


  const magnitude =
    Number(
      randomBetween(2.5, 5.2)
        .toFixed(1)
    );


  const depth =
    Number(
      randomBetween(5, 45)
        .toFixed(1)
    );


  const frequency =
    Number(
      randomBetween(0.5, 8)
        .toFixed(2)
    );


  const amplitude =
    Number(
      randomBetween(0.4, 8)
        .toFixed(2)
    );


  const duration =
    Number(
      randomBetween(5, 35)
        .toFixed(1)
    );


  const waveform =
    generateWaveform(
      magnitude,
      frequency
    );


  return {

    id:
      `SEIS-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`,

    station:
      station.name,


    /*
     * Slight geographic variation around
     * the selected station.
     */

    latitude:
      Number(
        (
          station.latitude +
          randomBetween(-2.0, 2.0)
        ).toFixed(4)
      ),


    longitude:
      Number(
        (
          station.longitude +
          randomBetween(-3.0, 3.0)
        ).toFixed(4)
      ),


    magnitude,

    depth,

    amplitude,

    frequency,

    duration,

    timestamp:
      new Date().toISOString(),

    waveform:
      waveform.samples,

    pWaveIndex:
      waveform.pWaveIndex,

    sWaveIndex:
      waveform.sWaveIndex

  };
}


function broadcast(event) {

  const message =
    JSON.stringify({
      type: 'SEISMIC_EVENT',
      data: event
    });


  for (const client of wss.clients) {

    if (
      client.readyState ===
      WebSocket.OPEN
    ) {

      client.send(message);

    }

  }
}


/*
 * Generate the first event shortly after
 * the simulator starts.
 */

setTimeout(() => {

  const event =
    generateEvent();

  console.log(
    '[SEISMIC EVENT]',
    event.station,
    `M${event.magnitude}`,
    `${event.depth}km`
  );

  broadcast(event);

}, 3000);


/*
 * Generate a new event every 10 seconds.
 */

setInterval(() => {

  const event =
    generateEvent();

  console.log(
    '[SEISMIC EVENT]',
    event.station,
    `M${event.magnitude}`,
    `${event.depth}km`
  );

  broadcast(event);

}, 10000);