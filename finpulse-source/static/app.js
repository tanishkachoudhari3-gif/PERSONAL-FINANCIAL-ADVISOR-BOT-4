const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inputIds = ['income', 'bills', 'daily_spend', 'emi', 'savings', 'age', 'risk', 'goal_target', 'goal_current'];
const colors = { bills: 'bills', spending: 'spending', debt: 'debt', surplus: 'surplus' };
const adviceNextSteps = {
  'Cash flow needs attention': 'List the three largest flexible costs and choose one to trim this month.',
  'Debt pressure is elevated': 'Compare the interest rates on your balances and focus extra payments on the highest-rate debt.',
  'Strengthen your emergency fund': 'Aim for six months of essential outflow in an accessible reserve.',
  'Room to improve your savings rate': 'Set an automatic transfer for payday, even if you begin with a small amount.',
  'Your plan is moving steadily': 'Keep contributions consistent and revisit your allocation when a major goal changes.'
};
const profiles = {
  graduate: { income: 45000, bills: 18000, daily_spend: 9000, emi: 0, savings: 60000, age: 23, risk: 1, goal_target: 500000, goal_current: 50000 },
  professional: { income: 120000, bills: 35000, daily_spend: 20000, emi: 20000, savings: 240000, age: 29, risk: 1, goal_target: 1500000, goal_current: 350000 },
  debt: { income: 90000, bills: 32000, daily_spend: 16000, emi: 39000, savings: 45000, age: 35, risk: 0, goal_target: 800000, goal_current: 100000 },
  builder: { income: 250000, bills: 70000, daily_spend: 35000, emi: 15000, savings: 900000, age: 32, risk: 2, goal_target: 10000000, goal_current: 1500000 }
};
const profileLabels = { graduate: 'Fresh graduate', professional: 'Salaried professional', debt: 'High debt stress', builder: 'Wealth builder' };
let comparisonBaseline = null;
let comparisonProfileName = 'Salaried professional';

function formatMoney(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return money.format(Math.round(Number(value)));
}

function compactMoney(value) {
  const amount = Number(value) || 0;
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  if (absolute >= 10000000) return `${sign}₹${(absolute / 10000000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} Cr`;
  if (absolute >= 100000) return `${sign}₹${(absolute / 100000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}L`;
  if (absolute >= 1000) return `${sign}₹${(absolute / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${sign}${formatMoney(absolute)}`;
}

function getPayload() {
  const payload = {};
  for (const id of inputIds) {
    const element = document.getElementById(id);
    payload[id] = Number(element.value);
  }
  return payload;
}

function setRangeFill(element) {
  if (element.type !== 'range') return;
  const min = Number(element.min || 0);
  const max = Number(element.max || 100);
  const value = Number(element.value);
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  element.style.setProperty('--range-fill', `${Math.max(0, Math.min(100, percent))}%`);
}

function updateInputDisplays() {
  for (const id of inputIds) {
    const element = document.getElementById(id);
    setRangeFill(element);
    const output = document.getElementById(`${id}-display`);
    if (output) output.textContent = id === 'age' ? `${element.value} years` : formatMoney(element.value);
  }
}

function renderBreakdown(data) {
  const bar = document.getElementById('breakdown-bars');
  const legend = document.getElementById('breakdown-legend');
  const total = data.breakdown.reduce((sum, item) => sum + Math.max(0, item.amount), 0) || 1;
  bar.innerHTML = data.breakdown.map((item) => {
    const width = Math.max(0, item.amount) / total * 100;
    return `<span class="stack-segment ${colors[item.key]}" style="width:${width}%" title="${item.label}: ${formatMoney(item.amount)}"></span>`;
  }).join('');
  bar.setAttribute('aria-label', `Monthly cash flow: ${data.breakdown.map(item => `${item.label} ${formatMoney(item.amount)}`).join(', ')}`);
  legend.innerHTML = data.breakdown.map((item) => `<div class="legend-item"><span class="legend-color ${colors[item.key]}"></span><span>${item.label}</span><strong>${compactMoney(item.amount)}</strong></div>`).join('');
  document.getElementById('cashflow-income').textContent = formatMoney(getPayload().income);
  document.getElementById('cashflow-outflow').textContent = formatMoney(data.outflow);
  const note = document.getElementById('cashflow-note');
  if (data.surplus < 0) {
    note.textContent = `Monthly outflow is ${formatMoney(Math.abs(data.surplus))} above your income. Review flexible costs first.`;
  } else {
    note.innerHTML = `You're keeping <strong>${data.savings_rate.toFixed(1)}%</strong> of your income available after outflow.`;
  }
}

