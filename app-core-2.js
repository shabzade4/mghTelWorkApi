        function updateTxCategories() {
            const type = document.getElementById('tx-type').value;
            const cat = document.getElementById('tx-category');
            if (type === 'هزینه') {
                cat.innerHTML = `
                    <option value="خرید روزانه">خرید روزانه</option>
                    <option value="اقساط بانکی">اقساط بانکی</option>
                    <option value="پرداخت بدهی">پرداخت بدهی</option>
                    <option value="دادن قرض">دادن قرض</option>
                    <option value="سرمایه‌گذاری">سرمایه‌گذاری</option>
                    <option value="حمل و نقل">حمل و نقل</option>
                    <option value="خوراک">خوراک</option>
                    <option value="سلامت">سلامت</option>
                    <option value="تفریح">تفریح</option>
                    <option value="سایر">سایر</option>`;
            } else {
                cat.innerHTML = `
                    <option value="حقوق">حقوق</option>
                    <option value="فروش">فروش</option>
                    <option value="پس‌انداز">پس‌انداز</option>
                    <option value="سود سرمایه">سود سرمایه</option>
                    <option value="سایر درآمدها">سایر درآمدها</option>`;
            }
        }

        async function saveTransaction(e) {
            e.preventDefault();
            const id = document.getElementById('tx-id').value;
            const amountRaw = document.getElementById('tx-amount').value;
            const dateVal = document.getElementById('tx-date').value.trim();
            const desc = document.getElementById('tx-desc').value.trim();
            const account = document.getElementById('tx-account').value.trim();

            const err = V.firstError(
                V.amount(amountRaw, true),
                dateVal ? V.jalaliDate(dateVal) : null,
                V.maxLength(desc, 500, 'توضیحات'),
                V.maxLength(account, 50, 'شماره حساب')
            );
            if (err) { toast(err, 'error'); return; }

            const amountVal = parseFloat(V.toEnDigits(String(amountRaw)).replace(/,/g, ''));
            const tType = document.getElementById('tx-type').value;
            const tCat = document.getElementById('tx-category').value;
            const payload = {
                type: tType,
                category: tCat,
                amount: amountVal,
                account: account,
                date: dateVal ? V.toEnDigits(dateVal).replace(/-/g, '/') : '',
                description: desc
            };
            const timeVal = document.getElementById('tx-time').value || '';
            if (timeVal) payload.time = timeVal;

            try {
                let error;
                if (id) {
                    ({ error } = await _supabase.from('transactions').update(payload).eq('id', id));
                    if (error && error.message && (error.message.includes('time') || error.message.includes('column'))) {
                        delete payload.time;
                        ({ error } = await _supabase.from('transactions').update(payload).eq('id', id));
                    }
                    if (error) throw error;
                    await logAction('ویرایش تراکنش', `تراکنش ویرایش شد: ${tCat} ${amountVal}`);
                    toast('تراکنش ویرایش شد');
                } else {
                    ({ error } = await _supabase.from('transactions').insert([payload]));
                    if (error && error.message && (error.message.includes('time') || error.message.includes('column'))) {
                        delete payload.time;
                        ({ error } = await _supabase.from('transactions').insert([payload]));
                    }
                    if (error) throw error;
                    await logAction('ثبت تراکنش', `تراکنش جدید: ${tType} / ${tCat} / ${amountVal}`);
                    toast('تراکنش با موفقیت ثبت شد');
                }
                closeModal('tx-modal');
                await fetchTransactions();
                updateDashboard();
            } catch (err) {
                console.error(err);
                toast('خطا در ثبت تراکنش: ' + (err.message || err), 'error');
                await logAction('خطای تراکنش', String(err.message || err));
            }
        }

        async function fetchTransactions() {
            const data = await safeSelect('transactions');
            const list = document.getElementById('transactions-list');
            if (!list) return;
            const filter = document.getElementById('tx-filter-type')?.value || '';
            const fromD = V.toEnDigits((document.getElementById('tx-filter-from')?.value || '').trim()).replace(/-/g, '/');
            const toD = V.toEnDigits((document.getElementById('tx-filter-to')?.value || '').trim()).replace(/-/g, '/');
            let totalInc = 0, totalExp = 0;

            if (!data || data.length === 0) {
                list.innerHTML = `<p class="text-center text-slate-400 text-sm py-6">تراکنشی ثبت نشده است.</p>`;
                const ti = document.getElementById('total-income');
                const te = document.getElementById('total-expense');
                const nb = document.getElementById('net-balance');
                if (ti) ti.innerText = formatMoney(0);
                if (te) te.innerText = formatMoney(0);
                if (nb) nb.innerText = formatMoney(0);
                updateBudgetStatus(0);
                return;
            }

            list.innerHTML = '';
            let shown = 0;
            for (let item of data) {
                const tType = await toText(item.type);
                if (filter && tType !== filter) continue;
                const tCat = await toText(item.category);
                const tAmt = await toNum(item.amount);
                const tAcc = await toText(item.account);
                const tDate = await toText(item.date);
                const tDateN = V.toEnDigits(String(tDate || '')).replace(/-/g, '/');
                if (fromD && tDateN && tDateN < fromD) continue;
                if (toD && tDateN && tDateN > toD) continue;
                const tTime = item.time ? await toText(item.time) : '';
                const tDesc = await toText(item.description);

                if (tType === 'درآمد') totalInc += tAmt;
                else totalExp += tAmt;
                shown++;

                list.innerHTML += `
                    <div class="list-card flex items-center justify-between p-3.5 gap-2" style="border-color:var(--border)">
                        <div class="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onclick="viewTransaction('${item.id}')">
                            <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tType === 'درآمد' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40' : 'bg-red-100 text-red-600 dark:bg-red-900/40'}">
                                <i data-lucide="${tType === 'درآمد' ? 'arrow-down-left' : 'arrow-up-right'}" class="w-5 h-5"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="font-semibold text-sm">${tCat || '—'}</p>
                                <p class="text-xs text-slate-500 mt-0.5">${tDate || 'بدون تاریخ'}${tTime ? ' · ' + tTime : ''}${tAcc ? ' · ' + tAcc : ''}</p>
                                ${tDesc ? `<p class="text-xs text-slate-400 mt-0.5 truncate">${tDesc}</p>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <span class="font-bold text-sm ltr-num whitespace-nowrap ${tType === 'درآمد' ? 'text-emerald-600' : 'text-red-600'}">${formatNum(tAmt)}</span>
                            <button onclick="event.stopPropagation(); viewTransaction('${item.id}')" class="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600" title="نمایش">
                                <i data-lucide="eye" class="w-4 h-4"></i>
                            </button>
                            <button onclick="event.stopPropagation(); editTransaction('${item.id}')" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="ویرایش">
                                <i data-lucide="pencil" class="w-4 h-4"></i>
                            </button>
                            <button onclick="event.stopPropagation(); deleteItem('transactions', '${item.id}', fetchTransactions)" class="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600" title="حذف">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>`;
            }
            if (shown === 0) {
                list.innerHTML = `<p class="text-center text-slate-400 text-sm py-6">تراکنشی یافت نشد.</p>`;
            }
            document.getElementById('total-income').innerText = formatMoney(totalInc);
            document.getElementById('total-expense').innerText = formatMoney(totalExp);
            document.getElementById('net-balance').innerText = formatMoney(totalInc - totalExp);
            updateBudgetStatus(totalExp);
            lucide.createIcons();
        }

        async function editTransaction(id) {
            let { data } = await _supabase.from('transactions').select('*').eq('id', id).single();
            if (!data) return;
            document.getElementById('tx-id').value = id;
            document.getElementById('tx-modal-title').innerText = 'ویرایش تراکنش';
            document.getElementById('tx-type').value = await toText(data.type) || 'هزینه';
            updateTxCategories();
            setTimeout(async () => {
                document.getElementById('tx-category').value = await toText(data.category) || '';
            }, 50);
            document.getElementById('tx-amount').value = await toNum(data.amount) || '';
            document.getElementById('tx-account').value = await toText(data.account) || '';
            document.getElementById('tx-date').value = await toText(data.date) || '';
            document.getElementById('tx-time').value = data.time ? await toText(data.time) : '';
            document.getElementById('tx-desc').value = await toText(data.description) || '';
            openModal('tx-modal');
        }

        async function viewTransaction(id) {
            let { data } = await _supabase.from('transactions').select('*').eq('id', id).single();
            if (!data) return;
            const tType = await toText(data.type);
            const tCat = await toText(data.category);
            const tAmt = await toNum(data.amount);
            const tAcc = await toText(data.account);
            const tDate = await toText(data.date);
            const tTime = data.time ? await toText(data.time) : '';
            const tDesc = await toText(data.description);
            document.getElementById('detail-title').innerText = 'جزئیات تراکنش';
            document.getElementById('detail-body').innerHTML = `
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between items-center p-3 rounded-xl ${tType==='درآمد'?'bg-emerald-50 dark:bg-emerald-900/30':'bg-red-50 dark:bg-red-900/30'}">
                        <span class="font-medium">${tType}</span>
                        <span class="text-lg font-bold ltr-num ${tType==='درآمد'?'text-emerald-600':'text-red-600'}">${formatMoney(tAmt)}</span>
                    </div>
                    <p><span class="text-slate-500">دسته:</span> <strong>${tCat || '—'}</strong></p>
                    <p><span class="text-slate-500">تاریخ:</span> ${tDate || '—'} ${tTime ? '· ' + tTime : ''}</p>
                    <p><span class="text-slate-500">حساب / کارت:</span> <span class="ltr-num">${tAcc || '—'}</span></p>
                    <p><span class="text-slate-500">توضیحات:</span> ${tDesc || '—'}</p>
                </div>`;
            document.getElementById('detail-actions').innerHTML = `
                <button onclick="editTransaction('${id}'); closeModal('detail-modal')" class="flex-1 btn-primary py-2.5 rounded-xl text-sm">ویرایش</button>
                <button onclick="deleteItem('transactions', '${id}', () => { closeModal('detail-modal'); fetchTransactions(); })" class="flex-1 py-2.5 rounded-xl bg-red-100 text-red-600 text-sm">حذف</button>
            `;
            openModal('detail-modal');
            lucide.createIcons();
        }

        // ==================== LOANS ====================
        let _loanManualMonthly = false;

        // ==================== محاسبه وام بانکی ایران (تومان) ====================
        // 1) amortization: قسط ثابت استاندارد (PMT) + مانده اصل نزولی
        //    M = P * r * (1+r)^n / ((1+r)^n - 1)   که r = نرخ‌سالانه/12
        //    مانده‌اصل پس از k قسط = P * ((1+r)^n - (1+r)^k) / ((1+r)^n - 1)
        // 2) simple: سود ساده بانکی ایران = اصل × نرخ × سال
        //    کل = اصل + سود ، قسط = کل / n ، مانده = قسط × اقساط‌باقی
        function calcIranLoan(principal, annualRatePct, months, paid, fee, method) {
            principal = Math.max(0, Number(principal) || 0);
            const ratePct = Math.max(0, Math.min(100, Number(annualRatePct) || 0));
            months = Math.max(1, parseInt(months, 10) || 1);
            paid = Math.max(0, Math.min(months, parseInt(paid, 10) || 0));
            fee = Math.max(0, Number(fee) || 0);
            method = method || 'amortization';

            let monthly = 0, totalRepay = 0, totalInterest = 0, remainingPrincipal = 0;
            let firstInterest = 0, firstPrincipalPart = 0;

            if (ratePct === 0) {
                // قرض‌الحسنه یا بدون سود
                monthly = principal / months;
                totalRepay = principal;
                totalInterest = 0;
                remainingPrincipal = principal * (months - paid) / months;
                firstPrincipalPart = monthly;
            } else if (method === 'simple') {
                // سود ساده سالانه (رایج در برخی عقود فروش اقساطی)
                const years = months / 12;
                totalInterest = principal * (ratePct / 100) * years;
                totalRepay = principal + totalInterest;
                monthly = totalRepay / months;
                // در سود ساده، «مانده» = مجموع اقساط باقی‌مانده
                remainingPrincipal = monthly * (months - paid);
                firstInterest = totalInterest / months;
                firstPrincipalPart = monthly - firstInterest;
            } else {
                // اقساط ثابت بانکی (مانده نزولی) — استاندارد بین‌المللی و بانک‌های ایران برای بسیاری از تسهیلات
                const r = (ratePct / 100) / 12;
                const pow = Math.pow(1 + r, months);
                monthly = principal * r * pow / (pow - 1);
                totalRepay = monthly * months;
                totalInterest = totalRepay - principal;
                if (paid >= months) {
                    remainingPrincipal = 0;
                } else {
                    const powK = Math.pow(1 + r, paid);
                    remainingPrincipal = principal * (pow - powK) / (pow - 1);
                }
                // قسط اول: بخش سود و اصل
                firstInterest = principal * r;
                firstPrincipalPart = monthly - firstInterest;
            }

            const left = months - paid;
            const remainingPayments = monthly * left; // مجموع اقساط باقی‌مانده (پرداختی آینده)

            return {
                principal: Math.round(principal),
                monthly: Math.round(monthly),
                totalRepay: Math.round(totalRepay),
                totalInterest: Math.round(totalInterest),
                remaining: Math.round(Math.max(0, remainingPrincipal)), // مانده اصل (یا مجموع اقساط در simple)
                remainingPayments: Math.round(Math.max(0, remainingPayments)),
                netReceived: Math.round(Math.max(0, principal - fee)),
                leftInstallments: left,
                firstInterest: Math.round(firstInterest),
                firstPrincipalPart: Math.round(firstPrincipalPart),
                months,
                paid,
                fee: Math.round(fee),
                ratePct,
                method
            };
        }

        function onLoanYearsChange() {
            const y = parseFloat(V.toEnDigits(document.getElementById('loan-years').value || '0'));
            if (y > 0) {
                document.getElementById('loan-count').value = Math.round(y * 12);
            }
            _loanManualMonthly = false;
            recalcLoan();
        }

        function onManualMonthly() {
            _loanManualMonthly = true;
            const monthly = parseFloat(V.toEnDigits(document.getElementById('loan-monthly').value || '0')) || 0;
            const months = parseInt(V.toEnDigits(document.getElementById('loan-count').value || '1'), 10) || 1;
            const paid = parseInt(V.toEnDigits(document.getElementById('loan-paid-count').value || '0'), 10) || 0;
            const principal = parseFloat(V.toEnDigits(document.getElementById('loan-principal').value || '0')) || 0;
            const fee = parseFloat(V.toEnDigits(document.getElementById('loan-fee').value || '0')) || 0;
            const rate = parseFloat(V.toEnDigits(document.getElementById('loan-rate').value || '0')) || 0;
            const method = document.getElementById('loan-calc-method').value || 'amortization';
            const left = Math.max(0, months - paid);
            // با قسط دستی: مانده پرداختی = قسط × باقی؛ اگر نرخ داریم مانده اصل را هم حساب کن
            let remPrincipal = monthly * left;
            if (method === 'amortization' && rate > 0 && principal > 0) {
                const c = calcIranLoan(principal, rate, months, paid, fee, 'amortization');
                remPrincipal = c.remaining;
            }
            document.getElementById('lc-monthly').innerText = formatNum(Math.round(monthly));
            document.getElementById('lc-remaining').innerText = formatNum(Math.round(remPrincipal));
            document.getElementById('lc-left').innerText = formatNum(left);
            document.getElementById('lc-principal').innerText = formatNum(principal);
            document.getElementById('lc-net').innerText = formatNum(Math.max(0, principal - fee));
            document.getElementById('lc-total').innerText = formatNum(Math.round(monthly * months));
            document.getElementById('lc-interest').innerText = formatNum(Math.max(0, Math.round(monthly * months - principal)));
            if (document.getElementById('lc-pay-left')) {
                document.getElementById('lc-pay-left').innerText = formatNum(Math.round(monthly * left));
            }
        }

        function recalcLoan() {
            const principal = parseFloat(V.toEnDigits(document.getElementById('loan-principal').value || '0')) || 0;
            const rate = parseFloat(V.toEnDigits(document.getElementById('loan-rate').value || '0')) || 0;
            const months = parseInt(V.toEnDigits(document.getElementById('loan-count').value || '1'), 10) || 1;
            const paid = parseInt(V.toEnDigits(document.getElementById('loan-paid-count').value || '0'), 10) || 0;
            const fee = parseFloat(V.toEnDigits(document.getElementById('loan-fee').value || '0')) || 0;
            const method = document.getElementById('loan-calc-method').value || 'amortization';
            const loanType = document.getElementById('loan-type').value;
            const effectiveRate = (loanType === 'قرض‌الحسنه') ? 0 : rate;

            const c = calcIranLoan(principal, effectiveRate, months, paid, fee, method);
            if (!_loanManualMonthly) {
                document.getElementById('loan-monthly').value = c.monthly;
            }
            const monthlyShown = _loanManualMonthly
                ? (parseFloat(V.toEnDigits(document.getElementById('loan-monthly').value || '0')) || c.monthly)
                : c.monthly;

            document.getElementById('lc-principal').innerText = formatNum(c.principal);
            document.getElementById('lc-interest').innerText = formatNum(c.totalInterest);
            document.getElementById('lc-total').innerText = formatNum(_loanManualMonthly ? Math.round(monthlyShown * months) : c.totalRepay);
            document.getElementById('lc-monthly').innerText = formatNum(Math.round(monthlyShown));
            document.getElementById('lc-net').innerText = formatNum(c.netReceived);
            document.getElementById('lc-remaining').innerText = formatNum(c.remaining);
            document.getElementById('lc-left').innerText = formatNum(c.leftInstallments);
            if (document.getElementById('lc-pay-left')) {
                document.getElementById('lc-pay-left').innerText = formatNum(Math.round(monthlyShown * c.leftInstallments));
            }
            if (document.getElementById('lc-first-split')) {
                document.getElementById('lc-first-split').innerText =
                    c.ratePct > 0
                        ? `قسط اول ≈ ${formatNum(c.firstPrincipalPart)} اصل + ${formatNum(c.firstInterest)} سود`
                        : 'بدون سود (قرض‌الحسنه)';
            }
            return c;
        }

