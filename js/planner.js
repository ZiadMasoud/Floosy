let plannerSelectedMonth = null;
let plannerEvents = [];
let plannerItems = [];
let plannerRecords = [];
let plannerPriceCharts = new Map();
let plannerExpandedItems = new Set();
let plannerEventReturnFocus = null;
const PLANNER_TIMELINE_PREVIEW_COUNT = 3;
const PLANNER_OUTLOOK_RANGES = {
    '6-months': { label: '6 months', months: 6 },
    '12-months': { label: '12 months', months: 12 },
    '5-years': { label: '5 years', months: 60 },
    'all-time': { label: 'All time', months: null }
};

function plannerEscape(value) {
    const element = document.createElement('span');
    element.textContent = String(value ?? '');
    return element.innerHTML;
}

function plannerGetMonthParts() {
    if (!plannerSelectedMonth) {
        const today = new Date();
        plannerSelectedMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }
    const [year, month] = plannerSelectedMonth.split('-').map(Number);
    return { year, month };
}

function plannerGetTrackedItemType(item) {
    return item.type === 'income' ? 'income' : 'spending';
}

function plannerDateFromParts(year, month, day) {
    const lastDay = new Date(year, month, 0).getDate();
    return new Date(year, month - 1, Math.min(day, lastDay));
}

function plannerGetOccurrences(event, year, month) {
    const startDate = parseDateLocal(event.startDate);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const endDate = event.endDate ? parseDateLocal(event.endDate) : null;
    const occurrences = [];

    if (event.frequency === 'once') {
        if (startDate.getFullYear() === year && startDate.getMonth() === month - 1) {
            occurrences.push({ date: event.startDate, event });
        }
        return occurrences;
    }

    if (startDate > monthEnd || (endDate && endDate < monthStart)) return occurrences;

    if (event.frequency === 'monthly') {
        const date = plannerDateFromParts(year, month, startDate.getDate());
        const dateString = formatDateLocal(date);
        if (date >= startDate && (!endDate || date <= endDate)) {
            occurrences.push({ date: dateString, event });
        }
        return occurrences;
    }

    if (event.frequency === 'weekly') {
        const dayOffset = (startDate.getDay() - monthStart.getDay() + 7) % 7;
        for (let date = new Date(year, month - 1, 1 + dayOffset); date <= monthEnd; date.setDate(date.getDate() + 7)) {
            if (date < startDate || (endDate && date > endDate)) continue;
            occurrences.push({ date: formatDateLocal(date), event });
        }
    }

    return occurrences;
}

function plannerFrequencyLabel(event) {
    if (event.frequency === 'once') return 'One time';
    if (event.frequency === 'weekly') {
        return `Weekly · ${parseDateLocal(event.startDate).toLocaleDateString('en-US', { weekday: 'long' })}`;
    }
    return `Monthly · day ${parseDateLocal(event.startDate).getDate()}`;
}

function plannerDestroyCharts() {
    plannerPriceCharts.forEach(chart => chart.destroy());
    plannerPriceCharts.clear();
}

function plannerRenderTimeline(occurrences) {
    const timeline = document.getElementById('planner-timeline');
    if (!timeline) return;

    if (!occurrences.length) {
        timeline.innerHTML = `
            <div class="planner-empty-state">
              <i class="fas fa-calendar-plus" aria-hidden="true"></i>
              <strong>No events planned for this month</strong>
              <span>Add a one-time or repeating event to start your timeline.</span>
            </div>`;
        return;
    }

    const grouped = new Map();
    occurrences.slice().sort((left, right) => left.date.localeCompare(right.date))
        .forEach((occurrence, index) => {
            if (!grouped.has(occurrence.date)) grouped.set(occurrence.date, []);
            grouped.get(occurrence.date).push({ ...occurrence, index });
    });

    const dayMarkup = Array.from(grouped.entries())
        .map(([dateString, dayOccurrences]) => {
            const date = parseDateLocal(dateString);
            const formattedDate = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            const rows = dayOccurrences.map(({ event, index }) => `
              <div class="planner-event-row ${event.type}" data-event-index="${index}" ${index >= PLANNER_TIMELINE_PREVIEW_COUNT ? 'hidden' : ''}>
                <span class="planner-event-kind ${event.type}" aria-hidden="true">
                  <i class="fas ${event.type === 'income' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                </span>
                <div class="planner-event-copy">
                  <div class="planner-event-main-line">
                    <strong>${plannerEscape(event.title)}</strong>
                    <strong class="planner-event-amount ${event.type}">
                      ${event.type === 'income' ? '+' : '−'}$${formatCurrency(Number(event.amount) || 0)}
                    </strong>
                  </div>
                  <span>${plannerEscape(plannerFrequencyLabel(event))}</span>
                </div>
                <div class="planner-event-actions">
                  <button type="button" class="btn-icon" data-edit-event="${event.id}" aria-label="Edit ${plannerEscape(event.title)}">
                    <i class="fas fa-pen"></i>
                  </button>
                  <button type="button" class="btn-icon" data-delete-event="${event.id}" aria-label="Delete ${plannerEscape(event.title)}">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>`).join('');
            const hasVisibleEvent = dayOccurrences.some(({ index }) => index < PLANNER_TIMELINE_PREVIEW_COUNT);
            return `
              <div class="planner-day" ${hasVisibleEvent ? '' : 'hidden'}>
                <div class="planner-day-date">
                  <span class="planner-timeline-dot" aria-hidden="true"></span>
                  <time datetime="${plannerEscape(dateString)}">${plannerEscape(formattedDate)}</time>
                </div>
                <div class="planner-day-events">${rows}</div>
              </div>`;
        }).join('');

    const remainingCount = Math.max(0, occurrences.length - PLANNER_TIMELINE_PREVIEW_COUNT);
    const toggleButton = remainingCount
        ? `<button type="button" class="btn btn-outline show-more-btn planner-timeline-toggle" aria-expanded="false">
             <i class="fas fa-chevron-down" aria-hidden="true"></i> Show ${remainingCount} more
           </button>`
        : '';
    timeline.innerHTML = `${dayMarkup}${toggleButton}`;

    const toggle = timeline.querySelector('.planner-timeline-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') !== 'true';
            timeline.querySelectorAll('.planner-day').forEach(day => {
                day.querySelectorAll('.planner-event-row').forEach(row => {
                    row.hidden = !expanded && Number(row.dataset.eventIndex) >= PLANNER_TIMELINE_PREVIEW_COUNT;
                });
                day.hidden = !expanded && !day.querySelector('.planner-event-row:not([hidden])');
            });
            toggle.setAttribute('aria-expanded', String(expanded));
            toggle.innerHTML = expanded
                ? '<i class="fas fa-chevron-up" aria-hidden="true"></i> Show less'
                : `<i class="fas fa-chevron-down" aria-hidden="true"></i> Show ${remainingCount} more`;
        });
    }
}

