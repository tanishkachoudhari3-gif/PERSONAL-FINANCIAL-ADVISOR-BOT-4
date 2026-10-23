#ifndef FINPULSE_FINANCE_H
#define FINPULSE_FINANCE_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    double income;
    double bills;
    double daily_spend;
    double emi;
    double savings;
    double goal_target;
    double goal_current;
    int age;
    int risk; /* 0 = conservative, 1 = moderate, 2 = aggressive */
} FinanceInput;

typedef struct {
    double surplus;
    double savings_rate;
    double dti;
    double emergency_months;
    double emergency_target;
    double goal_remaining;
    double equity_pct;
    double debt_pct;
    double liquid_pct;
    double gold_pct;
    double equity_amount;
    double debt_amount;
    double liquid_amount;
    double gold_amount;
    double ten_year_value;
    double twenty_year_value;
    double ten_year_invested;
    double twenty_year_invested;
    double annual_return;
    int health_score;
    int advice_code;
} FinanceResult;

int calculate_finance(const FinanceInput *input, FinanceResult *result);

#ifdef __cplusplus
}
#endif
#endif
