"""FinPulse: English finance dashboard backed by a native C calculation engine."""

from __future__ import annotations

import ctypes
import math
import os
import subprocess
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request, send_from_directory

ROOT = Path(__file__).resolve().parent
LIBRARY = ROOT / "finance" / "libfinance.so"


class FinanceInput(ctypes.Structure):
    _fields_ = [
        ("income", ctypes.c_double),
        ("bills", ctypes.c_double),
        ("daily_spend", ctypes.c_double),
        ("emi", ctypes.c_double),
        ("savings", ctypes.c_double),
        ("goal_target", ctypes.c_double),
        ("goal_current", ctypes.c_double),
        ("age", ctypes.c_int),
        ("risk", ctypes.c_int),
    ]


class FinanceResult(ctypes.Structure):
    _fields_ = [
        ("surplus", ctypes.c_double),
        ("savings_rate", ctypes.c_double),
        ("dti", ctypes.c_double),
        ("emergency_months", ctypes.c_double),
        ("emergency_target", ctypes.c_double),
        ("goal_remaining", ctypes.c_double),
        ("equity_pct", ctypes.c_double),
        ("debt_pct", ctypes.c_double),
        ("liquid_pct", ctypes.c_double),
        ("gold_pct", ctypes.c_double),
        ("equity_amount", ctypes.c_double),
        ("debt_amount", ctypes.c_double),
        ("liquid_amount", ctypes.c_double),
        ("gold_amount", ctypes.c_double),
        ("ten_year_value", ctypes.c_double),
        ("twenty_year_value", ctypes.c_double),
        ("ten_year_invested", ctypes.c_double),
        ("twenty_year_invested", ctypes.c_double),
        ("annual_return", ctypes.c_double),
        ("health_score", ctypes.c_int),
        ("advice_code", ctypes.c_int),
    ]


def load_engine() -> ctypes.CDLL:
    if not LIBRARY.exists():
        subprocess.run(["make", "finance/libfinance.so"], cwd=ROOT, check=True)
    engine = ctypes.CDLL(str(LIBRARY))
    engine.calculate_finance.argtypes = [ctypes.POINTER(FinanceInput), ctypes.POINTER(FinanceResult)]
    engine.calculate_finance.restype = ctypes.c_int
    return engine


ENGINE = load_engine()
app = Flask(__name__)

RISK_NAMES = {0: "Conservative", 1: "Moderate", 2: "Growth-focused"}
ADVICE = {
    1: (
        "Reset the monthly cash flow",
        "Your current outflow is higher than your income. Pause new investing, review flexible spending, and bring essential bills and debt payments below your monthly income first.",
        "Cash flow needs attention",
    ),
    2: (
        "Give debt more breathing room",
        "Debt payments are above the 35% guide. Prioritize high-interest balances and avoid adding a new EMI until the monthly debt load comes down.",
        "Debt pressure is elevated",
    ),
    3: (
        "Build your safety buffer first",
        "Your emergency savings cover less than three months of current outflow. Direct a larger share of any monthly surplus to accessible savings before taking on more investment risk.",
        "Strengthen your emergency fund",
    ),
    4: (
        "Create a little more monthly margin",
        "Your current savings rate is below 20%. Look for one recurring cost to reduce, then route the difference to your savings goal automatically.",
        "Room to improve your savings rate",
    ),
    5: (
        "Keep your plan in motion",
        "Your cash flow is positive and your core safety checks are on track. Keep contributions consistent and review the plan when your income, goals, or major expenses change.",
        "Your plan is moving steadily",
    ),
}

LIMITS = {
    "income": (1, 5_000_000),
    "bills": (0, 20_000_000),
    "daily_spend": (0, 20_000_000),
    "emi": (0, 20_000_000),
    "savings": (0, 100_000_000),
    "goal_target": (0, 100_000_000),
    "goal_current": (0, 100_000_000),
    "age": (18, 100),
    "risk": (0, 2),
}


def round_value(value: float) -> float:
    return round(float(value), 2)


def parse_input(payload: Any) -> tuple[FinanceInput | None, dict[str, str]]:
    errors: dict[str, str] = {}
    if not isinstance(payload, dict):
        return None, {"form": "Send the financial inputs as a JSON object."}

    values: dict[str, float | int] = {}
    for name, (minimum, maximum) in LIMITS.items():
        raw = payload.get(name)
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            errors[name] = "Enter a valid number."
            continue
        value = float(raw)
        if not math.isfinite(value):
            errors[name] = "Enter a finite number."
            continue
        if value < minimum or value > maximum:
            errors[name] = f"Enter a value from {minimum:,} to {maximum:,}."
            continue
        if name in ("age", "risk") and not value.is_integer():
            errors[name] = "Choose a whole-number option."
            continue
        values[name] = int(value) if name in ("age", "risk") else value

    if not errors and values["goal_current"] > values["goal_target"]:
        errors["goal_current"] = "Current saved progress cannot exceed the goal target."

    if errors:
        return None, errors

    return FinanceInput(
        values["income"], values["bills"], values["daily_spend"], values["emi"],
        values["savings"], values["goal_target"], values["goal_current"],
        values["age"], values["risk"],
    ), {}