function plannerRenderKpis(occurrences) {
    const income = occurrences.reduce((sum, occurrence) =>
        occurrence.event.type === 'income' ? sum + Number(occurrence.event.amount || 0) : sum, 0);
    const expenses = occurrences.reduce((sum, occurrence) =>
        occurrence.event.type === 'expense' ? sum + Number(occurrence.event.amount || 0) : sum, 0);
    const remaining = income - expenses;
    const today = formatDateLocal(new Date());
    const nextOccurrence = occurrences
        .filter(occurrence => occurrence.date >= today)
        .sort((left, right) => left.date.localeCompare(right.date))[0];
    const nextEvent = nextOccurrence
        ? `${parseDateLocal(nextOccurrence.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${nextOccurrence.event.title}`
        : 'No upcoming events';

    const kpis = [
        { label: 'Planned income', value: `+$${formatCurrency(income)}`, icon: 'fa-arrow-down', tone: 'income' },
        { label: 'Planned expenses', value: `−$${formatCurrency(expenses)}`, icon: 'fa-arrow-up', tone: 'expense' },
        { label: 'Planned remaining', value: `${remaining < 0 ? '−' : '+'}$${formatCurrency(Math.abs(remaining))}`, icon: 'fa-wallet', tone: remaining < 0 ? 'negative' : 'balance' },
        { label: 'Next planned event', value: nextEvent, icon: 'fa-clock', tone: 'next' }
    ];

    const container = document.getElementById('planner-kpis');
    if (container) {
        container.innerHTML = kpis.map(kpi => `
          <article class="planner-kpi ${kpi.tone}">
            <span class="planner-kpi-icon"><i class="fas ${kpi.icon}" aria-hidden="true"></i></span>
            <span class="planner-kpi-label">${kpi.label}</span>
            <strong>${plannerEscape(kpi.value)}</strong>
          </article>`).join('');
    }
}

function plannerRenderPriceChart(item, canvas) {
    const history = Array.isArray(item.priceHistory) ? item.priceHistory.slice() : [];
    const sorted = history.sort((left, right) => left.date.localeCompare(right.date));
    if (sorted.length === 0) return;
    if (typeof Chart === 'undefined') {
        const message = document.createElement('p');
        message.className = 'planner-chart-unavailable';
        message.textContent = 'Price chart is unavailable right now; your saved price history is still shown below.';
        canvas.replaceWith(message);
        return;
    }

    const chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: sorted.map(entry => parseDateLocal(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [{
                data: sorted.map(entry => Number(entry.price) || 0),
                borderColor: '#0B2849',
                backgroundColor: 'rgba(53, 88, 114, 0.12)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: context => `$${formatCurrency(context.parsed.y)}`
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
                y: {
                    beginAtZero: false,
                    ticks: { callback: value => `$${formatCurrency(Number(value))}` }
                }
            }
        }
    });
    plannerPriceCharts.set(item.id, chart);
}