function renderAllocation(data) {
  document.getElementById('allocation-total').innerHTML = `${formatMoney(Math.max(data.surplus, 0))} <small>/ mo</small>`;
  document.getElementById('allocation-stack').innerHTML = data.allocation.map(item => `<span class="allocation-segment ${item.key}" style="width:${item.pct}%" title="${item.label}: ${item.pct}%"></span>`).join('');
  document.getElementById('allocation-stack').setAttribute('aria-label', data.allocation.map(item => `${item.label} ${item.pct} percent`).join(', '));
  document.getElementById('allocation-list').innerHTML = data.allocation.map(item => `<div class="allocation-item"><span class="allocation-color ${item.key}"></span><div class="allocation-detail"><span class="allocation-name">${item.label}</span><div class="allocation-value">${formatMoney(item.amount)} <small>${item.pct}%</small></div></div></div>`).join('');
}

function renderGoal(goal) {
  document.getElementById('goal-current').textContent = formatMoney(goal.current);
  document.getElementById('goal-target').textContent = formatMoney(goal.target);
  document.getElementById('goal-progress-fill').style.width = `${Math.min(goal.progress, 100)}%`;
  document.getElementById('goal-progress-label').textContent = `${Math.round(goal.progress)}% complete`;
  document.getElementById('goal-remaining-label').textContent = `${formatMoney(goal.remaining)} to go`;
  let horizon = 'Add a monthly surplus to estimate a timeline.';
  if (goal.remaining <= 0) horizon = 'Milestone reached — set a new goal when you are ready.';
  else if (goal.months_to_goal) {
    const years = Math.floor(goal.months_to_goal / 12);
    const months = goal.months_to_goal % 12;
    horizon = `At this pace, about ${years ? `${years} ${years === 1 ? 'year' : 'years'}` : ''}${years && months ? ' and ' : ''}${months ? `${months} ${months === 1 ? 'month' : 'months'}` : ''} to go.`;
  }
  document.getElementById('goal-horizon-text').textContent = horizon;
}

