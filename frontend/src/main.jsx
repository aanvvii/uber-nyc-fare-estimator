import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown, ArrowLeftRight, ArrowUpRight, BadgeCheck, CalendarDays,
  CarFront, Check, ChevronDown, Clock3, Compass, MapPin, Navigation,
  Plane, Route, ShieldCheck, Sparkles, Users, Zap
} from "lucide-react";
import "./styles.css";

const PLACES = {
  "Times Square": [40.7580, -73.9855],
  "Central Park": [40.7829, -73.9654],
  "Grand Central Terminal": [40.7527, -73.9772],
  "Empire State Building": [40.7484, -73.9857],
  "One World Trade Center": [40.7127, -74.0134],
  "Brooklyn Bridge": [40.7061, -73.9969],
  "Penn Station": [40.7506, -73.9935],
  "Wall Street": [40.7074, -74.0113],
  "JFK Airport": [40.6413, -73.7781],
  "LaGuardia Airport": [40.7769, -73.8740],
  "Williamsburg": [40.7081, -73.9571],
  "DUMBO": [40.7033, -73.9881],
  "Chelsea Market": [40.7424, -74.0061],
  "Columbia University": [40.8075, -73.9626],
  "Newark Airport": [40.6895, -74.1745],
};
const DEFAULT_PICKUP = "Times Square";
const DEFAULT_DROPOFF = "JFK Airport";

function FieldLabel({ icon: Icon, children }) {
  return <div className="field-label"><Icon size={14} strokeWidth={2.2}/><span>{children}</span></div>;
}
function LocationSelect({ label, value, onChange, kind }) {
  return (
    <label className="location-field">
      <FieldLabel icon={MapPin}>{label}</FieldLabel>
      <div className="select-wrap">
        <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
          {Object.keys(PLACES).map(name => <option key={name}>{name}</option>)}
          <option value="Custom coordinates">Custom coordinates</option>
        </select>
        <ChevronDown size={17} className="select-chevron"/>
      </div>
      <span className={`location-dot ${kind}`} />
    </label>
  );
}

function RouteArtwork({ pickup, dropoff }) {
  return (
    <div className="map-art" aria-label="Schematic route preview">
      <div className="map-grid" />
      <svg className="map-lines" viewBox="0 0 540 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M-20 70 C75 28 115 115 190 84 S315 25 380 78 S485 125 570 76" />
        <path d="M-20 145 C70 112 120 190 200 150 S340 115 405 165 S495 210 570 170" />
        <path d="M-20 230 C65 195 125 260 210 225 S340 205 420 245 S500 280 570 245" />
        <path d="M70 -20 C45 70 105 120 85 190 S65 275 95 350" />
        <path d="M205 -20 C180 65 230 120 210 190 S200 275 225 350" />
        <path d="M350 -20 C320 65 375 120 350 190 S340 275 370 350" />
        <path d="M475 -20 C450 65 500 120 480 190 S465 275 495 350" />
        <path className="waterway" d="M430 -10 C385 70 470 120 425 190 S405 275 445 340" />
        <path className="route-line" d="M132 225 C172 194 190 165 244 160 S325 148 374 90" />
      </svg>
      <div className="map-label label-a"><span className="map-pin start-pin"><span/></span><div><small>PICKUP</small><b>{pickup}</b></div></div>
      <div className="map-label label-b"><span className="map-pin end-pin"><span/></span><div><small>DROP-OFF</small><b>{dropoff}</b></div></div>
      <div className="map-caption"><span className="live-dot"/> NEW YORK CITY <span>·</span> ROUTE PREVIEW</div>
      <div className="map-scale">SCHEMATIC MAP</div>
    </div>
  );
}