function plannerGetCategoryHistory(item, range = '12-months') {
    const monthlyTotals = new Map();
    const addRecord = record => {
        if (record.type !== plannerGetTrackedItemType(item) || record.category !== item.category) return;
        if (!record.date || record.isProjected || record.excludeFromIncomeTotals) return;
        if (record.type === 'spending' &&
            (record.isSavingsTransfer || record.savingsAccountId || record.category === 'Savings Transfer')) return;

        const amount = Number.parseFloat(record.amount);
        if (!Number.isFinite(amount)) return;
        const date = record.type === 'income' && typeof getIncomeAttributionDate === 'function'
            ? getIncomeAttributionDate(record)
            : parseDateLocal(record.date);
        if (!date || Number.isNaN(date.getTime())) return;

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const total = monthlyTotals.get(monthKey) || { amount: 0, count: 0 };
        total.amount += amount;
        total.count += 1;
        monthlyTotals.set(monthKey, total);
    };

    plannerRecords.forEach(record => {
        if (record.formatType === 'combined' && Array.isArray(record.combinedTransactions)) {
            record.combinedTransactions.forEach(transaction => {
                addRecord({
                    ...record,
                    ...transaction,
                    amount: (Number.parseFloat(transaction.amount) || 0) * (Number.parseInt(transaction.quantity, 10) || 1),
                    isSavingsTransfer: !!(record.isSavingsTransfer || record.savingsAccountId || transaction.savingsAccountId)
                });
            });
        } else {
            addRecord(record);
        }
    });

    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonth = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const rangeConfig = PLANNER_OUTLOOK_RANGES[range] || PLANNER_OUTLOOK_RANGES['12-months'];
    const recordedMonths = Array.from(monthlyTotals.keys()).filter(month => month <= currentMonth).sort();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const defaultStartMonth = `${defaultStartDate.getFullYear()}-${String(defaultStartDate.getMonth() + 1).padStart(2, '0')}`;
    const rangeStartDate = rangeConfig.months === null
        ? null
        : new Date(now.getFullYear(), now.getMonth() - rangeConfig.months + 1, 1);
    const firstMonth = rangeConfig.months === null
        ? recordedMonths[0] || defaultStartMonth
        : `${rangeStartDate.getFullYear()}-${String(rangeStartDate.getMonth() + 1).padStart(2, '0')}`;
    const [startYear, startMonth] = firstMonth.split('-').map(Number);
    const monthsToRender = Math.max(1,
        (currentMonthDate.getFullYear() - startYear) * 12 + currentMonthDate.getMonth() - (startMonth - 1) + 1);

    return Array.from({ length: monthsToRender }, (_, index) => {
        const monthDate = new Date(startYear, startMonth - 1 + index, 1);
        const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        return { month, ...(monthlyTotals.get(month) || { amount: 0, count: 0 }) };
    });
}

function plannerFilterOutlierMonths(months) {
    const values = months.filter(month => month.count > 0 && month.amount > 0)
        .map(month => month.amount)
        .sort((left, right) => left - right);
    if (values.length < 3) return values;

    const quantile = fraction => {
        const position = (values.length - 1) * fraction;
        const lower = Math.floor(position);
        const upper = Math.ceil(position);
        return values[lower] + ((values[upper] - values[lower]) * (position - lower));
    };
    const q1 = quantile(0.25);
    const q3 = quantile(0.75);
    const spread = q3 - q1;
    const lowerFence = q1 - 1.5 * spread;
    const upperFence = q3 + 1.5 * spread;
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2
        ? values[middle]
        : (values[middle - 1] + values[middle]) / 2;
    const deviations = values.map(value => Math.abs(value - median)).sort((left, right) => left - right);
    const madMiddle = Math.floor(deviations.length / 2);
    const medianDeviation = deviations.length % 2
        ? deviations[madMiddle]
        : (deviations[madMiddle - 1] + deviations[madMiddle]) / 2;
    const robustZScore = value => medianDeviation
        ? 0.6745 * Math.abs(value - median) / medianDeviation
        : 0;
    return values.filter(value =>
        value >= lowerFence &&
        value <= upperFence &&
        (!medianDeviation || robustZScore(value) <= 3.5));
}

function plannerRenderCategoryChart(item, canvas, history) {
    if (!history.length) return;
    if (typeof Chart === 'undefined') {
        const message = document.createElement('p');
        message.className = 'planner-chart-unavailable';
        message.textContent = 'The category chart is unavailable right now; monthly totals are still shown below.';
        canvas.replaceWith(message);
        return;
    }

    const isIncome = plannerGetTrackedItemType(item) === 'income';
    const chart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: history.map(entry => {
                const [year, month] = entry.month.split('-').map(Number);
                return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }),
            datasets: [{
                data: history.map(entry => entry.amount),
                backgroundColor: isIncome ? 'rgba(16, 185, 129, 0.72)' : 'rgba(239, 68, 68, 0.68)',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: context => `$${formatCurrency(context.parsed.y)}`
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
                y: {
                    beginAtZero: true,
                    ticks: { callback: value => `$${formatCurrency(Number(value))}` }
                }
            }
        }
    });
    plannerPriceCharts.set(item.id, chart);
}

