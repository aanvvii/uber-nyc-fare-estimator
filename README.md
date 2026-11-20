# Uber NYC Fare Estimator — React + FastAPI

A polished, responsive React website connected to the trained HistGradientBoosting model from this project. The page keeps the product heading **Uber**, accepts a pickup, destination, date/time and passenger count, and returns one machine-learning fare estimate in USD.

> **Research / accuracy note:** The model was trained on a sample of the Kaggle *New York City Taxi Fare Prediction* dataset. That dataset contains historical NYC taxi fares; it is not an Uber-specific trip-pricing dataset. The app presents the result as an independent Uber-style estimate for the project, not an official Uber quote, live fare, or current price. The model is not calibrated for other cities.

## Requirements

- macOS (the steps below are for your MacBook)
- Python 3.11 or 3.12 recommended
- Node.js LTS with npm
- Internet connection for the first dependency installation

The included model was serialized with **scikit-learn 1.9.0**. `requirements.txt` pins that version because scikit-learn model files are not guaranteed to be compatible across versions.

## Run on macOS — easiest method

1. Extract `uber-nyc-react.zip`.
2. Open Terminal.
3. Type `cd ` (with a space after `cd`), drag the extracted `uber-nyc-react` folder into Terminal, and press Enter.
4. Run:

   ```bash
   chmod +x start.sh
   ./start.sh
   ```

5. The script creates a Python virtual environment, installs the Python and React dependencies, builds the React website, and starts FastAPI.
6. Open [**http://127.0.0.1:8000**](https://uber-nyc-fare-estimator.onrender.com) in Chrome or Safari.
7. Keep Terminal open while using the site. Press **Control + C** in Terminal to stop the server.

If macOS blocks `start.command`, use the Terminal instructions above instead.

## Manual setup (if you prefer)

From the extracted project folder:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
npm install
npm run build
python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

Then visit https://uber-nyc-fare-estimator.onrender.com

## React development mode

For editing the UI with Vite hot reload, open two Terminal tabs in the project folder.

**Terminal 1 — API:**

```bash
source .venv/bin/activate
python -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — React:**

```bash
npm run dev
```

Open [http://127.0.0.1:5173](https://uber-nyc-fare-estimator.onrender.com). Vite forwards `/api` requests to the FastAPI server on port 8000.

After UI changes, run `npm run build` before using the one-command production-style start script.

## How the app works

- React frontend: `frontend/src/main.jsx` and `frontend/src/styles.css`
- FastAPI backend: `server.py`
- Trained model: `ml/models_nyc_cleaned/best_nyc_fare_model.joblib`
- Evaluation report: `ml/models_nyc_cleaned/metrics.json`
- Prediction endpoint: `POST /api/predict`
- Health endpoint: `GET /api/health`
- Model information endpoint: `GET /api/model-info`

The backend recreates the 11 model features in the same order as training. User-entered New York local time is converted to UTC before extracting time features, matching the training pipeline's UTC timestamp handling. Distance is Haversine straight-line distance, not road distance.

## Locations and validation

The dropdown includes NYC-area landmarks and airports. You can also choose **Custom coordinates** and enter `latitude, longitude`.

The backend enforces the same broad geographic bounds and distance range used in training:
- Latitude: 40 to 42.5
- Longitude: -75 to -72
- Straight-line distance: 0.1 to 80 km
- Passenger count: 1 to 6

A location outside those training bounds will be rejected rather than given a misleading prediction.

## Model evaluation shown in the app

The saved hold-out test metrics are:
- MAE: $1.9181
- RMSE: $3.6350
- R²: 0.85569

These are aggregate test-set metrics, not a confidence interval for an individual ride.

## Important project limitations

1. The training target is historical NYC taxi `fare_amount`, not Uber's proprietary fare quote.
2. Prices are historical USD estimates, not current live Uber prices.
3. Haversine distance is straight-line distance; actual road distance and traffic are not modeled.
4. No Uber/Ola/Rapido comparison columns or fabricated provider rate cards are included.
5. The raw 5.3 GB Kaggle training CSV is not needed to run the website and is intentionally not included.
6. Do not describe the output as an official Uber fare or claim affiliation with Uber.

## Project structure

```text
uber-nyc-react/
├── frontend/
│   └── src/
│       ├── main.jsx
│       └── styles.css
├── ml/
│   └── models_nyc_cleaned/
│       ├── best_nyc_fare_model.joblib
│       └── metrics.json
├── server.py
├── requirements.txt
├── package.json
├── vite.config.js
├── index.html
├── start.sh
└── README.md
```