function App() {
  const [pickup, setPickup] = useState(DEFAULT_PICKUP);
  const [dropoff, setDropoff] = useState(DEFAULT_DROPOFF);
  const [pickupCustom, setPickupCustom] = useState("40.7580, -73.9855");
  const [dropoffCustom, setDropoffCustom] = useState("40.6413, -73.7781");
  const [dateTime, setDateTime] = useState(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  });
  const [passengers, setPassengers] = useState("1");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const pickupCoords = useMemo(() => pickup === "Custom coordinates" ? parseCoords(pickupCustom) : PLACES[pickup], [pickup, pickupCustom]);
  const dropoffCoords = useMemo(() => dropoff === "Custom coordinates" ? parseCoords(dropoffCustom) : PLACES[dropoff], [dropoff, dropoffCustom]);

  function swapLocations() {
    if (pickup === "Custom coordinates" || dropoff === "Custom coordinates") {
      const oldPickup = pickupCustom;
      setPickupCustom(dropoffCustom);
      setDropoffCustom(oldPickup);
    }
    setPickup(dropoff); setDropoff(pickup); setResult(null);
  }

  async function estimate() {
    setError(""); setResult(null);
    if (!pickupCoords || !dropoffCoords) { setError("Enter coordinates as latitude, longitude (for example 40.7580, -73.9855)."); return; }
    if (!dateTime) { setError("Choose a pickup date and time."); return; }
    if (pickup === dropoff && pickup !== "Custom coordinates") { setError("Choose two different locations."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_latitude: pickupCoords[0], pickup_longitude: pickupCoords[1],
          dropoff_latitude: dropoffCoords[0], dropoff_longitude: dropoffCoords[1],
          pickup_datetime: dateTime, passenger_count: Number(passengers)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "We couldn't estimate this trip. Check your locations and try again.");
      setResult(data);
      setTimeout(() => document.getElementById("estimate-result")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    } catch (e) {
      setError(e.message || "Unable to connect to the prediction service. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Uber fare estimator home"><span className="brand-word">Uber</span><span className="brand-divider"/><span className="brand-product">Fare estimator</span></a>
        <div className="topbar-right"><span className="market-pill"><span className="live-dot"/> NYC · USD</span><a className="top-link" href="#how-it-works">How it works <ArrowUpRight size={14}/></a></div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={13}/> YOUR NEXT RIDE, ESTIMATED</div>
            <h1>Know your fare<br/><span>before you go.</span></h1>
            <p className="hero-description">A smarter way to estimate your Uber-style trip across New York City, powered by machine learning.</p>
            <div className="hero-proof">
              <span><BadgeCheck size={15}/> ML-powered estimate</span>
              <span><ShieldCheck size={15}/> Transparent methodology</span>
            </div>
          </div>
          <div className="hero-visual">
            <RouteArtwork pickup={pickup === "Custom coordinates" ? "Custom pickup" : pickup} dropoff={dropoff === "Custom coordinates" ? "Custom drop-off" : dropoff}/>
            <div className="visual-foot"><span>PLAN WITH CLARITY</span><span>01 — 02</span></div>
          </div>
        </section>

        <section className="planner-card" aria-labelledby="planner-title">
          <div className="planner-heading">
            <div><div className="section-kicker">TRIP DETAILS</div><h2 id="planner-title">Where are you headed?</h2><p>Enter your pickup and destination to get an estimated fare.</p></div>
            <div className="step-indicator"><span>01</span><i/> TRIP PLANNER</div>
          </div>

          <div className="route-inputs">
            <div className="route-rail"><span className="rail-dot pickup-rail"/><span className="rail-line"/><span className="rail-dot drop-rail"/></div>
            <div className="route-fields">
              <LocationSelect label="PICKUP LOCATION" value={pickup} onChange={v => {setPickup(v);setResult(null);}} kind="pickup"/>
              <LocationSelect label="DROP-OFF LOCATION" value={dropoff} onChange={v => {setDropoff(v);setResult(null);}} kind="drop"/>
            </div>
            <button className="swap-button" type="button" onClick={swapLocations} title="Swap pickup and drop-off"><ArrowLeftRight size={17}/></button>
          </div>

          {(pickup === "Custom coordinates" || dropoff === "Custom coordinates") && (
            <div className="custom-grid">
              {pickup === "Custom coordinates" && <label className="custom-field">Pickup coordinates <input value={pickupCustom} onChange={e=>setPickupCustom(e.target.value)} placeholder="40.7580, -73.9855"/></label>}
              {dropoff === "Custom coordinates" && <label className="custom-field">Drop-off coordinates <input value={dropoffCustom} onChange={e=>setDropoffCustom(e.target.value)} placeholder="40.6413, -73.7781"/></label>}
              <p className="custom-hint">Use latitude, longitude within the model's NYC training area.</p>
            </div>
          )}

          <div className="form-divider"/>
          <div className="trip-options">
            <label className="option-field"><FieldLabel icon={CalendarDays}>PICKUP DATE & TIME</FieldLabel><input type="datetime-local" value={dateTime} onChange={e=>{setDateTime(e.target.value);setResult(null);}}/></label>
            <label className="option-field"><FieldLabel icon={Users}>PASSENGERS</FieldLabel><div className="select-wrap"><select value={passengers} onChange={e=>setPassengers(e.target.value)}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n} {n===1?"passenger":"passengers"}</option>)}</select><ChevronDown size={17} className="select-chevron"/></div></label>
            <div className="submit-wrap"><button className="estimate-button" onClick={estimate} disabled={loading}>{loading ? <><span className="spinner"/> Calculating estimate</> : <>Estimate fare <ArrowUpRight size={17}/></>}</button><span className="secure-note"><ShieldCheck size={12}/> No account needed</span></div>
          </div>
          {error && <div className="error-banner" role="alert">{error}</div>}
        </section>

        {result && (
          <section className="result-section" id="estimate-result">
            <div className="result-topline"><div><div className="section-kicker">YOUR ESTIMATE</div><h2>Here's your ride snapshot.</h2></div><span className="estimate-status"><span className="live-dot"/> ESTIMATE READY</span></div>
            <div className="result-grid">
              <div className="fare-card">
                <div className="fare-card-top"><span className="fare-icon"><CarFront size={19}/></span><span className="fare-label">ESTIMATED UBER FARE</span><span className="fare-badge">ML PREDICTION</span></div>
                <div className="fare-amount">{new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(result.predicted_fare_usd)}</div>
                <div className="fare-caption">Historical NYC fare estimate <span>·</span> USD</div>
                <div className="fare-rule"/>
                <div className="fare-metrics"><div><span>STRAIGHT-LINE DISTANCE</span><b>{result.distance_km.toFixed(2)} <small>km</small></b></div><div><span>PASSENGERS</span><b>{result.passenger_count}</b></div></div>
                <p className="fare-disclaimer">This is an independent project estimate, not an official Uber quote or guaranteed current price.</p>
              </div>
              <div className="details-card">
                <div className="details-title"><div><div className="section-kicker">YOUR JOURNEY</div><h3>Trip overview</h3></div><span className="details-icon"><Route size={18}/></span></div>
                <div className="journey-stop"><span className="journey-marker pickup-marker"/><div><small>PICKUP</small><b>{pickup}</b></div></div>
                <div className="journey-connector"><span/>{result.distance_km.toFixed(2)} km straight-line</div>
                <div className="journey-stop"><span className="journey-marker drop-marker"/><div><small>DROP-OFF</small><b>{dropoff}</b></div></div>
                <div className="details-bottom"><span><CalendarDays size={14}/>{formatDate(dateTime)}</span><span><Clock3 size={14}/>New York local time</span></div>
              </div>
            </div>
          </section>
        )}

        <section className="trust-strip" id="how-it-works">
          <div className="trust-icon"><Zap size={17}/></div><div><b>Built with machine learning</b><span>Predictions are generated by your trained HistGradientBoosting model.</span></div>
          <div className="trust-separator"/>
          <div className="trust-icon muted-icon"><Compass size={17}/></div><div><b>Clear about the data</b><span>Trained on historical NYC taxi fares, not live Uber trip quotes.</span></div>
        </section>

        <footer className="footer">
          <a className="footer-brand" href="#">Uber<span>.</span></a>
          <span>Independent academic prototype · Not affiliated with Uber Technologies, Inc.</span>
          <span>NYC · USD</span>
        </footer>
      </main>
    </div>
  );
}

function parseCoords(value) {
  const parts = value.split(",").map(Number);
  return parts.length === 2 && parts.every(Number.isFinite) ? parts : null;
}
function formatDate(value) {
  if (!value) return "";
  const [date, time] = value.split("T");
  const [y,m,d] = date.split("-");
  return `${m}/${d}/${y} · ${time}`;
}

createRoot(document.getElementById("root")).render(<App />);