function plannerRenderItems() {
    const container = document.getElementById('planner-items');
    if (!container) return;
    plannerDestroyCharts();

    if (!plannerItems.length) {
        container.innerHTML = `
          <div class="planner-empty-state planner-items-empty">
            <i class="fas fa-tags" aria-hidden="true"></i>
            <strong>No tracked items yet</strong>
            <span>Track recorded income or spending by category, or log prices for named items.</span>
          </div>`;
        return;
    }

    const today = formatDateLocal(new Date());
    container.innerHTML = plannerItems.map(item => {
        const isCategoryTracker = !!item.category;
        const outlookRange = PLANNER_OUTLOOK_RANGES[item.outlookRange] ? item.outlookRange : '12-months';
        const categoryHistory = isCategoryTracker ? plannerGetCategoryHistory(item, outlookRange) : [];
        const allTimeHistory = isCategoryTracker ? plannerGetCategoryHistory(item, 'all-time') : [];
        const priceHistory = Array.isArray(item.priceHistory) ? item.priceHistory : [];
        const sortedPriceHistory = priceHistory.slice().sort((left, right) => left.date.localeCompare(right.date));
        const latestPrice = sortedPriceHistory[sortedPriceHistory.length - 1];
        const previousPrice = sortedPriceHistory.length > 1 ? sortedPriceHistory[sortedPriceHistory.length - 2] : null;
        const totalCategoryAmount = categoryHistory.reduce((total, entry) => total + entry.amount, 0);
        const rangeStatValues = plannerFilterOutlierMonths(categoryHistory);
        const averageCategoryAmount = rangeStatValues.length
            ? rangeStatValues.reduce((total, amount) => total + amount, 0) / rangeStatValues.length
            : 0;
        const minimumCategoryMonth = categoryHistory.filter(entry =>
            entry.count > 0 && rangeStatValues.includes(entry.amount)).reduce((minimum, entry) =>
            !minimum || entry.amount < minimum.amount ? entry : minimum, null);
        const maximumCategoryMonth = categoryHistory.filter(entry =>
            entry.count > 0 && rangeStatValues.includes(entry.amount)).reduce((maximum, entry) =>
            !maximum || entry.amount > maximum.amount ? entry : maximum, null);
        const currentDate = new Date();
        const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const previousDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        const previousMonthKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
        const currentCategoryMonth = allTimeHistory.find(entry => entry.month === currentMonthKey) || { amount: 0 };
        const previousCategoryMonth = allTimeHistory.find(entry => entry.month === previousMonthKey) || { amount: 0 };
        const change = latestPrice && previousPrice && Number(previousPrice.price) > 0
            ? ((Number(latestPrice.price) - Number(previousPrice.price)) / Number(previousPrice.price)) * 100
            : null;
        const frequencyLabels = { weekly: 'Weekly', monthly: 'Monthly', 'as-needed': 'As needed' };
        const frequency = frequencyLabels[item.frequency] || 'As needed';
        const displayName = String(item.name || '').trim() || item.category;
        const categoryLabel = isCategoryTracker
            ? `<span class="planner-item-category">${plannerEscape(plannerGetTrackedItemType(item) === 'income' ? 'Income' : 'Spending')} · ${plannerEscape(item.category)}</span>`
            : '';
        const expanded = plannerExpandedItems.has(String(item.id));
        const priceHistoryRows = sortedPriceHistory.slice().reverse().map(entry => `
          <li class="planner-price-row">
            <span>${plannerEscape(parseDateLocal(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</span>
            <span class="planner-price-record">${entry.notes ? `<small>${plannerEscape(entry.notes)}</small>` : ''}</span>
            <strong>$${formatCurrency(Number(entry.price) || 0)}</strong>
            <button type="button" class="btn-icon" data-delete-price="${plannerEscape(entry.id)}" data-item-id="${item.id}"
              aria-label="Delete price entry for ${plannerEscape(displayName)}">
              <i class="fas fa-times"></i>
            </button>
          </li>`).join('');
        const categoryHistoryRows = categoryHistory.slice().reverse().map(entry => {
            const [year, month] = entry.month.split('-').map(Number);
            const monthLabel = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            return `
              <li class="planner-price-row category-month">
                <span>${plannerEscape(monthLabel)}</span>
                <span class="planner-price-record"><small>${entry.count === 0 ? 'No transactions' : entry.count === 1 ? '1 transaction' : `${entry.count} transactions`}</small></span>
                <strong>$${formatCurrency(entry.amount)}</strong>
              </li>`;
        }).join('');
        const displayedHistoryRows = isCategoryTracker ? categoryHistoryRows : priceHistoryRows;
        const historyCount = isCategoryTracker ? categoryHistory.length : priceHistory.length;
        const itemType = plannerGetTrackedItemType(item);
        const categoryMonthLabel = monthKey => {
            if (!monthKey) return 'No recorded months';
            const [year, month] = monthKey.split('-').map(Number);
            return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        };
        const outlookStats = isCategoryTracker ? `
          <div class="planner-category-outlook" aria-label="${plannerEscape(PLANNER_OUTLOOK_RANGES[outlookRange].label)} ${itemType} outlook">
            <label class="planner-outlook-range">
              <span>Outlook range</span>
              <select data-outlook-range="${item.id}" aria-label="Outlook range for ${plannerEscape(displayName)}">
                ${Object.entries(PLANNER_OUTLOOK_RANGES).map(([value, option]) =>
                    `<option value="${value}" ${value === outlookRange ? 'selected' : ''}>${option.label}</option>`).join('')}
              </select>
            </label>
            <div class="planner-outlook-stat total">
              <span>Total</span>
              <strong>$${formatCurrency(totalCategoryAmount)}</strong>
            </div>
            <div class="planner-outlook-stat average">
              <span>Monthly Avg</span>
              <strong>$${formatCurrency(averageCategoryAmount)}</strong>
            </div>
            <div class="planner-outlook-stat minimum">
              <span>Minimum · ${plannerEscape(categoryMonthLabel(minimumCategoryMonth?.month))}</span>
              <strong>${minimumCategoryMonth ? `$${formatCurrency(minimumCategoryMonth.amount)}` : 'N/A'}</strong>
            </div>
            <div class="planner-outlook-stat maximum">
              <span>Maximum · ${plannerEscape(categoryMonthLabel(maximumCategoryMonth?.month))}</span>
              <strong>${maximumCategoryMonth ? `$${formatCurrency(maximumCategoryMonth.amount)}` : 'N/A'}</strong>
            </div>
            <div class="planner-outlook-stat current">
              <span>This month</span>
              <strong>$${formatCurrency(currentCategoryMonth.amount)}</strong>
            </div>
            <div class="planner-outlook-stat previous">
              <span>Last month</span>
              <strong>$${formatCurrency(previousCategoryMonth.amount)}</strong>
            </div>
          </div>` : '';
        const chartContent = isCategoryTracker
            ? `<div class="planner-price-chart-wrap"><canvas id="planner-chart-${item.id}" aria-label="Monthly ${itemType} totals for ${plannerEscape(item.category)} over ${plannerEscape(PLANNER_OUTLOOK_RANGES[outlookRange].label)}"></canvas></div>`
            : (priceHistory.length
                ? `<div class="planner-price-chart-wrap"><canvas id="planner-chart-${item.id}" aria-label="Price history chart for ${plannerEscape(displayName)}"></canvas></div>`
                : `<div class="planner-no-price-history"><i class="fas fa-chart-line" aria-hidden="true"></i><span>No price history yet. Add your first price below to start the chart.</span></div>`);
        const historyContent = historyCount
            ? `${chartContent}<ul class="planner-price-history">${displayedHistoryRows}</ul>`
            : chartContent;

        return `
          <article class="planner-item-card">
            <div class="planner-item-heading">
              <div class="planner-item-name">
                <div>
                  <h4>${plannerEscape(displayName)}</h4>
                  <span>${isCategoryTracker ? `${plannerEscape(PLANNER_OUTLOOK_RANGES[outlookRange].label)} outlook · from recorded transactions` : `${plannerEscape(frequency)} · descriptive only`}</span>
                  ${categoryLabel}
                </div>
              </div>
              <div class="planner-item-actions">
                <button type="button" class="btn-icon" data-edit-item="${item.id}" aria-label="Edit ${plannerEscape(displayName)}">
                  <i class="fas fa-pen"></i>
                </button>
                <button type="button" class="btn-icon" data-delete-item="${item.id}" aria-label="Delete ${plannerEscape(displayName)}">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            ${isCategoryTracker ? outlookStats : `
              <div class="planner-item-latest">
                <div>
                  <span>Latest price</span>
                  <strong>${latestPrice ? `$${formatCurrency(Number(latestPrice.price) || 0)}` : 'No prices yet'}</strong>
                </div>
                <span class="planner-price-change ${change === null ? '' : change > 0 ? 'up' : change < 0 ? 'down' : 'steady'}">
                  ${change === null ? `${priceHistory.length} ${priceHistory.length === 1 ? 'entry' : 'entries'}` : `${change > 0 ? '+' : ''}${formatCurrency(change)}% since previous`}
                </span>
              </div>`}
            <details class="planner-item-details" data-item-details="${item.id}" ${expanded ? 'open' : ''}>
              <summary>${expanded ? 'Hide details' : isCategoryTracker ? `${plannerEscape(PLANNER_OUTLOOK_RANGES[outlookRange].label)} outlook` : 'Price history & details'}</summary>
              <div class="planner-item-detail-body">
                ${historyContent}
                ${!isCategoryTracker ? `<form class="planner-price-form" data-item-id="${item.id}">
                  <h5>Log a price</h5>
                  <div class="planner-price-form-fields">
                    <label class="form-group">
                      <span>Date</span>
                      <input type="date" name="date" value="${today}" required />
                    </label>
                    <label class="form-group">
                      <span>Price ($)</span>
                      <input type="number" name="price" min="0.01" step="0.01" required placeholder="0.00" />
                    </label>
                    <label class="form-group">
                      <span>Note <small>(optional)</small></span>
                      <input type="text" name="notes" maxlength="120" placeholder="Store, size, or other detail" />
                    </label>
                    <button class="btn btn-outline" type="submit"><i class="fas fa-plus"></i> Add price</button>
                  </div>
                </form>` : ''}
              </div>
            </details>
          </article>`;
    }).join('');

    container.querySelectorAll('[data-item-details]').forEach(details => {
        details.addEventListener('toggle', () => {
            const itemId = details.getAttribute('data-item-details');
            if (details.open) {
                plannerExpandedItems.add(itemId);
                const item = plannerItems.find(current => String(current.id) === itemId);
                const canvas = document.getElementById(`planner-chart-${itemId}`);
                if (item && canvas && !plannerPriceCharts.has(item.id)) {
                    if (item.category) plannerRenderCategoryChart(item, canvas, plannerGetCategoryHistory(item, item.outlookRange));
                    else plannerRenderPriceChart(item, canvas);
                }
            } else {
                plannerExpandedItems.delete(itemId);
                const item = plannerItems.find(current => String(current.id) === itemId);
                const chart = item ? plannerPriceCharts.get(item.id) : null;
                if (chart) {
                    chart.destroy();
                    plannerPriceCharts.delete(item.id);
                }
            }
            const summary = details.querySelector('summary');
            const item = plannerItems.find(current => String(current.id) === details.getAttribute('data-item-details'));
            if (summary) {
                summary.textContent = details.open
                    ? 'Hide details'
                    : item && item.category
                        ? `${PLANNER_OUTLOOK_RANGES[item.outlookRange]?.label || '12 months'} outlook`
                        : 'Price history & details';
            }
        });
        if (details.open) {
            const item = plannerItems.find(current => String(current.id) === details.getAttribute('data-item-details'));
            const canvas = details.querySelector('canvas');
            if (item && canvas) {
                if (item.category) plannerRenderCategoryChart(item, canvas, plannerGetCategoryHistory(item, item.outlookRange));
                else plannerRenderPriceChart(item, canvas);
            }
        }
    });
}

