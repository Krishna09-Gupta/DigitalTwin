import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Marker
} from 'react-leaflet';

const SEISMIC_WS_URL =
  import.meta.env.VITE_SEISMIC_WS_URL ||
  'ws://localhost:5001';

const BHARATI = [-69.413, 76.190];
const MAITRI = [-70.769, 11.733];

function magnitudeRadius(magnitude) {
  const value = Number(magnitude) || 0;
  return Math.max(5, Math.min(18, value * 3));
}

function formatTime(timestamp) {
  if (!timestamp) return '--';

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatNumber(value, digits = 2) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(digits)
    : '--';
}

function Waveform({ samples = [], pIndex, sIndex }) {
  const points = useMemo(() => {
    if (!samples.length) return '';

    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const range = max - min || 1;

    return samples
      .map((value, index) => {
        const x =
          (index / Math.max(samples.length - 1, 1)) * 100;

        const normalized =
          (Number(value) - min) / range;

        const y = 88 - normalized * 70;

        return `${x},${y}`;
      })
      .join(' ');
  }, [samples]);

  const pPosition =
    samples.length && Number.isFinite(pIndex)
      ? (pIndex / Math.max(samples.length - 1, 1)) * 100
      : null;

  const sPosition =
    samples.length && Number.isFinite(sIndex)
      ? (sIndex / Math.max(samples.length - 1, 1)) * 100
      : null;

  return (
    <div className="seismic-waveform">

      <div className="wave-grid"></div>

      {pPosition !== null && (
        <div
          className="wave-marker p-wave"
          style={{ left: `${pPosition}%` }}
        >
          <span>P</span>
        </div>
      )}

      {sPosition !== null && (
        <div
          className="wave-marker s-wave"
          style={{ left: `${sPosition}%` }}
        >
          <span>S</span>
        </div>
      )}

      {samples.length ? (
        <svg
          className="wave-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polyline points={points} />
        </svg>
      ) : (
        <div className="wave-empty">
          WAITING FOR SEISMIC SIGNAL
        </div>
      )}

      <div className="wave-axis">
        <span>0s</span>
        <span>TIME</span>
        <span>LIVE</span>
      </div>

    </div>
  );
}