def calculate(payload: Any) -> tuple[dict[str, Any] | None, dict[str, str]]:
    finance_input, errors = parse_input(payload)
    if finance_input is None:
        return None, errors

    output = FinanceResult()
    if ENGINE.calculate_finance(ctypes.byref(finance_input), ctypes.byref(output)) != 0:
        return None, {"form": "These values could not be calculated. Review the inputs and try again."}

    advice_title, advice_text, advice_status = ADVICE[output.advice_code]
    monthly_outflow = finance_input.bills + finance_input.daily_spend + finance_input.emi
    income = finance_input.income
    progress = (finance_input.goal_current / finance_input.goal_target * 100.0) if finance_input.goal_target else 0.0
    contribution = max(output.surplus, 0.0) * 0.25
    months_to_goal = math.ceil(output.goal_remaining / contribution) if contribution > 0 and output.goal_remaining > 0 else (0 if output.goal_remaining == 0 else None)

    result = {
        "score": int(output.health_score),
        "score_label": "Excellent" if output.health_score >= 85 else "On track" if output.health_score >= 70 else "Building" if output.health_score >= 50 else "Needs attention",
        "surplus": round_value(output.surplus),
        "savings_rate": round_value(output.savings_rate),
        "dti": round_value(output.dti),
        "dti_status": "Within guide" if output.dti <= 35 else "Above guide",
        "emergency_months": round_value(output.emergency_months),
        "emergency_target": round_value(output.emergency_target),
        "emergency_gap": round_value(max(output.emergency_target - finance_input.savings, 0.0)),
        "outflow": round_value(monthly_outflow),
        "risk_name": RISK_NAMES[finance_input.risk],
        "advice_title": advice_title,
        "advice": advice_text,
        "advice_status": advice_status,
        "allocation": [
            {"key": "equity", "label": "Equity & index funds", "short_label": "Equity", "pct": round_value(output.equity_pct), "amount": round_value(output.equity_amount), "detail": "Long-term growth"},
            {"key": "debt", "label": "Debt & fixed income", "short_label": "Debt", "pct": round_value(output.debt_pct), "amount": round_value(output.debt_amount), "detail": "Steady balance"},
            {"key": "liquid", "label": "Emergency reserve", "short_label": "Liquid", "pct": round_value(output.liquid_pct), "amount": round_value(output.liquid_amount), "detail": "Accessible savings"},
            {"key": "gold", "label": "Gold & diversifiers", "short_label": "Gold", "pct": round_value(output.gold_pct), "amount": round_value(output.gold_amount), "detail": "Portfolio balance"},
        ],
        "goal": {
            "target": round_value(finance_input.goal_target),
            "current": round_value(finance_input.goal_current),
            "remaining": round_value(output.goal_remaining),
            "progress": round_value(progress),
            "months_to_goal": months_to_goal,
            "monthly_contribution": round_value(contribution),
        },
        "breakdown": [
            {"key": "bills", "label": "Bills & essentials", "amount": round_value(finance_input.bills), "share": round_value(finance_input.bills / income * 100.0)},
            {"key": "spending", "label": "Everyday spending", "amount": round_value(finance_input.daily_spend), "share": round_value(finance_input.daily_spend / income * 100.0)},
            {"key": "debt", "label": "Debt payments", "amount": round_value(finance_input.emi), "share": round_value(finance_input.emi / income * 100.0)},
            {"key": "surplus", "label": "Available surplus", "amount": round_value(max(output.surplus, 0.0)), "share": round_value(max(output.surplus, 0.0) / income * 100.0)},
        ],
        "projection": {
            "annual_return": round_value(output.annual_return),
            "monthly_investment": round_value(output.equity_amount + output.debt_amount),
            "ten_year_value": round_value(output.ten_year_value),
            "twenty_year_value": round_value(output.twenty_year_value),
            "ten_year_invested": round_value(output.ten_year_invested),
            "twenty_year_invested": round_value(output.twenty_year_invested),
        },
    }
    return result, {}


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/manus-routes.json")
def route_manifest():
    return send_from_directory(ROOT / "public", "manus-routes.json", mimetype="application/json")


@app.get("/health")
def health():
    return jsonify({"status": "ok", "engine": "C"})


@app.post("/api/advice")
def advice_api():
    result, errors = calculate(request.get_json(silent=True))
    if errors:
        return jsonify({"errors": errors}), 400
    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "3000")), debug=False)