async function renderPlanner() {
    const monthInput = document.getElementById('planner-month');
    if (!monthInput) return;

    try {
        if (!plannerSelectedMonth) {
            const now = new Date();
            plannerSelectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        monthInput.value = plannerSelectedMonth;
        const monthDisplay = document.getElementById('current-month-display');
        if (monthDisplay) {
            const { year, month } = plannerGetMonthParts();
            monthDisplay.textContent = new Date(year, month - 1)
                .toLocaleString('default', { month: 'short', year: 'numeric' });
        }
        const { year, month } = plannerGetMonthParts();
        plannerEvents = await getAll(STORE_PLANNED_EVENTS);
        plannerItems = await getAll(STORE_TRACKED_ITEMS);
        plannerRecords = await getAll(STORE_RECORDS);
        const occurrences = plannerEvents.flatMap(event => plannerGetOccurrences(event, year, month))
            .sort((left, right) => left.date.localeCompare(right.date));

        plannerRenderKpis(occurrences);
        plannerRenderTimeline(occurrences);
        plannerRenderItems();
    } catch (error) {
        console.error('Failed to load planner data:', error);
        showToast('Could not load planner data. Please try again.', 'error');
    }
}

function plannerResetEventForm() {
    const form = document.getElementById('planner-event-form');
    if (!form) return;
    form.reset();
    form.elements.id.value = '';
    form.elements.type.value = 'income';
    form.elements.frequency.value = 'monthly';
    form.elements.startDate.value = formatDateLocal(new Date());
    form.elements.endDate.value = '';
    form.elements.frequency.dispatchEvent(new Event('change'));
    plannerCloseEventModal();
    document.getElementById('planner-event-form-title').textContent = 'New planned event';
}

function plannerOpenEventModal() {
    const modal = document.getElementById('planner-event-modal');
    plannerEventReturnFocus = document.activeElement;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    document.getElementById('planner-event-form').elements.title.focus();
}

function plannerCloseEventModal() {
    const modal = document.getElementById('planner-event-modal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    const returnFocus = plannerEventReturnFocus instanceof HTMLElement && plannerEventReturnFocus.isConnected
        ? plannerEventReturnFocus
        : document.getElementById('planner-add-event-toggle');
    returnFocus?.focus();
    modal.setAttribute('aria-hidden', 'true');
    plannerEventReturnFocus = null;
}

function plannerEditEvent(id) {
    const event = plannerEvents.find(item => String(item.id) === String(id));
    const form = document.getElementById('planner-event-form');
    if (!event || !form) return;
    form.elements.id.value = event.id;
    form.elements.title.value = event.title;
    form.elements.type.value = event.type;
    form.elements.amount.value = event.amount;
    form.elements.frequency.value = event.frequency;
    form.elements.startDate.value = event.startDate;
    form.elements.endDate.value = event.endDate || '';
    form.elements.frequency.dispatchEvent(new Event('change'));
    document.getElementById('planner-event-form-title').textContent = 'Edit planned event';
    plannerOpenEventModal();
}

function plannerResetItemForm() {
    const form = document.getElementById('planner-item-form');
    if (!form) return;
    form.reset();
    form.elements.id.value = '';
    form.elements.type.value = 'spending';
    form.elements.category.value = '';
    plannerPopulateItemCategories('spending');
    plannerUpdateItemFormFields();
    form.hidden = true;
    document.getElementById('planner-item-form-title').textContent = 'Track an item';
}

function plannerPopulateItemCategories(type = 'spending', selectedCategory = '') {
    const categorySelect = document.querySelector('#planner-item-form [name="category"]');
    if (!categorySelect) return;
    const availableCategories = (Array.isArray(categories) ? categories : [])
        .filter(category => category.type === type);
    const options = availableCategories
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(category => `<option value="${plannerEscape(category.name)}">${plannerEscape(category.name)}</option>`)
        .join('');
    const placeholder = availableCategories.length ? 'Select category (optional)' : `No ${type} categories`;
    categorySelect.innerHTML = `<option value="">${plannerEscape(placeholder)}</option>${options}`;
    categorySelect.value = selectedCategory;
    plannerUpdateItemFormFields();
}

function plannerUpdateItemFormFields() {
    const form = document.getElementById('planner-item-form');
    if (!form) return;
    const hasCategory = !!form.elements.category.value;
    form.elements.name.required = !hasCategory;
    form.elements.frequency.required = !hasCategory;
    form.querySelector('[data-frequency-field]').hidden = hasCategory;
}

function plannerEditItem(id) {
    const item = plannerItems.find(current => String(current.id) === String(id));
    const form = document.getElementById('planner-item-form');
    if (!item || !form) return;
    form.elements.id.value = item.id;
    form.elements.name.value = item.name;
    form.elements.frequency.value = item.frequency;
    form.elements.type.value = plannerGetTrackedItemType(item);
    plannerPopulateItemCategories(form.elements.type.value, item.category || '');
    form.hidden = false;
    document.getElementById('planner-item-form-title').textContent = 'Edit tracked item';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.name.focus();
}

function plannerInit() {
    const monthInput = document.getElementById('planner-month');
    const eventForm = document.getElementById('planner-event-form');
    const eventModal = document.getElementById('planner-event-modal');
    const itemForm = document.getElementById('planner-item-form');
    const timeline = document.getElementById('planner-timeline');
    const itemsContainer = document.getElementById('planner-items');
    const eventFrequency = eventForm.elements.frequency;
    const itemType = itemForm.elements.type;
    const itemCategory = itemForm.elements.category;
    const endDateLabel = eventForm.querySelector('.planner-end-date-field');
    const updateEndDateVisibility = () => {
        const isOneTime = eventFrequency.value === 'once';
        endDateLabel.hidden = isOneTime;
        if (isOneTime) eventForm.elements.endDate.value = '';
    };
    eventFrequency.addEventListener('change', updateEndDateVisibility);
    updateEndDateVisibility();

    document.getElementById('planner-add-event-toggle').addEventListener('click', () => {
        plannerResetEventForm();
        plannerOpenEventModal();
    });
    document.getElementById('planner-event-cancel').addEventListener('click', plannerResetEventForm);
    document.getElementById('planner-event-close').addEventListener('click', plannerResetEventForm);
    eventModal.addEventListener('click', event => {
        if (event.target === eventModal) plannerResetEventForm();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && eventModal.classList.contains('active')) plannerResetEventForm();
    });
    document.getElementById('planner-add-item-toggle').addEventListener('click', () => {
        plannerResetItemForm();
        itemForm.hidden = false;
        itemForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        itemForm.elements.name.focus();
    });
    document.getElementById('planner-item-cancel').addEventListener('click', plannerResetItemForm);
    itemType.addEventListener('change', () => plannerPopulateItemCategories(itemType.value));
    itemCategory.addEventListener('change', plannerUpdateItemFormFields);

    monthInput.addEventListener('change', async () => {
        if (!monthInput.value) return;
        plannerSelectedMonth = monthInput.value;
        await renderPlanner();
    });

    eventForm.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(eventForm);
        const eventName = String(formData.get('title') || '').trim();
        const amount = Number(formData.get('amount'));
        const type = String(formData.get('type'));
        const frequency = String(formData.get('frequency'));
        const startDate = String(formData.get('startDate'));
        const endDate = String(formData.get('endDate') || '');
        if (!Number.isFinite(amount) || amount <= 0 || !parseDateLocal(startDate).getTime()) {
            showToast('Enter a valid date and an amount greater than zero.', 'warning');
            return;
        }
        if (endDate && (!parseDateLocal(endDate).getTime() || endDate < startDate)) {
            showToast('The end date must be on or after the first date.', 'warning');
            return;
        }
        if (!['income', 'expense'].includes(type) || !['once', 'monthly', 'weekly'].includes(frequency)) {
            showToast('Choose a valid event type and repeat schedule.', 'warning');
            return;
        }
        if (frequency === 'once' && endDate) {
            showToast('A one-time event cannot have an end date.', 'warning');
            return;
        }

        try {
            const id = formData.get('id');
            const record = {
                title: eventName || (type === 'income' ? 'Income' : 'Expense'),
                type,
                amount,
                frequency,
                startDate,
                endDate,
                updatedAt: new Date().toISOString()
            };
            if (id) {
                record.id = Number(id);
                await updateRecord(STORE_PLANNED_EVENTS, record);
                showToast('Planned event updated.', 'success');
            } else {
                record.createdAt = record.updatedAt;
                await add(STORE_PLANNED_EVENTS, record);
                showToast('Planned event added.', 'success');
            }
            plannerResetEventForm();
            await renderPlanner();
        } catch (error) {
            console.error('Failed to save planned event:', error);
            showToast('Could not save the planned event.', 'error');
        }
    });

    itemForm.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(itemForm);
        const name = String(formData.get('name') || '').trim();
        const type = String(formData.get('type') || '');
        const frequency = String(formData.get('frequency'));
        const category = String(formData.get('category') || '').trim();
        if ((!name && !category) || !['income', 'spending'].includes(type) || !['weekly', 'monthly', 'as-needed'].includes(frequency)) {
            showToast('Choose income or spending and add a name or category.', 'warning');
            return;
        }

        try {
            const id = formData.get('id');
            const existing = id ? plannerItems.find(item => String(item.id) === String(id)) : null;
            const record = {
                name,
                type,
                frequency,
                category,
                priceHistory: existing && Array.isArray(existing.priceHistory) ? existing.priceHistory : [],
                updatedAt: new Date().toISOString()
            };
            if (id) {
                record.id = Number(id);
                await updateRecord(STORE_TRACKED_ITEMS, record);
                showToast('Tracked item updated.', 'success');
            } else {
                record.createdAt = record.updatedAt;
                await add(STORE_TRACKED_ITEMS, record);
                showToast('Item added to your tracker.', 'success');
            }
            plannerResetItemForm();
            await renderPlanner();
        } catch (error) {
            console.error('Failed to save tracked item:', error);
            showToast('Could not save the tracked item.', 'error');
        }
    });

    timeline.addEventListener('click', async event => {
        if (!(event.target instanceof Element)) return;
        const editButton = event.target.closest('[data-edit-event]');
        const deleteButton = event.target.closest('[data-delete-event]');
        if (editButton) {
            plannerEditEvent(editButton.getAttribute('data-edit-event'));
            return;
        }
        if (deleteButton && await showConfirm('Delete this planned event?')) {
            try {
                await remove(STORE_PLANNED_EVENTS, Number(deleteButton.getAttribute('data-delete-event')));
                showToast('Planned event deleted.', 'success');
                await renderPlanner();
            } catch (error) {
                console.error('Failed to delete planned event:', error);
                showToast('Could not delete the planned event.', 'error');
            }
        }
    });

    itemsContainer.addEventListener('submit', async event => {
        if (!(event.target instanceof Element)) return;
        const form = event.target.closest('.planner-price-form');
        if (!form) return;
        event.preventDefault();
        const item = plannerItems.find(current => String(current.id) === form.getAttribute('data-item-id'));
        const formData = new FormData(form);
        const date = String(formData.get('date'));
        const price = Number(formData.get('price'));
        const notes = String(formData.get('notes') || '').trim();
        if (!item || !date || !Number.isFinite(price) || price <= 0) {
            showToast('Enter a valid date and a price greater than zero.', 'warning');
            return;
        }

        try {
            item.priceHistory = Array.isArray(item.priceHistory) ? item.priceHistory : [];
            item.priceHistory.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                date,
                price,
                notes
            });
            item.updatedAt = new Date().toISOString();
            await updateRecord(STORE_TRACKED_ITEMS, item);
            plannerExpandedItems.add(String(item.id));
            showToast('Price added to item history.', 'success');
            await renderPlanner();
        } catch (error) {
            console.error('Failed to save item price:', error);
            showToast('Could not save the item price.', 'error');
        }
    });

    itemsContainer.addEventListener('change', async event => {
        if (!(event.target instanceof Element)) return;
        const rangeSelect = event.target.closest('[data-outlook-range]');
        if (!rangeSelect) return;
        const item = plannerItems.find(current => String(current.id) === rangeSelect.getAttribute('data-outlook-range'));
        const range = rangeSelect.value;
        if (!item || !PLANNER_OUTLOOK_RANGES[range]) return;

        try {
            item.outlookRange = range;
            item.updatedAt = new Date().toISOString();
            await updateRecord(STORE_TRACKED_ITEMS, item);
            await renderPlanner();
        } catch (error) {
            console.error('Failed to save tracker outlook range:', error);
            showToast('Could not save the outlook range.', 'error');
        }
    });

    itemsContainer.addEventListener('click', async event => {
        if (!(event.target instanceof Element)) return;
        const editButton = event.target.closest('[data-edit-item]');
        const deleteButton = event.target.closest('[data-delete-item]');
        const priceDeleteButton = event.target.closest('[data-delete-price]');
        if (editButton) {
            plannerEditItem(editButton.getAttribute('data-edit-item'));
            return;
        }
        if (deleteButton && await showConfirm('Delete this tracked item and its price history?')) {
            try {
                const itemId = deleteButton.getAttribute('data-delete-item');
                await remove(STORE_TRACKED_ITEMS, Number(itemId));
                plannerExpandedItems.delete(String(itemId));
                showToast('Tracked item deleted.', 'success');
                await renderPlanner();
            } catch (error) {
                console.error('Failed to delete tracked item:', error);
                showToast('Could not delete the tracked item.', 'error');
            }
            return;
        }
        if (priceDeleteButton && await showConfirm('Delete this price entry?')) {
            try {
                const item = plannerItems.find(current => String(current.id) === priceDeleteButton.getAttribute('data-item-id'));
                if (!item) return;
                item.priceHistory = (Array.isArray(item.priceHistory) ? item.priceHistory : [])
                    .filter(entry => String(entry.id) !== priceDeleteButton.getAttribute('data-delete-price'));
                item.updatedAt = new Date().toISOString();
                await updateRecord(STORE_TRACKED_ITEMS, item);
                plannerExpandedItems.add(String(item.id));
                showToast('Price entry deleted.', 'success');
                await renderPlanner();
            } catch (error) {
                console.error('Failed to delete item price:', error);
                showToast('Could not delete the price entry.', 'error');
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', plannerInit);
