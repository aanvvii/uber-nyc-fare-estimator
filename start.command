#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "== Uber NYC Fare Estimator setup =="
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install Python 3.11 or 3.12 and try again."
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. Install the current Node.js LTS release from https://nodejs.org, then run ./start.sh again."
  exit 1
fi

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate

echo "Installing Python dependencies..."
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo "Installing React dependencies..."
npm install

echo "Building React website..."
npm run build

echo "Starting website at http://127.0.0.1:8000"
echo "Keep this Terminal window open. Press Control+C to stop."
python -m uvicorn server:app --host 127.0.0.1 --port 8000
