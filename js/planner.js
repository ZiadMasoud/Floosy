let plannerSelectedMonth = null;
let plannerEvents = [];
let plannerItems = [];
let plannerPriceCharts = new Map();
let plannerExpandedItems = new Set();
let plannerEventReturnFocus = null;

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
    occurrences.forEach(occurrence => {
        if (!grouped.has(occurrence.date)) grouped.set(occurrence.date, []);
        grouped.get(occurrence.date).push(occurrence.event);
    });

    timeline.innerHTML = Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right))
        .map(([dateString, events]) => {
            const date = parseDateLocal(dateString);
            const formattedDate = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            const rows = events.map(event => `
              <div class="planner-event-row ${event.type}">
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
            return `
              <div class="planner-day">
                <div class="planner-day-date">
                  <span class="planner-timeline-dot" aria-hidden="true"></span>
                  <time datetime="${plannerEscape(dateString)}">${plannerEscape(formattedDate)}</time>
                </div>
                <div class="planner-day-events">${rows}</div>
              </div>`;
        }).join('');
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

function plannerRenderItems() {
    const container = document.getElementById('planner-items');
    if (!container) return;
    plannerDestroyCharts();

    if (!plannerItems.length) {
        container.innerHTML = `
          <div class="planner-empty-state planner-items-empty">
            <i class="fas fa-tags" aria-hidden="true"></i>
            <strong>No tracked items yet</strong>
            <span>Add an item, then log its price each time you want to compare it.</span>
          </div>`;
        return;
    }

    const today = formatDateLocal(new Date());
    container.innerHTML = plannerItems.map(item => {
        const history = Array.isArray(item.priceHistory) ? item.priceHistory : [];
        const sortedHistory = history.slice().sort((left, right) => left.date.localeCompare(right.date));
        const latest = sortedHistory[sortedHistory.length - 1];
        const previous = sortedHistory.length > 1 ? sortedHistory[sortedHistory.length - 2] : null;
        const change = latest && previous && Number(previous.price) > 0
            ? ((Number(latest.price) - Number(previous.price)) / Number(previous.price)) * 100
            : null;
        const frequencyLabels = { weekly: 'Weekly', monthly: 'Monthly', 'as-needed': 'As needed' };
        const frequency = frequencyLabels[item.frequency] || 'As needed';
        const expanded = plannerExpandedItems.has(String(item.id));
        const historyRows = sortedHistory.slice().reverse().map(entry => `
          <li class="planner-price-row">
            <span>${plannerEscape(parseDateLocal(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</span>
            <span class="planner-price-record">${entry.notes ? `<small>${plannerEscape(entry.notes)}</small>` : ''}</span>
            <strong>$${formatCurrency(Number(entry.price) || 0)}</strong>
            <button type="button" class="btn-icon" data-delete-price="${plannerEscape(entry.id)}" data-item-id="${item.id}"
              aria-label="Delete price entry for ${plannerEscape(item.name)}">
              <i class="fas fa-times"></i>
            </button>
          </li>`).join('');

        return `
          <article class="planner-item-card">
            <div class="planner-item-heading">
              <div class="planner-item-name">
                <div>
                  <h4>${plannerEscape(item.name)}</h4>
                  <span>${plannerEscape(frequency)} · descriptive only</span>
                </div>
              </div>
              <div class="planner-item-actions">
                <button type="button" class="btn-icon" data-edit-item="${item.id}" aria-label="Edit ${plannerEscape(item.name)}">
                  <i class="fas fa-pen"></i>
                </button>
                <button type="button" class="btn-icon" data-delete-item="${item.id}" aria-label="Delete ${plannerEscape(item.name)}">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="planner-item-latest">
              <div>
                <span>Latest price</span>
                <strong>${latest ? `$${formatCurrency(Number(latest.price) || 0)}` : 'No prices yet'}</strong>
              </div>
              <span class="planner-price-change ${change === null ? '' : change > 0 ? 'up' : change < 0 ? 'down' : 'steady'}">
                ${change === null ? `${history.length} ${history.length === 1 ? 'entry' : 'entries'}` : `${change > 0 ? '+' : ''}${formatCurrency(change)}% since previous`}
              </span>
            </div>
            <details class="planner-item-details" data-item-details="${item.id}" ${expanded ? 'open' : ''}>
              <summary>${expanded ? 'Hide details' : 'Price history & details'}</summary>
              <div class="planner-item-detail-body">
                ${history.length ? `
                  <div class="planner-price-chart-wrap">
                    <canvas id="planner-chart-${item.id}" aria-label="Price history chart for ${plannerEscape(item.name)}"></canvas>
                  </div>
                  <ul class="planner-price-history">${historyRows}</ul>` : `
                  <div class="planner-no-price-history">
                    <i class="fas fa-chart-line" aria-hidden="true"></i>
                    <span>No price history yet. Add your first price below to start the chart.</span>
                  </div>`}
                <form class="planner-price-form" data-item-id="${item.id}">
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
                </form>
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
                if (item && canvas && !plannerPriceCharts.has(item.id)) plannerRenderPriceChart(item, canvas);
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
            if (summary) summary.textContent = details.open ? 'Hide details' : 'Price history & details';
        });
        if (details.open) {
            const item = plannerItems.find(current => String(current.id) === details.getAttribute('data-item-details'));
            const canvas = details.querySelector('canvas');
            if (item && canvas) plannerRenderPriceChart(item, canvas);
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
            monthDisplay.textContent = new Date()
                .toLocaleString('default', { month: 'long', year: 'numeric' });
        }
        const { year, month } = plannerGetMonthParts();
        plannerEvents = await getAll(STORE_PLANNED_EVENTS);
        plannerItems = await getAll(STORE_TRACKED_ITEMS);
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
    form.hidden = true;
    document.getElementById('planner-item-form-title').textContent = 'Track an item';
}

function plannerEditItem(id) {
    const item = plannerItems.find(current => String(current.id) === String(id));
    const form = document.getElementById('planner-item-form');
    if (!item || !form) return;
    form.elements.id.value = item.id;
    form.elements.name.value = item.name;
    form.elements.frequency.value = item.frequency;
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
        const frequency = String(formData.get('frequency'));
        if (!name || !['weekly', 'monthly', 'as-needed'].includes(frequency)) {
            showToast('Enter an item name and choose a purchase frequency.', 'warning');
            return;
        }

        try {
            const id = formData.get('id');
            const existing = id ? plannerItems.find(item => String(item.id) === String(id)) : null;
            const record = {
                name,
                frequency,
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
