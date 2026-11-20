\
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "ml" / "models_nyc_cleaned" / "best_nyc_fare_model.joblib"
METRICS_PATH = ROOT / "ml" / "models_nyc_cleaned" / "metrics.json"
DIST_DIR = ROOT / "dist"
NY_TZ = ZoneInfo("America/New_York")

# These bounds are the same geographic limits used by the training pipeline.
MIN_LON, MAX_LON, MIN_LAT, MAX_LAT = -75.0, -72.0, 40.0, 42.5
FEATURES = [
    "distance_km",
    "pickup_longitude",
    "pickup_latitude",
    "dropoff_longitude",
    "dropoff_latitude",
    "passenger_count",
    "pickup_hour",
    "pickup_dayofweek",
    "pickup_month",
    "is_weekend",
    "is_rush_hour",
]

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Trained model not found at {MODEL_PATH}. "
        "Keep the included ml/models_nyc_cleaned folder in the project."
    )

# The model was serialized with scikit-learn 1.9.0. Install the pinned
# requirements.txt version to avoid cross-version pickle incompatibilities.
model = joblib.load(MODEL_PATH)
metrics_report: dict[str, Any] = (
    json.loads(METRICS_PATH.read_text()) if METRICS_PATH.exists() else {}
)

app = FastAPI(
    title="Uber NYC Fare Estimator — academic prototype",
    description="Independent historical NYC taxi fare prediction API.",
    version="1.0.0",
)

class FareRequest(BaseModel):
    pickup_latitude: float = Field(..., ge=-90, le=90)
    pickup_longitude: float = Field(..., ge=-180, le=180)
    dropoff_latitude: float = Field(..., ge=-90, le=90)
    dropoff_longitude: float = Field(..., ge=-180, le=180)
    pickup_datetime: str
    passenger_count: int = Field(..., ge=1, le=6)

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * radius_km * math.asin(math.sqrt(min(1.0, max(0.0, a))))

def validate_nyc_coordinate(latitude: float, longitude: float, label: str) -> None:
    if not (MIN_LAT <= latitude <= MAX_LAT and MIN_LON <= longitude <= MAX_LON):
        raise HTTPException(
            status_code=422,
            detail=(
                f"{label} must be inside the model's NYC training area "
                "(latitude 40–42.5, longitude -75 to -72)."
            ),
        )

def parse_pickup_time(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid pickup date and time.") from exc
    # Browser sends a local datetime without an offset. Interpret it as New York
    # wall time, then convert to UTC because training timestamps were parsed UTC.
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=NY_TZ)
    return parsed.astimezone(timezone.utc)

@app.get("/api/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "model": "HistGradientBoosting",
        "geography": "NYC",
        "currency": "USD",
        "model_version": "1.9.0",
    }

@app.get("/api/model-info")
def model_info() -> dict[str, Any]:
    final = metrics_report.get("final_test_metrics", {})
    return {
        "model": metrics_report.get("best_model_by_3fold_CV_RMSE", "HistGradientBoosting"),
        "rows_after_cleaning": metrics_report.get("rows_after_cleaning"),
        "sample_size_requested": metrics_report.get("sample_size_requested"),
        "evaluation": {
            "mae_usd": final.get("MAE_USD"),
            "rmse_usd": final.get("RMSE_USD"),
            "r2": final.get("R2"),
        },
    }

@app.post("/api/predict")
def predict_fare(request: FareRequest) -> dict[str, Any]:
    validate_nyc_coordinate(request.pickup_latitude, request.pickup_longitude, "Pickup")
    validate_nyc_coordinate(request.dropoff_latitude, request.dropoff_longitude, "Drop-off")

    pickup_utc = parse_pickup_time(request.pickup_datetime)
    distance_km = haversine_km(
        request.pickup_latitude,
        request.pickup_longitude,
        request.dropoff_latitude,
        request.dropoff_longitude,
    )
    if not 0.1 <= distance_km <= 80:
        raise HTTPException(
            status_code=422,
            detail="Trip distance must be between 0.1 and 80 km for this model.",
        )

    hour = pickup_utc.hour
    row = {
        "distance_km": distance_km,
        "pickup_longitude": request.pickup_longitude,
        "pickup_latitude": request.pickup_latitude,
        "dropoff_longitude": request.dropoff_longitude,
        "dropoff_latitude": request.dropoff_latitude,
        "passenger_count": request.passenger_count,
        "pickup_hour": hour,
        "pickup_dayofweek": pickup_utc.weekday(),
        "pickup_month": pickup_utc.month,
        "is_weekend": int(pickup_utc.weekday() >= 5),
        "is_rush_hour": int(7 <= hour <= 10 or 16 <= hour <= 19),
    }
    features = pd.DataFrame([[row[name] for name in FEATURES]], columns=FEATURES)
    prediction = float(model.predict(features)[0])
    final = metrics_report.get("final_test_metrics", {})

    return {
        "predicted_fare_usd": round(max(0.0, prediction), 2),
        "distance_km": round(distance_km, 2),
        "passenger_count": request.passenger_count,
        "model": "HistGradientBoosting",
        "currency": "USD",
        "evaluation": {
            "mae_usd": final.get("MAE_USD"),
            "rmse_usd": final.get("RMSE_USD"),
            "r2": final.get("R2"),
        },
        "disclaimer": (
            "Independent estimate from a model trained on historical NYC taxi fares. "
            "It is not an official Uber quote, live price, or current fare guarantee."
        ),
    }

# In production/local one-command mode, FastAPI serves the compiled React app.
# During frontend development, Vite runs on port 5173 and proxies /api to this app.
if DIST_DIR.exists():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/{full_path:path}")
def serve_react(full_path: str):
    index_file = DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return JSONResponse(
        status_code=404,
        content={"detail": "React build not found. Run `npm run build` in the project folder."},
    )