export default function SeismicObservatory() {

  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {

    let socket;

    try {
      socket = new WebSocket(SEISMIC_WS_URL);

      socket.onopen = () => {
        console.log('[SEISMIC] Connected');
        setConnected(true);
        setConnectionError('');
      };

      socket.onclose = () => {
        console.log('[SEISMIC] Disconnected');
        setConnected(false);
      };

      socket.onerror = () => {
        console.error('[SEISMIC] WebSocket error');
        setConnectionError(
          'Seismic simulator is offline.'
        );
      };

      socket.onmessage = message => {

        try {

          const packet =
            JSON.parse(message.data);

          if (packet.type !== 'SEISMIC_EVENT') {
            return;
          }

          const event = packet.data;

          setEvents(previous => {

            const updated = [
              event,
              ...previous
            ];

            return updated.slice(0, 30);
          });

          setSelectedEvent(event);

        } catch (error) {

          console.error(
            '[SEISMIC] Invalid message',
            error
          );

        }

      };

    } catch (error) {

      console.error(
        '[SEISMIC] Connection failed',
        error
      );

      setConnectionError(
        'Unable to connect to seismic simulator.'
      );

    }

    return () => {

      if (socket) {
        socket.close();
      }

    };

  }, []);

  const latestMagnitude =
    events.length
      ? Number(events[0].magnitude)
      : null;

  const strongestEvent = useMemo(() => {

    if (!events.length) {
      return null;
    }

    return events.reduce(
      (strongest, event) => {

        if (!strongest) {
          return event;
        }

        return Number(event.magnitude) >
          Number(strongest.magnitude)
          ? event
          : strongest;

      },
      null
    );

  }, [events]);

  return (

    <section className="seismic-page">

      {/* HEADER */}

      <div className="seismic-page-header">

        <div>

          <div className="eyebrow">
            
          </div>

          <h2>
            Seismic Observatory
          </h2>

          <p>
            Real-time seismic situational awareness
            for Antarctic research stations.
          </p>

        </div>

        <div className="seismic-live-status">

          <span
            className={
              connected
                ? 'seismic-status-dot online'
                : 'seismic-status-dot'
            }
          />

          {connected
            ? 'SIMULATOR ONLINE'
            : 'SIMULATOR OFFLINE'}

        </div>

      </div>


      {/* KPI CARDS */}

      <section className="seismic-kpi-grid">

        <div className="seismic-stat-card">

          <span>EVENTS DETECTED</span>

          <strong>
            {events.length}
          </strong>

          <small>
            Current session
          </small>

        </div>


        <div className="seismic-stat-card">

          <span>LATEST MAGNITUDE</span>

          <strong>
            {latestMagnitude !== null
              ? `M ${formatNumber(latestMagnitude, 1)}`
              : '--'}
          </strong>

          <small>
            Most recent event
          </small>

        </div>


        <div className="seismic-stat-card">

          <span>STRONGEST EVENT</span>

          <strong>
            {strongestEvent
              ? `M ${formatNumber(
                  strongestEvent.magnitude,
                  1
                )}`
              : '--'}
          </strong>

          <small>
            Session maximum
          </small>

        </div>


        <div className="seismic-stat-card">

          <span>MONITORED STATIONS</span>

          <strong>
            02
          </strong>

          <small>
            Bharati / Maitri
          </small>

        </div>

      </section>


      {/* ERROR / OFFLINE MESSAGE */}

      {connectionError && (

        <div className="seismic-warning">
          <strong>SEISMIC LINK:</strong>
          {' '}
          {connectionError}
          {' '}
          Start
          {' '}
          <code>node seismicSimulator.js</code>
          {' '}
          from the backend directory.
        </div>

      )}


      {/* MAIN MAP + EVENT */}

      <section className="seismic-main-grid">


        {/* MAP */}

        <div className="seismic-panel">

          <div className="seismic-panel-header">

            <div>

              <div className="panel-title">
                ANTARCTIC SEISMIC ACTIVITY
              </div>

              <div className="panel-sub">
                Live event distribution
              </div>

            </div>

            <span className="seismic-feed-badge">
              LOCAL FEED
            </span>

          </div>


          <div className="seismic-map-wrapper">

            <MapContainer
              center={[-70, 40]}
              zoom={3}
              minZoom={2}
              maxZoom={7}
              scrollWheelZoom={true}
              className="seismic-map"
            >

              <TileLayer
                attribution="© OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />


              {/* BHARATI */}

              <CircleMarker
                center={BHARATI}
                radius={8}
              >
                <Popup>
                  <strong>BHARATI</strong>
                  <br />
                  Antarctic Research Station
                </Popup>
              </CircleMarker>


              {/* MAITRI */}

              <CircleMarker
                center={MAITRI}
                radius={8}
              >
                <Popup>
                  <strong>MAITRI</strong>
                  <br />
                  Antarctic Research Station
                </Popup>
              </CircleMarker>


              {/* EVENTS */}

              {events.map(event => (

                <CircleMarker
                  key={event.id}
                  center={[
                    Number(event.latitude),
                    Number(event.longitude)
                  ]}
                  radius={magnitudeRadius(
                    event.magnitude
                  )}
                  className="seismic-event-marker"
                  eventHandlers={{
                    click: () =>
                      setSelectedEvent(event)
                  }}
                >

                  <Popup>

                    <strong>
                      M {formatNumber(
                        event.magnitude,
                        1
                      )}
                    </strong>

                    <br />

                    Station:
                    {' '}
                    {event.station}

                    <br />

                    Depth:
                    {' '}
                    {formatNumber(
                      event.depth,
                      1
                    )}
                    km

                  </Popup>

                </CircleMarker>

              ))}

            </MapContainer>

          </div>

        </div>


        {/* EVENT DETAILS */}

        <div className="seismic-panel">

          <div className="seismic-panel-header">

            <div>

              <div className="panel-title">
                SELECTED EVENT
              </div>

              <div className="panel-sub">
                Seismic event intelligence
              </div>

            </div>

          </div>


          {selectedEvent ? (

            <div className="selected-seismic-event">

              <div className="seismic-magnitude">
                M {formatNumber(
                  selectedEvent.magnitude,
                  1
                )}
              </div>

              <div className="event-station">
                {selectedEvent.station}
              </div>


              <div className="seismic-detail-grid">

                <div>
                  <span>DEPTH</span>
                  <strong>
                    {formatNumber(
                      selectedEvent.depth,
                      1
                    )}
                    {' '}km
                  </strong>
                </div>

                <div>
                  <span>AMPLITUDE</span>
                  <strong>
                    {formatNumber(
                      selectedEvent.amplitude,
                      2
                    )}
                  </strong>
                </div>

                <div>
                  <span>FREQUENCY</span>
                  <strong>
                    {formatNumber(
                      selectedEvent.frequency,
                      2
                    )}
                    {' '}Hz
                  </strong>
                </div>

                <div>
                  <span>DURATION</span>
                  <strong>
                    {formatNumber(
                      selectedEvent.duration,
                      1
                    )}
                    {' '}s
                  </strong>
                </div>

                <div>
                  <span>LATITUDE</span>
                  <strong>
                    {formatNumber(
                      selectedEvent.latitude,
                      4
                    )}
                  </strong>
                </div>

                <div>
                  <span>LONGITUDE</span>
                  <strong>
                    {formatNumber(
                      selectedEvent.longitude,
                      4
                    )}
                  </strong>
                </div>

              </div>


              <div className="event-time-block">

                <span>EVENT TIME</span>

                <strong>
                  {formatTime(
                    selectedEvent.timestamp
                  )}
                </strong>

              </div>

            </div>

          ) : (

            <div className="seismic-empty">
              Waiting for seismic event...
            </div>

          )}

        </div>

      </section>


      {/* WAVEFORM */}

      <section className="seismic-panel seismic-wave-panel">

        <div className="seismic-panel-header">

          <div>

            <div className="panel-title">
              LIVE SEISMOGRAPH
            </div>

            <div className="panel-sub">
              Simulated ground-motion waveform
            </div>

          </div>

          {selectedEvent && (

            <span className="wave-legend">

              <span>
                P
              </span>

              Primary wave

              <span>
                S
              </span>

              Secondary wave

            </span>

          )}

        </div>

        <Waveform
          samples={
            selectedEvent?.waveform || []
          }
          pIndex={
            selectedEvent?.pWaveIndex
          }
          sIndex={
            selectedEvent?.sWaveIndex
          }
        />

      </section>


      {/* EVENT TIMELINE */}

      <section className="seismic-panel">

        <div className="seismic-panel-header">

          <div>

            <div className="panel-title">
              RECENT SEISMIC EVENTS
            </div>

            <div className="panel-sub">
              Latest simulator observations
            </div>

          </div>

          <span className="seismic-count">
            {events.length} EVENTS
          </span>

        </div>


        <div className="seismic-event-table">

          {events.length === 0 ? (

            <div className="seismic-empty">
              No seismic events received yet.
            </div>

          ) : (

            events.map(event => (

              <button
                key={event.id}
                className={
                  selectedEvent?.id === event.id
                    ? 'seismic-event-row selected'
                    : 'seismic-event-row'
                }
                onClick={() =>
                  setSelectedEvent(event)
                }
              >

                <span className="event-mag">
                  M {formatNumber(
                    event.magnitude,
                    1
                  )}
                </span>

                <span>
                  {event.station}
                </span>

                <span>
                  {formatNumber(
                    event.depth,
                    1
                  )}
                  km
                </span>

                <span>
                  {formatNumber(
                    event.frequency,
                    2
                  )}
                  Hz
                </span>

                <span>
                  {formatTime(
                    event.timestamp
                  )}
                </span>

              </button>

            ))

          )}

        </div>

      </section>

    </section>
  );
}