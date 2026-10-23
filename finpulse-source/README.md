# FinPulse Personal Finance Advisor

FinPulse is an English-language finance dashboard mini-project inspired by the supplied interactive advisor reference. Its web UI is built with Python and Flask. All budgeting, financial-health, emergency-fund, allocation, and compounding calculations are performed by a native C library and called from Python through `ctypes`.

## Run locally

Requirements: Python 3.10+, GCC, and Make.

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
make
python app.py
```

Open `http://localhost:3000`. The demo profiles are examples only. Use the input controls to model a different situation; the Python UI sends values to `/api/advice`, which validates inputs and calls `finance/libfinance.so`.

## Project layout

- `app.py` serves the dashboard and validated JSON API.
- `finance/finance.c` and `finance/finance.h` implement the C calculation engine.
- `templates/index.html`, `static/styles.css`, and `static/app.js` form the English UI and interactive charts.
- `Makefile` compiles the C shared library. `Dockerfile` builds the app and native library for container hosting.

## Calculation overview

Monthly surplus is income less bills, everyday spending, and debt payments. The dashboard also computes savings rate, debt-to-income, and emergency-fund coverage. C uses these indicators to create an illustrative 0–100 score and prioritizes deficit, elevated debt, low emergency cover, then savings improvement. Suggested allocation ranges vary by emergency savings, risk choice, and an age-adjusted equity ceiling. Projections use a fixed assumed annual return associated with the selected risk profile; they are scenarios, not forecasts or guarantees.

The project stores no accounts or financial records. It is an educational demonstration, not a substitute for a qualified financial professional, regulated advice, or a suitability assessment.
