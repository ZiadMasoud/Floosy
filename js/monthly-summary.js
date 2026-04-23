// Monthly Summary PDF Generator
class MonthlySummaryPDF {
    constructor() {
        this.jsPDF = null;
        this.records = [];
        this.categories = [];
        this.people = [];
        this.savingsAccounts = [];
        this.savingsTransactions = [];
        this.isInitialized = false;
        this.arabicFontLoaded = false;

        // Design tokens
        this.colors = {
            primary: [53, 88, 114],   // navy
            success: [16, 185, 129],    // green-500
            danger: [239, 68, 68],    // red-500
            warning: [245, 158, 11],    // amber-500
            info: [122, 170, 206],   // blue
            textDark: [53, 88, 114],    // navy
            textMid: [122, 170, 206],    // blue
            textLight: [156, 213, 255],   // sea
            bgCard: [247, 248, 240],   // cold white
            bgStripe: [237, 240, 232],   // slightly darker cold white
            border: [122, 170, 206],   // blue
            white: [247, 248, 240],
        };

        this.init();
    }

    // ─── Initialisation ────────────────────────────────────────────────────────

    async init() {
        try {
            await this.loadjsPDF();
            await this.loadArabicFont();
            await this.loadData();
            this.populateDateSelectors();
            this.bindEvents();
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize Monthly Summary PDF:', error);
            this.showErrorMessage('Failed to initialize PDF generator. Please refresh page.');
        }
    }

    async loadjsPDF() {
        return new Promise((resolve, reject) => {
            if (window.jspdf && window.jspdf.jsPDF) {
                this.jsPDF = window.jspdf.jsPDF;
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                if (window.jspdf && window.jspdf.jsPDF) { this.jsPDF = window.jspdf.jsPDF; resolve(); }
                else reject(new Error('jsPDF not loaded properly'));
            };
            script.onerror = () => reject(new Error('Failed to load jsPDF'));
            document.head.appendChild(script);
        });
    }

    async loadArabicFont() {
        try {
            // Use a web-safe Arabic font from Google Fonts or CDN
            const fontUrl = 'https://cdn.jsdelivr.net/gh/khaledalam0/WebFont@main/fonts/Cairo/Cairo-Regular.ttf';
            
            const response = await fetch(fontUrl);
            if (!response.ok) throw new Error('Failed to fetch Arabic font');
            
            const fontBytes = await response.arrayBuffer();
            const base64Font = btoa(String.fromCharCode(...new Uint8Array(fontBytes)));
            
            // Store the base64 font for later use
            this.arabicFontBase64 = base64Font;
            this.arabicFontLoaded = true;
            
            console.log('Arabic font loaded successfully');
        } catch (error) {
            console.warn('Failed to load Arabic font, falling back to default:', error);
            this.arabicFontLoaded = false;
        }
    }

    async loadData() {
        if (typeof getAll !== 'function') throw new Error('Database functions not available');
        this.records = await getAll(STORE_RECORDS) || [];
        this.categories = await getAll(STORE_CATEGORIES) || [];
        this.people = await getAll(STORE_PEOPLE) || [];
        this.savingsAccounts = await getAll(STORE_SAVINGS_ACCOUNTS) || [];
        this.savingsTransactions = await getAll(STORE_SAVINGS_TRANSACTIONS) || [];
    }

    populateDateSelectors() {
        const monthSelect = document.getElementById('summary-month-select');
        const yearSelect = document.getElementById('summary-year-select');
        if (!monthSelect || !yearSelect) return;

        monthSelect.innerHTML = '';
        yearSelect.innerHTML = '';

        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const now = new Date();

        months.forEach((m, i) => {
            const o = document.createElement('option');
            o.value = i; o.textContent = m;
            if (i === now.getMonth()) o.selected = true;
            monthSelect.appendChild(o);
        });

        for (let y = now.getFullYear() - 5; y <= now.getFullYear(); y++) {
            const o = document.createElement('option');
            o.value = y; o.textContent = y;
            if (y === now.getFullYear()) o.selected = true;
            yearSelect.appendChild(o);
        }
    }