function renderProjection(projection) {
  document.getElementById('projection-assumption').textContent = `${getPayload().risk === 0 ? 'Conservative' : getPayload().risk === 1 ? 'Moderate' : 'Growth-focused'} scenario · ${projection.annual_return.toFixed(0)}% assumed annual return`;
  document.getElementById('projection-10').textContent = compactMoney(projection.ten_year_value);
  document.getElementById('projection-20').textContent = compactMoney(projection.twenty_year_value);
  document.getElementById('projection-10-principal').textContent = compactMoney(projection.ten_year_invested);
  document.getElementById('projection-20-principal').textContent = compactMoney(projection.twenty_year_invested);

  const points = [];
  const monthlyRate = projection.annual_return / 100 / 12;
  const maxValue = Math.max(projection.twenty_year_value, 1);
  for (let year = 0; year <= 20; year += 2) {
    let value = 0;
    const months = year * 12;
    for (let month = 0; month < months; month += 1) value = (value + projection.monthly_investment) * (1 + monthlyRate);
    const x = year / 20 * 650;
    const y = 195 - Math.min(value / maxValue, 1) * 178;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const pointString = points.join(' ');
  const endpointY = Number(points[points.length - 1].split(',')[1]);
  document.getElementById('wealth-line').setAttribute('points', pointString);
  document.getElementById('wealth-area').setAttribute('d', `M0 205 L${points.join(' L')} L650 205 Z`);
  document.getElementById('wealth-dot').setAttribute('cy', String(endpointY));
}

function renderScenario(data) {
  if (!comparisonBaseline) {
    comparisonBaseline = {
      surplus: data.surplus,
      savingsRate: data.savings_rate,
      projection: data.projection.ten_year_value
    };
  }
  document.getElementById('scenario-baseline-name').textContent = comparisonProfileName;
  document.getElementById('scenario-surplus').textContent = formatMoney(data.surplus);
  document.getElementById('scenario-savings-rate').textContent = `${data.savings_rate.toFixed(1)}%`;
  document.getElementById('scenario-projection').textContent = compactMoney(data.projection.ten_year_value);

  const comparisons = [
    ['scenario-surplus-delta', data.surplus - comparisonBaseline.surplus, value => formatMoney(Math.abs(value))],
    ['scenario-savings-delta', data.savings_rate - comparisonBaseline.savingsRate, value => `${Math.abs(value).toFixed(1)} pts`],
    ['scenario-projection-delta', data.projection.ten_year_value - comparisonBaseline.projection, value => compactMoney(Math.abs(value))]
  ];
  comparisons.forEach(([id, delta, formatter]) => {
    const element = document.getElementById(id);
    if (Math.abs(delta) < 0.01) {
      element.textContent = 'Baseline scenario';
      element.className = '';
      return;
    }
    const direction = delta > 0 ? '+' : '−';
    element.textContent = `${direction}${formatter(delta)} vs baseline`;
    element.className = delta > 0 ? 'positive' : 'negative';
  });
}

function render(data) {
  const score = Math.max(0, Math.min(100, data.score));
  document.getElementById('health-score').textContent = score;
  document.getElementById('score-ring').style.setProperty('--score', score);
  document.getElementById('score-ring').setAttribute('aria-label', `Financial health score ${score} out of 100`);
  document.getElementById('health-label').textContent = data.score_label;
  document.getElementById('health-caption').textContent = score >= 80 ? 'Your key financial habits are looking strong.' : score >= 60 ? 'Your financial foundation is taking shape.' : 'A few focused changes can improve your foundation.';

  const surplus = document.getElementById('metric-surplus');
  surplus.textContent = formatMoney(data.surplus);
  surplus.classList.toggle('negative', data.surplus < 0);
  document.getElementById('savings-rate-caption').textContent = `${data.savings_rate.toFixed(1)}% of income`;
  document.getElementById('savings-mini-bar').style.width = `${Math.max(2, Math.min(data.savings_rate, 100))}%`;
  document.getElementById('metric-dti').innerHTML = `${data.dti.toFixed(1)}<span class="value-unit">%</span>`;
  document.getElementById('dti-caption').textContent = data.dti_status === 'Within guide' ? 'Within the 35% guide' : 'Above the 35% guide';
  document.getElementById('dti-dot').className = `status-dot ${data.dti <= 35 ? 'good' : data.dti <= 50 ? 'warn' : 'bad'}`;
  document.getElementById('metric-emergency').textContent = data.emergency_months.toFixed(1);
  document.getElementById('emergency-caption').textContent = `6-month target: ${compactMoney(data.emergency_target)}`;
  document.getElementById('advice-title').textContent = data.advice_title;
  document.getElementById('advice-body').textContent = data.advice;
  document.getElementById('advice-next-step').textContent = adviceNextSteps[data.advice_status];

  renderBreakdown(data);
  renderAllocation(data);
  renderGoal(data.goal);
  renderProjection(data.projection);
  renderScenario(data);
}

let requestSequence = 0;
let debounceTimer;
async function updateFromInputs() {
  updateInputDisplays();
  const payload = getPayload();
  const feedback = document.getElementById('input-feedback');
  const goalError = document.getElementById('goal-error');
  goalError.textContent = '';
  if (payload.goal_current > payload.goal_target) {
    const message = 'Current progress cannot be greater than the target.';
    goalError.textContent = message;
    feedback.className = 'input-feedback error';
    feedback.innerHTML = `<span class="feedback-check">!</span> ${message}`;
    return;
  }
  if (payload.income <= 0 || Object.values(payload).some(value => !Number.isFinite(value))) {
    feedback.className = 'input-feedback error';
    feedback.innerHTML = '<span class="feedback-check">!</span> Enter valid values to update your plan.';
    return;
  }
  feedback.className = 'input-feedback pending';
  feedback.innerHTML = '<span class="feedback-check">…</span> Updating the C-powered model…';
  const sequence = ++requestSequence;
  try {
    const response = await fetch('/api/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (sequence !== requestSequence) return;
    if (!response.ok) {
      const firstError = Object.values(data.errors || {})[0] || 'Review your financial inputs and try again.';
      feedback.className = 'input-feedback error';
      feedback.innerHTML = `<span class="feedback-check">!</span> ${firstError}`;
      return;
    }
    render(data);
    feedback.className = 'input-feedback';
    feedback.innerHTML = '<span class="feedback-check">✓</span> Inputs updated · C calculation engine active.';
  } catch (error) {
    if (sequence !== requestSequence) return;
    feedback.className = 'input-feedback error';
    feedback.innerHTML = '<span class="feedback-check">!</span> Could not reach the finance engine. Please try again.';
  }
}

function scheduleUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updateFromInputs, 150);
}

for (const id of inputIds) {
  const element = document.getElementById(id);
  element.addEventListener('input', scheduleUpdate);
  element.addEventListener('change', scheduleUpdate);
}

document.querySelectorAll('[data-persona]').forEach(button => {
  button.addEventListener('click', () => {
    const profile = profiles[button.dataset.persona];
    if (!profile) return;
    comparisonBaseline = null;
    comparisonProfileName = profileLabels[button.dataset.persona];
    document.querySelectorAll('[data-persona]').forEach(item => item.classList.toggle('selected', item === button));
    for (const [id, value] of Object.entries(profile)) document.getElementById(id).value = String(value);
    updateFromInputs();
    document.getElementById('overview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.getElementById('edit-plan-button').addEventListener('click', () => document.getElementById('simulator').scrollIntoView({ behavior: 'smooth', block: 'start' }));
document.getElementById('edit-goal-button').addEventListener('click', () => {
  document.getElementById('simulator').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('goal_target').focus(), 350);
});

document.querySelector('.mobile-menu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
document.querySelectorAll('.main-nav a').forEach(link => link.addEventListener('click', () => {
  document.body.classList.remove('nav-open');
  document.querySelectorAll('.main-nav a').forEach(item => item.classList.toggle('active', item === link));
}));

const today = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
document.getElementById('snapshot-date').textContent = today.toUpperCase();
updateInputDisplays();
updateFromInputs();
