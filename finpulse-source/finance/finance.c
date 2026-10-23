#include "finance.h"

#include <math.h>
#include <stddef.h>

static double positive(double value) {
    return value > 0.0 ? value : 0.0;
}

static double future_value(double monthly_payment, double annual_rate, int years) {
    const int months = years * 12;
    const double monthly_rate = annual_rate / 12.0;
    double value = 0.0;
    for (int month = 0; month < months; ++month) {
        value = (value + monthly_payment) * (1.0 + monthly_rate);
    }
    return value;
}

int calculate_finance(const FinanceInput *input, FinanceResult *result) {
    if (input == NULL || result == NULL || input->income <= 0.0 ||
        input->bills < 0.0 || input->daily_spend < 0.0 || input->emi < 0.0 ||
        input->savings < 0.0 || input->goal_target < 0.0 ||
        input->goal_current < 0.0 || input->goal_current > input->goal_target ||
        input->age < 18 || input->age > 100 || input->risk < 0 || input->risk > 2) {
        return -1;
    }

    const double monthly_outflow = input->bills + input->daily_spend + input->emi;
    const double safety_baseline = monthly_outflow > 0.0 ? monthly_outflow : input->income * 0.5;
    const double surplus = input->income - monthly_outflow;
    const double savings_rate = positive(surplus) / input->income * 100.0;
    const double dti = input->emi / input->income * 100.0;
    const double emergency_months = safety_baseline > 0.0 ? input->savings / safety_baseline : 0.0;

    double savings_points = 0.0;
    if (savings_rate >= 25.0) {
        savings_points = 35.0;
    } else if (savings_rate > 0.0) {
        savings_points = savings_rate / 25.0 * 35.0;
    }

    double dti_points = 0.0;
    if (dti <= 15.0) {
        dti_points = 35.0;
    } else if (dti < 50.0) {
        dti_points = (50.0 - dti) / 35.0 * 35.0;
    }
    const double emergency_points = fmin(emergency_months / 6.0, 1.0) * 30.0;

    result->surplus = surplus;
    result->savings_rate = savings_rate;
    result->dti = dti;
    result->emergency_months = emergency_months;
    result->emergency_target = safety_baseline * 6.0;
    result->goal_remaining = positive(input->goal_target - input->goal_current);
    result->health_score = (int)lround(savings_points + dti_points + emergency_points);

    if (surplus < 0.0) {
        result->advice_code = 1; /* cash-flow deficit */
    } else if (dti > 35.0) {
        result->advice_code = 2; /* high debt pressure */
    } else if (emergency_months < 3.0) {
        result->advice_code = 3; /* build a liquidity buffer */
    } else if (savings_rate < 20.0) {
        result->advice_code = 4; /* strengthen the savings rate */
    } else {
        result->advice_code = 5; /* balanced progress */
    }

    if (surplus <= 0.0) {
        result->equity_pct = 0.0;
        result->debt_pct = 0.0;
        result->liquid_pct = 0.0;
        result->gold_pct = 0.0;
    } else if (emergency_months < 3.0) {
        result->equity_pct = 20.0;
        result->debt_pct = 30.0;
        result->liquid_pct = 45.0;
        result->gold_pct = 5.0;
    } else if (emergency_months < 6.0) {
        result->equity_pct = 30.0 + (10.0 * input->risk);
        result->debt_pct = 35.0 - (5.0 * input->risk);
        result->liquid_pct = 25.0 - (5.0 * input->risk);
        result->gold_pct = 10.0;
    } else if (input->risk == 0) {
        result->equity_pct = 30.0;
        result->debt_pct = 40.0;
        result->liquid_pct = 20.0;
        result->gold_pct = 10.0;
    } else if (input->risk == 1) {
        result->equity_pct = 50.0;
        result->debt_pct = 20.0;
        result->liquid_pct = 20.0;
        result->gold_pct = 10.0;
    } else {
        result->equity_pct = 65.0;
        result->debt_pct = 15.0;
        result->liquid_pct = 10.0;
        result->gold_pct = 10.0;
    }

    double equity_ceiling = 100.0 - (double)input->age;
    if (input->risk == 0) {
        equity_ceiling -= 10.0;
    } else if (input->risk == 2) {
        equity_ceiling += 10.0;
    }
    equity_ceiling = fmax(10.0, fmin(equity_ceiling, 90.0));
    if (result->equity_pct > equity_ceiling) {
        result->debt_pct += result->equity_pct - equity_ceiling;
        result->equity_pct = equity_ceiling;
    }

    const double investable = positive(surplus);
    result->equity_amount = investable * result->equity_pct / 100.0;
    result->debt_amount = investable * result->debt_pct / 100.0;
    result->liquid_amount = investable * result->liquid_pct / 100.0;
    result->gold_amount = investable * result->gold_pct / 100.0;

    const double annual_return = input->risk == 0 ? 0.08 : (input->risk == 1 ? 0.12 : 0.15);
    const double monthly_investment = result->equity_amount + result->debt_amount;
    result->annual_return = annual_return * 100.0;
    result->ten_year_value = future_value(monthly_investment, annual_return, 10);
    result->twenty_year_value = future_value(monthly_investment, annual_return, 20);
    result->ten_year_invested = monthly_investment * 120.0;
    result->twenty_year_invested = monthly_investment * 240.0;
    return 0;
}