    bindEvents() {
        const btn = document.getElementById('generate-pdf-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                if (this.isInitialized) this.generatePDF();
                else this.showErrorMessage('PDF generator not ready. Please wait a moment and try again.');
            });
        }
        this.bindCheckboxButtons();
    }

    bindCheckboxButtons() {
        setTimeout(() => {
            const summaryCheckboxes = document.querySelectorAll('.summary-options input[type="checkbox"]');
            summaryCheckboxes.forEach(checkbox => {
                const label = checkbox.closest('.checkbox-label');
                if (!label) return;

                // Clone label to wipe stale listeners
                const freshLabel = label.cloneNode(true);
                label.parentNode.replaceChild(freshLabel, label);
                const freshCheckbox = freshLabel.querySelector('input[type="checkbox"]') || checkbox;

                freshLabel.classList.toggle('checked', freshCheckbox.checked);
                freshCheckbox.addEventListener('change', () => {
                    freshLabel.classList.toggle('checked', freshCheckbox.checked);
                });
            });
        }, 100);
    }

    // ─── Data helpers ───────────────────────────────────────────────────────────

    getMonthRecords(month, year) {
        return this.records.filter(r => {
            const d = new Date(r.date);
            return d.getMonth() === month && d.getFullYear() === year;
        });
    }

    getSavingsTxForMonth(month, year) {
        return this.savingsTransactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === month && d.getFullYear() === year;
        });
    }

    calculateSummary(recs, savingsTx) {
        let totalIncome = 0, totalSpending = 0, totalAR = 0;
        const catBreakdown = {}, incomeBreakdown = {}, peopleBreakdown = {}, dailySpending = {};

        recs.forEach(r => {
            const amt = (parseFloat(r.amount) || 0) * (parseInt(r.quantity) || 1);
            const dateKey = r.date ? r.date.substring(0, 10) : '?';

            if (r.isSavingsTransfer) {
                if (r.type === 'income') {
                    totalSpending += amt;
                    const cat = r.category || 'Savings Transfer';
                    catBreakdown[cat] = (catBreakdown[cat] || 0) + amt;
                    dailySpending[dateKey] = (dailySpending[dateKey] || 0) + amt;
                }
                return;
            }

            if (r.type === 'income') {
                totalIncome += amt;
                const cat = r.category || 'Other Income';
                incomeBreakdown[cat] = (incomeBreakdown[cat] || 0) + amt;
            } else if (r.type === 'spending') {
                totalSpending += amt;
                const cat = r.category || 'Uncategorized';
                catBreakdown[cat] = (catBreakdown[cat] || 0) + amt;
                if (r.person) peopleBreakdown[r.person] = (peopleBreakdown[r.person] || 0) + amt;
                dailySpending[dateKey] = (dailySpending[dateKey] || 0) + amt;
            } else if (r.type === 'account_receivable' && !r.collected) {
                totalAR += Math.max(0, amt - (r.collectedAmount || 0));
            }

            // expand combined transactions
            if (r.formatType === 'combined' && Array.isArray(r.combinedTransactions)) {
                r.combinedTransactions.forEach(ct => {
                    const cAmt = (parseFloat(ct.amount) || 0) * (parseInt(ct.quantity) || 1);
                    if (ct.type === 'spending') {
                        totalSpending += cAmt;
                        const cat = ct.category || 'Uncategorized';
                        catBreakdown[cat] = (catBreakdown[cat] || 0) + cAmt;
                        if (ct.person) peopleBreakdown[ct.person] = (peopleBreakdown[ct.person] || 0) + cAmt;
                        dailySpending[dateKey] = (dailySpending[dateKey] || 0) + cAmt;
                    } else if (ct.type === 'income') {
                        totalIncome += cAmt;
                        const cat = ct.category || 'Other Income';
                        incomeBreakdown[cat] = (incomeBreakdown[cat] || 0) + cAmt;
                    }
                });
            }
        });

        const netSavings = savingsTx.reduce((sum, t) => {
            const a = parseFloat(t.amount) || 0;
            return t.type === 'deposit' ? sum + a : sum - a;
        }, 0);

        const totalSavingsDeposited = savingsTx
            .filter(t => t.type === 'deposit')
            .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

        // Highest spending day
        const peakDay = Object.entries(dailySpending).sort(([, a], [, b]) => b - a)[0] || null;

        // Average daily spending (days that had spending)
        const activeDays = Object.keys(dailySpending).length;
        const avgDailySpending = activeDays > 0 ? totalSpending / activeDays : 0;

        return {
            totalIncome, totalSpending, totalAR, netSavings, totalSavingsDeposited,
            netBalance: totalIncome - totalSpending,
            savingsRate: totalIncome > 0 ? ((totalIncome - totalSpending) / totalIncome) * 100 : 0,
            catBreakdown, incomeBreakdown, peopleBreakdown, dailySpending,
            peakDay, avgDailySpending,
            transactionCount: recs.length,
            incomeCount: recs.filter(r => r.type === 'income' && !r.isSavingsTransfer).length,
            spendingCount: recs.filter(r => r.type === 'spending' || (r.type === 'income' && r.isSavingsTransfer)).length,
        };
    }

    getPrevMonthSummary(month, year) {
        let pm = month - 1, py = year;
        if (pm < 0) { pm = 11; py--; }
        const recs = this.getMonthRecords(pm, py);
        const savingsTx = this.getSavingsTxForMonth(pm, py);
        return this.calculateSummary(recs, savingsTx);
    }

    fmtMoney(n) {
        return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    fmtDelta(current, prev) {
        if (!prev || prev === 0) return null;
        const pct = ((current - prev) / Math.abs(prev)) * 100;
        return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 };
    }

    // ─── Arabic/RTL Text Support ─────────────────────────────────────────────────────

    isArabic(text) {
        if (!text) return false;
        const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        return arabicRegex.test(text);
    }

    containsArabic(text) {
        if (!text) return false;
        return this.isArabic(text);
    }

    reverseText(text) {
        // For RTL display, we need to reverse the text order
        return text.split('').reverse().join('');
    }

    processTextForPDF(text) {
        if (!text) return text;
        
        // Check if text contains Arabic
        if (this.containsArabic(text)) {
            // For PDF rendering, we'll handle Arabic text specially
            return {
                text: text,
                isArabic: true,
                processed: text // We'll process this in the text rendering methods
            };
        }
        
        return {
            text: text,
            isArabic: false,
            processed: text
        };
    }

    setArabicFont(pdf) {
        if (this.arabicFontLoaded && this.arabicFontBase64 && pdf.addFileToVFS && pdf.addFont) {
            try {
                pdf.addFileToVFS('Cairo-Regular.ttf', this.arabicFontBase64);
                pdf.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
                return true;
            } catch (error) {
                console.warn('Failed to set Arabic font:', error);
                return false;
            }
        }
        return false;
    }

    renderText(pdf, textObj, x, y, options = {}) {
        const { text, isArabic, processed } = textObj;
        
        if (isArabic && this.arabicFontLoaded) {
            // Use Arabic font for Arabic text
            const fontSet = this.setArabicFont(pdf);
            if (fontSet) {
                pdf.setFont('Cairo', 'normal');
                // For Arabic, we might need to adjust positioning and handle RTL
                const textOptions = { ...options, align: options.align || 'left' };
                pdf.text(processed, x, y, textOptions);
                // Reset to default font
                pdf.setFont('helvetica', options.fontStyle || 'normal');
                return;
            }
        }
        
        // Fallback to default font handling
        pdf.setFont('helvetica', options.fontStyle || 'normal');
        pdf.text(processed, x, y, options);
    }

    // ─── Main PDF generator ─────────────────────────────────────────────────────

    async generatePDF() {
        if (!this.isInitialized || !this.jsPDF) {
            this.showErrorMessage('PDF generator not ready. Please try again.');
            return;
        }
        try {
            // reload data fresh
            await this.loadData();

            const monthSelect = document.getElementById('summary-month-select');
            const yearSelect = document.getElementById('summary-year-select');
            const month = parseInt(monthSelect.value);
            const year = parseInt(yearSelect.value);

            const options = {
                includeCategories: document.getElementById('include-categories')?.checked ?? true,
                includePeople: document.getElementById('include-people')?.checked ?? true,
                includeSavings: document.getElementById('include-savings')?.checked ?? true,
            };

            const recs = this.getMonthRecords(month, year);
            const savingsTx = this.getSavingsTxForMonth(month, year);
            const summary = this.calculateSummary(recs, savingsTx);
            const prevSummary = this.getPrevMonthSummary(month, year);
            const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });

            const pdf = new this.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = pdf.internal.pageSize.width;
            const pageH = pdf.internal.pageSize.height;
            const margin = 14;
            const contentW = pageW - margin * 2;

            let y = 0;

            // ── Cover header bar ──
            y = this._drawHeader(pdf, monthName, year, pageW, margin);

            // ── KPI row ──
            y = this._drawKPIRow(pdf, summary, prevSummary, margin, contentW, y);

            // ── Insights ──
            y = this._drawInsights(pdf, summary, prevSummary, margin, contentW, y, pageH);

            // ── Income summary ──
            if (Object.keys(summary.incomeBreakdown).length > 0) {
                y = this._checkPage(pdf, y, 50, pageH, margin, pageW);
                y = this._drawIncomeSection(pdf, summary, margin, contentW, y, pageH);
            }

            // ── Category breakdown ──
            if (options.includeCategories && Object.keys(summary.catBreakdown).length > 0) {
                y = this._checkPage(pdf, y, 55, pageH, margin, pageW);
                y = this._drawCategorySection(pdf, summary, margin, contentW, y, pageH);
            }

            // ── People breakdown ──
            if (options.includePeople && Object.keys(summary.peopleBreakdown).length > 0) {
                y = this._checkPage(pdf, y, 50, pageH, margin, pageW);
                y = this._drawPeopleSection(pdf, summary, margin, contentW, y, pageH);
            }

            // ── Savings ──
            if (options.includeSavings) {
                y = this._checkPage(pdf, y, 50, pageH, margin, pageW);
                y = this._drawSavingsSection(pdf, summary, savingsTx, margin, contentW, y, pageH);
            }

            // ── Transaction log (top 20) ──
            y = this._checkPage(pdf, y, 60, pageH, margin, pageW);
            y = this._drawTransactionLog(pdf, recs, margin, contentW, y, pageH);

            // ── Footer on every page ──
            this._drawFooters(pdf, monthName, year, pageW, pageH);

            pdf.save(`Floosy_Summary_${monthName}_${year}.pdf`);
            this.showSuccessMessage('PDF generated successfully!');
        } catch (err) {
            console.error('Error generating PDF:', err);
            this.showErrorMessage(`Failed to generate PDF: ${err.message}`);
        }
    }

    // ─── Drawing helpers ────────────────────────────────────────────────────────

    _c(pdf, color) { pdf.setTextColor(...color); }
    _fc(pdf, color) { pdf.setFillColor(...color); }
    _dc(pdf, color) { pdf.setDrawColor(...color); }

    _checkPage(pdf, y, neededH, pageH, margin, pageW) {
        if (y + neededH > pageH - 20) {
            pdf.addPage();
            // thin top accent bar on continuation pages
            this._fc(pdf, this.colors.primary);
            pdf.rect(0, 0, pageW, 3, 'F');
            return margin + 10;
        }
        return y;
    }

    _sectionTitle(pdf, text, x, y, contentW) {
        this._c(pdf, this.colors.textDark);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(text.toUpperCase(), x, y);

        this._dc(pdf, this.colors.primary);
        pdf.setLineWidth(0.4);
        pdf.line(x, y + 1.5, x + contentW, y + 1.5);
        pdf.setLineWidth(0.2);
        return y + 8;
    }

    _drawHeader(pdf, monthName, year, pageW, margin) {
        const C = this.colors;
        // Gradient-like header: two rects
        this._fc(pdf, C.primary);
        pdf.rect(0, 0, pageW, 30, 'F');
        this._fc(pdf, [42, 69, 89]); // slightly darker navy
        pdf.rect(0, 24, pageW, 6, 'F');

        // App name
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        this._c(pdf, [156, 213, 255]); // sea
        pdf.text('FLOOSY  |  PERSONAL FINANCE', margin, 10);

        // Month title
        pdf.setFontSize(20);
        this._c(pdf, C.white);
        pdf.text(`${monthName} ${year}`, margin, 22);

        // Generated date (right aligned)
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        this._c(pdf, [156, 213, 255]);
        const genDate = new Date().toLocaleDateString('en-US', { dateStyle: 'full' });
        pdf.text(`Generated ${genDate}`, pageW - margin, 22, { align: 'right' });

        return 38;
    }

    _kpiCard(pdf, x, y, w, h, label, value, subLabel, color, prevValue) {
        const C = this.colors;
        // Card shadow simulation
        this._fc(pdf, C.border);
        pdf.roundedRect(x + 0.5, y + 0.5, w, h, 2, 2, 'F');
        // Card background
        this._fc(pdf, C.white);
        pdf.roundedRect(x, y, w, h, 2, 2, 'F');
        // Left accent bar
        this._fc(pdf, color);
        pdf.rect(x, y, 1.5, h, 'F');

        // Label
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        this._c(pdf, C.textLight);
        pdf.text(label.toUpperCase(), x + 5, y + 6);

        // Value
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        this._c(pdf, C.textDark);
        pdf.text(value, x + 5, y + 14);

        // Sub-label / delta
        if (subLabel) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7);
            this._c(pdf, C.textMid);
            pdf.text(subLabel, x + 5, y + 20);
        }

        // Delta arrow vs previous month
        if (prevValue !== undefined && prevValue !== null) {
            const delta = this.fmtDelta(parseFloat(value.replace(/[^0-9.-]/g, '')), prevValue);
            if (delta) {
                const arrow = delta.up ? '^' : 'v';
                const deltaColor = delta.up ? C.success : C.danger;
                pdf.setFontSize(7);
                this._c(pdf, deltaColor);
                pdf.text(`${arrow} ${delta.pct}% vs last month`, x + 5, y + h - 3);
            }
        }
    }

    _drawKPIRow(pdf, sum, prev, margin, contentW, y) {
        const cardW = (contentW - 6) / 4;
        const cardH = 28;
        const C = this.colors;
        const cards = [
            {
                label: 'Total Income',
                value: this.fmtMoney(sum.totalIncome),
                sub: `${sum.incomeCount} transaction${sum.incomeCount !== 1 ? 's' : ''}`,
                color: C.success,
                prev: prev.totalIncome,
            },
            {
                label: 'Total Spending',
                value: this.fmtMoney(sum.totalSpending),
                sub: `${sum.spendingCount} transaction${sum.spendingCount !== 1 ? 's' : ''}`,
                color: C.danger,
                prev: prev.totalSpending,
            },
            {
                label: 'Net Balance',
                value: (sum.netBalance >= 0 ? '+' : '-') + this.fmtMoney(Math.abs(sum.netBalance)),
                sub: 'Income minus spending',
                color: sum.netBalance >= 0 ? C.success : C.danger,
                prev: prev.netBalance,
            },
            {
                label: 'Savings Rate',
                value: sum.savingsRate.toFixed(1) + '%',
                sub: 'Of income retained',
                color: C.info,
                prev: null,
            },
        ];

        cards.forEach((card, i) => {
            this._kpiCard(pdf, margin + i * (cardW + 2), y, cardW, cardH,
                card.label, card.value, card.sub, card.color, card.prev);
        });

        return y + cardH + 8;
    }

    _drawInsights(pdf, sum, prev, margin, contentW, y, pageH) {
        y = this._sectionTitle(pdf, 'Financial Insights', margin, y, contentW);

        const insights = this._buildInsights(sum, prev);
        if (insights.length === 0) {
            this._c(pdf, this.colors.textLight);
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(9);
            pdf.text('No data available for insights this month.', margin, y);
            return y + 10;
        }

        const rowH = 9;
        const halfW = (contentW - 4) / 2;

        insights.slice(0, 6).forEach((ins, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const ix = margin + col * (halfW + 4);
            const iy = y + row * (rowH + 3);

            // Check page
            if (iy + rowH > pageH - 20) return;

            // Background pill
            this._fc(pdf, ins.bg);
            pdf.roundedRect(ix, iy - 5, halfW, rowH + 1, 1.5, 1.5, 'F');

            // Bullet dot
            this._fc(pdf, ins.color);
            pdf.circle(ix + 4, iy - 0.5, 1.5, 'F');

            // Text
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            this._c(pdf, this.colors.textDark);
            pdf.text(ins.title, ix + 9, iy);

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7.5);
            this._c(pdf, this.colors.textMid);
            pdf.text(ins.body, ix + 9, iy + 4);
        });

        const rows = Math.ceil(Math.min(insights.length, 6) / 2);
        return y + rows * (rowH + 3) + 8;
    }

    _buildInsights(sum, prev) {
        const C = this.colors;
        const ins = [];

        // Savings rate
        if (sum.totalIncome > 0) {
            const rate = sum.savingsRate;
            if (rate >= 20) {
                ins.push({
                    color: C.success, bg: [240, 253, 244],
                    title: 'Excellent Savings Rate!',
                    body: `You saved ${rate.toFixed(1)}% of your income this month.`
                });
            } else if (rate >= 10) {
                ins.push({
                    color: C.warning, bg: [255, 253, 235],
                    title: 'Moderate Savings',
                    body: `Savings rate: ${rate.toFixed(1)}%. Aim for 20%+ for financial health.`
                });
            } else if (rate < 0) {
                ins.push({
                    color: C.danger, bg: [254, 242, 242],
                    title: 'Overspending Alert !!',
                    body: `Spending exceeded income by ${this.fmtMoney(Math.abs(sum.netBalance))}.`
                });
            } else {
                ins.push({
                    color: C.danger, bg: [254, 242, 242],
                    title: 'Low Savings Rate',
                    body: `Only ${rate.toFixed(1)}% saved. Consider reducing top spending categories.`
                });
            }
        }

        // MoM spending
        if (prev.totalSpending > 0) {
            const delta = ((sum.totalSpending - prev.totalSpending) / prev.totalSpending) * 100;
            if (delta > 10) {
                ins.push({
                    color: C.danger, bg: [254, 242, 242],
                    title: 'Spending Increased ^',
                    body: `Up ${delta.toFixed(1)}% vs last month (+${this.fmtMoney(sum.totalSpending - prev.totalSpending)}).`
                });
            } else if (delta < -10) {
                ins.push({
                    color: C.success, bg: [240, 253, 244],
                    title: 'Spending Decreased v',
                    body: `Down ${Math.abs(delta).toFixed(1)}% vs last month (saved ${this.fmtMoney(prev.totalSpending - sum.totalSpending)}).`
                });
            } else {
                ins.push({
                    color: C.info, bg: [240, 249, 255],
                    title: 'Stable Spending',
                    body: `Spending is on par with last month (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%).`
                });
            }
        }

        // Top category
        const topCat = Object.entries(sum.catBreakdown).sort(([, a], [, b]) => b - a)[0];
        if (topCat) {
            const pct = sum.totalSpending > 0 ? ((topCat[1] / sum.totalSpending) * 100).toFixed(1) : 0;
            ins.push({
                color: C.primary, bg: [238, 242, 255],
                title: `Top Category: ${topCat[0]}`,
                body: `${this.fmtMoney(topCat[1])} spent (${pct}% of total spending).`
            });
        }

        // Top person
        const topPerson = Object.entries(sum.peopleBreakdown).sort(([, a], [, b]) => b - a)[0];
        if (topPerson) {
            ins.push({
                color: C.warning, bg: [255, 253, 235],
                title: `Top Spender: ${topPerson[0]}`,
                body: `${this.fmtMoney(topPerson[1])} attributed to ${topPerson[0]} this month.`
            });
        }

        // Peak day
        if (sum.peakDay) {
            const [dateKey, amt] = sum.peakDay;
            const dayLabel = new Date(dateKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            ins.push({
                color: C.danger, bg: [254, 242, 242],
                title: `Peak Spending Day: ${dayLabel}`,
                body: `${this.fmtMoney(amt)} spent — highest single day this month.`
            });
        }

        // Avg daily
        if (sum.avgDailySpending > 0) {
            ins.push({
                color: C.info, bg: [240, 249, 255],
                title: 'Avg Daily Spending',
                body: `${this.fmtMoney(sum.avgDailySpending)} per active day (${Object.keys(sum.dailySpending).length} days).`
            });
        }

        // Accounts receivable
        if (sum.totalAR > 0) {
            ins.push({
                color: C.warning, bg: [255, 253, 235],
                title: 'Accounts Receivable',
                body: `${this.fmtMoney(sum.totalAR)} outstanding, not yet counted as income.`
            });
        }

        return ins;
    }

    _drawIncomeSection(pdf, sum, margin, contentW, y, pageH) {
        y = this._sectionTitle(pdf, 'Income Summary', margin, y, contentW);

        const sorted = Object.entries(sum.incomeBreakdown).sort(([, a], [, b]) => b - a);
        const total = sum.totalIncome;
        const C = this.colors;

        // Header row
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        this._c(pdf, C.textLight);
        pdf.text('SOURCE / CATEGORY', margin, y);
        pdf.text('AMOUNT', margin + contentW * 0.45, y);
        pdf.text('SHARE', margin + contentW * 0.62, y);
        pdf.text('BAR', margin + contentW * 0.72, y);
        y += 2;
        this._dc(pdf, C.border);
        pdf.setLineWidth(0.15);
        pdf.line(margin, y, margin + contentW, y);
        y += 5;

        const barAreaW = contentW * 0.25;
        const barX = margin + contentW * 0.72;

        sorted.forEach(([src, amt], i) => {
            if (y + 8 > pageH - 20) {
                y = this._checkPage(pdf, y, 8, pageH, margin, pdf.internal.pageSize.width);
            }

            if (i % 2 === 0) {
                this._fc(pdf, C.bgCard);
                pdf.rect(margin, y - 4.5, contentW, 8, 'F');
            }

            const pct = total > 0 ? (amt / total) : 0;
            const barW = pct * barAreaW;

            // Process text for Arabic support
            const srcText = this.processTextForPDF(src.substring(0, 28));

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            this._c(pdf, C.textDark);
            this.renderText(pdf, srcText, margin + 2, y);

            this._c(pdf, C.success);
            pdf.text(this.fmtMoney(amt), margin + contentW * 0.45, y);

            this._c(pdf, C.textMid);
            pdf.text((pct * 100).toFixed(1) + '%', margin + contentW * 0.62, y);

            // Bar track
            this._fc(pdf, C.bgStripe);
            pdf.roundedRect(barX, y - 3.5, barAreaW, 4, 1, 1, 'F');
            if (barW > 0) {
                this._fc(pdf, C.success);
                pdf.roundedRect(barX, y - 3.5, barW, 4, 1, 1, 'F');
            }
            y += 8;
        });

        // Total row
        this._dc(pdf, C.border);
        pdf.setLineWidth(0.2);
        pdf.line(margin, y, margin + contentW, y);
        y += 4;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        this._c(pdf, C.textDark);
        pdf.text('TOTAL INCOME', margin + 2, y);
        this._c(pdf, C.success);
        pdf.text(this.fmtMoney(total), margin + contentW * 0.45, y);

        return y + 12;
    }

    _drawCategorySection(pdf, sum, margin, contentW, y, pageH) {

        y = this._sectionTitle(pdf, 'Spending by Category', margin, y, contentW);

        const sorted = Object.entries(sum.catBreakdown).sort(([, a], [, b]) => b - a).slice(0, 12);
        const total = sum.totalSpending;
        const C = this.colors;

        // Header row
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        this._c(pdf, C.textLight);
        pdf.text('CATEGORY', margin, y);
        pdf.text('AMOUNT', margin + contentW * 0.45, y);
        pdf.text('SHARE', margin + contentW * 0.62, y);
        pdf.text('BAR', margin + contentW * 0.72, y);
        y += 2;
        this._dc(pdf, C.border);
        pdf.setLineWidth(0.15);
        pdf.line(margin, y, margin + contentW, y);
        y += 5;

        const barAreaW = contentW * 0.25;
        const barX = margin + contentW * 0.72;

        sorted.forEach(([cat, amt], i) => {
            if (y + 8 > pageH - 20) {
                y = this._checkPage(pdf, y, 8, pageH, margin, pdf.internal.pageSize.width);
            }

            if (i % 2 === 0) {
                this._fc(pdf, C.bgCard);
                pdf.rect(margin, y - 4.5, contentW, 8, 'F');
            }

            const pct = total > 0 ? (amt / total) : 0;
            const barW = pct * barAreaW;
            const barColor = i === 0 ? C.danger : i === 1 ? C.warning : C.primary;

            // Process text for Arabic support
            const catText = this.processTextForPDF(cat.substring(0, 28));

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            this._c(pdf, C.textDark);
            this.renderText(pdf, catText, margin + 2, y);

            this._c(pdf, C.textDark);
            pdf.text(this.fmtMoney(amt), margin + contentW * 0.45, y);

            this._c(pdf, C.textMid);
            pdf.text((pct * 100).toFixed(1) + '%', margin + contentW * 0.62, y);

            // Progress bar track
            this._fc(pdf, C.bgStripe);
            pdf.roundedRect(barX, y - 3.5, barAreaW, 4, 1, 1, 'F');
            // Fill
            if (barW > 0) {
                this._fc(pdf, barColor);
                pdf.roundedRect(barX, y - 3.5, barW, 4, 1, 1, 'F');
            }

            y += 8;
        });

        // Total row
        this._dc(pdf, C.border);
        pdf.setLineWidth(0.2);
        pdf.line(margin, y, margin + contentW, y);
        y += 4;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        this._c(pdf, C.textDark);
        pdf.text('TOTAL SPENDING', margin + 2, y);
        pdf.text(this.fmtMoney(total), margin + contentW * 0.45, y);

        return y + 10;
    }

    _drawPeopleSection(pdf, sum, margin, contentW, y, pageH) {
        y = this._sectionTitle(pdf, 'Spending by Person', margin, y, contentW);

        const sorted = Object.entries(sum.peopleBreakdown).sort(([, a], [, b]) => b - a).slice(0, 8);
        const total = sum.totalSpending;
        const C = this.colors;
        const halfW = (contentW - 6) / 2;

        sorted.forEach(([person, amt], i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const px = margin + col * (halfW + 6);
            const py = y + row * 18;

            if (py + 16 > pageH - 20) return;

            const pct = total > 0 ? (amt / total) * 100 : 0;
            const barW = (pct / 100) * (halfW - 16);

            // Card backdrop
            this._fc(pdf, C.bgCard);
            pdf.roundedRect(px, py - 2, halfW, 16, 1.5, 1.5, 'F');

            // Process person name for Arabic support
            const personText = this.processTextForPDF(person.substring(0, 20));
            const firstChar = person.charAt(0).toUpperCase();

            // Avatar circle
            const avatarColors = [C.primary, C.success, C.warning, C.info, C.danger];
            this._fc(pdf, avatarColors[i % avatarColors.length]);
            pdf.circle(px + 7, py + 5, 4, 'F');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(7);
            this._c(pdf, C.white);
            pdf.text(firstChar, px + 7, py + 7, { align: 'center' });

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            this._c(pdf, C.textDark);
            this.renderText(pdf, personText, px + 14, py + 3);

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7.5);
            this._c(pdf, C.textMid);
            pdf.text(`${this.fmtMoney(amt)} · ${pct.toFixed(1)}%`, px + 14, py + 8);

            // Mini progress bar
            this._fc(pdf, C.bgStripe);
            pdf.roundedRect(px + 14, py + 10, halfW - 16, 2.5, 0.5, 0.5, 'F');
            if (barW > 0) {
                this._fc(pdf, avatarColors[i % avatarColors.length]);
                pdf.roundedRect(px + 14, py + 10, barW, 2.5, 0.5, 0.5, 'F');
            }
        });

        const rows = Math.ceil(sorted.length / 2);
        return y + rows * 18 + 8;
    }

    _drawSavingsSection(pdf, sum, savingsTx, margin, contentW, y, pageH) {
        y = this._sectionTitle(pdf, 'Savings Overview', margin, y, contentW);
        const C = this.colors;

        if (savingsTx.length === 0 && this.savingsAccounts.length === 0) {
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(9);
            this._c(pdf, C.textLight);
            pdf.text('No savings data found for this month.', margin, y);
            return y + 12;
        }

        // Two stat boxes
        const boxW = (contentW - 4) / 2;
        const boxH = 20;

        const boxes = [
            {
                label: 'Net Saved This Month', value: (sum.netSavings >= 0 ? '+' : '-') + this.fmtMoney(Math.abs(sum.netSavings)),
                color: sum.netSavings >= 0 ? C.success : C.danger
            },
            { label: 'Total Deposited', value: this.fmtMoney(sum.totalSavingsDeposited), color: C.info },
        ];

        boxes.forEach((box, i) => {
            const bx = margin + i * (boxW + 4);
            this._fc(pdf, box.color);
            pdf.roundedRect(bx, y, boxW, boxH, 2, 2, 'F');
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7);
            this._c(pdf, [220, 240, 255]);
            pdf.text(box.label.toUpperCase(), bx + 5, y + 7);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(13);
            this._c(pdf, C.white);
            pdf.text(box.value, bx + 5, y + 16);
        });
        y += boxH + 8;

        // Per-account breakdown
        if (this.savingsAccounts.length > 0) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            this._c(pdf, C.textMid);
            pdf.text('ACCOUNT', margin, y);
            pdf.text('DEPOSITS', margin + contentW * 0.45, y);
            pdf.text('WITHDRAWALS', margin + contentW * 0.65, y);
            pdf.text('NET', margin + contentW * 0.88, y);
            y += 2;
            this._dc(pdf, C.border);
            pdf.setLineWidth(0.15);
            pdf.line(margin, y, margin + contentW, y);
            y += 5;

            this.savingsAccounts.forEach((acc, i) => {
                if (y + 8 > pageH - 20) return;
                const accTx = savingsTx.filter(t => t.accountId === acc.id);
                const deps = accTx.filter(t => t.type === 'deposit').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
                const withs = accTx.filter(t => t.type === 'withdrawal').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
                const net = deps - withs;

                if (i % 2 === 0) { this._fc(pdf, C.bgCard); pdf.rect(margin, y - 4, contentW, 8, 'F'); }

                // Process account name for Arabic support
                const accountText = this.processTextForPDF(acc.name.substring(0, 25));

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8.5);
                this._c(pdf, C.textDark);
                this.renderText(pdf, accountText, margin + 2, y);
                pdf.text(this.fmtMoney(deps), margin + contentW * 0.45, y);
                pdf.text(this.fmtMoney(withs), margin + contentW * 0.65, y);
                this._c(pdf, net >= 0 ? C.success : C.danger);
                pdf.text((net >= 0 ? '+' : '-') + this.fmtMoney(Math.abs(net)), margin + contentW * 0.88, y);
                y += 8;
            });
        }

        return y + 10;
    }

    _drawTransactionLog(pdf, recs, margin, contentW, y, pageH) {
        y = this._sectionTitle(pdf, 'Recent Transactions (up to 20)', margin, y, contentW);
        const C = this.colors;

        if (recs.length === 0) {
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(9);
            this._c(pdf, C.textLight);
            pdf.text('No transactions found for this month.', margin, y);
            return y + 12;
        }

        // Column headers
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        this._c(pdf, C.textLight);
        pdf.text('DATE', margin, y);
        pdf.text('TYPE', margin + 22, y);
        pdf.text('ITEM / DESCRIPTION', margin + 42, y);
        pdf.text('CATEGORY', margin + contentW * 0.62, y);
        pdf.text('AMOUNT', margin + contentW * 0.88, y, { align: 'right' });
        y += 2;
        this._dc(pdf, C.border);
        pdf.setLineWidth(0.15);
        pdf.line(margin, y, margin + contentW, y);
        y += 5;

        const recentRecs = [...recs]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 20);

        recentRecs.forEach((r, i) => {
            if (y + 7 > pageH - 20) {
                pdf.addPage();
                this._fc(pdf, C.primary);
                pdf.rect(0, 0, pdf.internal.pageSize.width, 3, 'F');
                y = margin + 10;
                // Re-draw headers
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7.5);
                this._c(pdf, C.textLight);
                pdf.text('DATE', margin, y);
                pdf.text('TYPE', margin + 22, y);
                pdf.text('ITEM / DESCRIPTION', margin + 42, y);
                pdf.text('CATEGORY', margin + contentW * 0.62, y);
                pdf.text('AMOUNT', margin + contentW * 0.88, y, { align: 'right' });
                y += 2;
                this._dc(pdf, C.border);
                pdf.setLineWidth(0.15);
                pdf.line(margin, y, margin + contentW, y);
                y += 5;
            }

            if (i % 2 === 0) { this._fc(pdf, C.bgCard); pdf.rect(margin, y - 3.5, contentW, 7.5, 'F'); }

            const d = new Date(r.date);
            const dateStr = `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleString('default', { month: 'short' })}`;
            // Add timestamp if available
            let timeStr = '';
            if (r.timestamp) {
                const txDate = new Date(r.timestamp);
                timeStr = txDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            }
            const typeColor = r.type === 'income' ? C.success : r.type === 'account_receivable' ? C.info : C.danger;
            const typeLabel = r.type === 'income' ? 'INC' : r.type === 'account_receivable' ? 'A/R' : 'EXP';
            const amt = (parseFloat(r.amount) || 0) * (parseInt(r.quantity) || 1);
            const rawItem = r.item || r.notes || (r.formatType === 'combined' ? 'Combined tx' : '—');
            const item = rawItem.substring(0, 30);

            // Process text for Arabic support
            const itemText = this.processTextForPDF(item);
            const categoryText = this.processTextForPDF((r.category || '-').substring(0, 18));

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);

            this._c(pdf, C.textMid);
            pdf.text(dateStr, margin, y);
            // Show time below date if available
            if (timeStr) {
                pdf.setFontSize(6);
                pdf.text(timeStr, margin, y + 3);
                pdf.setFontSize(8);
            }

            // Type badge
            this._fc(pdf, typeColor.map(v => Math.min(255, v + 170)));
            pdf.roundedRect(margin + 22, y - 3.5, 14, 5.5, 1, 1, 'F');
            this._c(pdf, typeColor);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(6.5);
            pdf.text(typeLabel, margin + 22 + 7, y, { align: 'center' });

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            this._c(pdf, C.textDark);
            this.renderText(pdf, itemText, margin + 42, y);

            this._c(pdf, C.textMid);
            this.renderText(pdf, categoryText, margin + contentW * 0.62, y);

            this._c(pdf, typeColor);
            pdf.setFont('helvetica', 'bold');
            pdf.text((r.type === 'income' ? '+' : '-') + this.fmtMoney(amt), margin + contentW * 0.88, y, { align: 'right' });
            pdf.setFont('helvetica', 'normal');

            y += 7.5;
        });

        return y + 8;
    }

    _drawFooters(pdf, monthName, year, pageW, pageH) {
        const C = this.colors;
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            // Footer bar
            this._fc(pdf, C.bgCard);
            pdf.rect(0, pageH - 12, pageW, 12, 'F');
            this._dc(pdf, C.border);
            pdf.setLineWidth(0.2);
            pdf.line(0, pageH - 12, pageW, pageH - 12);

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7);
            this._c(pdf, C.textLight);
            pdf.text(`Floosy | ${monthName} ${year} Summary`, 14, pageH - 5);
            pdf.text(`Page ${i} of ${pageCount}`, pageW - 14, pageH - 5, { align: 'right' });
        }
    }

    // ─── Toast messages ───────────────────────────────────────────────────────

    showSuccessMessage(msg) { this._toast(msg, '#10b981'); }
    showErrorMessage(msg) { this._toast(msg, '#ef4444'); }

    _toast(message, bg) {
        document.querySelector('.pdf-message')?.remove();
        const div = document.createElement('div');
        div.className = 'pdf-message';
        div.style.cssText = `
            position:fixed;top:20px;right:20px;padding:1rem 1.5rem;
            border-radius:8px;color:white;font-weight:500;z-index:9999;
            animation:slideIn 0.3s ease-out;background:${bg};
            box-shadow:0 4px 12px rgba(0,0,0,.15);`;
        div.textContent = message;
        document.body.appendChild(div);
        setTimeout(() => div.parentNode && div.remove(), 3500);
    }
}

// Initialise when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (document.getElementById('generate-pdf-btn')) {
            new MonthlySummaryPDF();
        }
    }, 1000);
});
