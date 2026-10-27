        function openLoanModal(item = null) {
            document.getElementById('loan-id').value = item ? item.id : '';
            document.getElementById('loan-modal-title').innerText = item ? 'ویرایش وام' : 'ثبت وام جدید';
            _loanManualMonthly = false;
            if (!item) {
                document.getElementById('loan-title').value = '';
                document.getElementById('loan-type').value = 'مرابحه';
                document.getElementById('loan-bank').value = '';
                document.getElementById('loan-calc-method').value = 'amortization';
                // پیش‌فرض بانکی ایران: نرخ ۲۳٪ · مدت ۵ سال (۶۰ قسط)
                document.getElementById('loan-principal').value = '';
                document.getElementById('loan-rate').value = '23';
                document.getElementById('loan-years').value = '5';
                document.getElementById('loan-count').value = '60';
                document.getElementById('loan-fee').value = '0';
                document.getElementById('loan-paid-count').value = '0';
                document.getElementById('loan-monthly').value = '';
                document.getElementById('loan-date').value = '';
                document.getElementById('loan-desc').value = '';
                recalcLoan();
            }
            openModal('loan-modal');
            setTimeout(() => { bindNumericInputs(); recalcLoan(); }, 100);
        }

        async function saveLoan(e) {
            e.preventDefault();
            const id = document.getElementById('loan-id').value;
            const title = document.getElementById('loan-title').value.trim();
            const principalRaw = document.getElementById('loan-principal').value;
            const rateRaw = document.getElementById('loan-rate').value;
            const countRaw = document.getElementById('loan-count').value;
            const paidRaw = document.getElementById('loan-paid-count').value;
            const feeRaw = document.getElementById('loan-fee').value;
            const monthlyRaw = document.getElementById('loan-monthly').value;
            const dueDay = document.getElementById('loan-date').value.trim();
            const desc = document.getElementById('loan-desc').value.trim();

            const err = V.firstError(
                V.required(title, 'عنوان وام'),
                V.minLength(title, 2, 'عنوان وام'),
                V.amount(principalRaw, true),
                V.positiveInt(countRaw, true, 1, 600),
                paidRaw !== '' ? V.positiveInt(paidRaw, false, 0, 600) : null,
                monthlyRaw ? V.amount(monthlyRaw, true) : null,
                dueDay ? V.jalaliDate(dueDay) : null,
                V.maxLength(desc, 500, 'توضیحات')
            );
            if (err) { toast(err, 'error'); return; }

            const principal = parseFloat(V.toEnDigits(String(principalRaw)).replace(/,/g, ''));
            const rate = parseFloat(V.toEnDigits(String(rateRaw || '0'))) || 0;
            const totalCount = parseInt(V.toEnDigits(String(countRaw)), 10);
            const paidCount = parseInt(V.toEnDigits(String(paidRaw || '0')), 10) || 0;
            const fee = parseFloat(V.toEnDigits(String(feeRaw || '0')).replace(/,/g, '')) || 0;
            if (paidCount > totalCount) { toast('اقساط پرداخت‌شده بیشتر از کل اقساط است', 'error'); return; }

            const method = document.getElementById('loan-calc-method').value || 'amortization';
            const loanType = document.getElementById('loan-type').value;
            const effectiveRate = (loanType === 'قرض‌الحسنه') ? 0 : rate;
            const c = calcIranLoan(principal, effectiveRate, totalCount, paidCount, fee, method);
            const monthly = _loanManualMonthly
                ? Math.round(parseFloat(V.toEnDigits(String(monthlyRaw)).replace(/,/g, '')) || c.monthly)
                : c.monthly;
            const remaining = _loanManualMonthly
                ? Math.round(Math.max(0, monthly * (totalCount - paidCount)))
                : c.remaining;

            const payload = {
                title,
                loan_type: loanType,
                total_amount: principal,
                bank_fee: fee,
                net_received: c.netReceived,
                monthly_payment: monthly,
                total_installments: totalCount,
                paid_installments: paidCount,
                remaining_amount: remaining,
                due_day: dueDay || '',
                description: desc || ''
            };
            // optional extended fields if columns exist
            payload.interest_rate = rate;
            payload.calc_method = method;
            payload.total_interest = c.totalInterest;
            payload.total_repay = Math.round(monthly * totalCount);
            const bank = document.getElementById('loan-bank').value || '';
            if (bank) payload.bank = bank;

            try {
                let error;
                const trySave = async (p) => {
                    if (id) return await _supabase.from('loans').update(p).eq('id', id);
                    return await _supabase.from('loans').insert([p]);
                };
                ({ error } = await trySave(payload));
                if (error && error.message && error.message.includes('column')) {
                    // fallback core columns only
                    const core = {
                        title: payload.title,
                        loan_type: payload.loan_type,
                        total_amount: payload.total_amount,
                        bank_fee: payload.bank_fee,
                        net_received: payload.net_received,
                        monthly_payment: payload.monthly_payment,
                        total_installments: payload.total_installments,
                        paid_installments: payload.paid_installments,
                        remaining_amount: payload.remaining_amount,
                        due_day: payload.due_day,
                        description: payload.description
                    };
                    ({ error } = await trySave(core));
                }
                if (error) throw error;
                await logAction(id ? 'ویرایش وام' : 'ثبت وام', `وام «${title}» | اصل ${formatMoney(principal)} | نرخ ${rate}٪ | مانده ${formatMoney(remaining)}`);
                toast(id ? 'وام ویرایش شد' : 'وام با موفقیت ثبت شد');
                closeModal('loan-modal');
                await fetchLoans();
                updateDashboard();
            } catch (err) {
                console.error(err);
                toast('خطا در ثبت وام: ' + (err.message || err), 'error');
                await logAction('خطای وام', String(err.message || err));
            }
        }

        async function fetchLoans() {
            const data = await safeSelect('loans', 'id');
            const list = document.getElementById('loans-list');
            if (!list) return;
            let totalRemaining = 0;

            if (!data || data.length === 0) {
                list.innerHTML = `<p class="text-center text-slate-400 text-sm py-4">وامی ثبت نشده است.</p>`;
                document.getElementById('total-loans-remaining').innerText = formatMoney(0);
                return;
            }

            list.innerHTML = '';
            for (let item of data) {
                const title = await toText(item.title);
                const lType = await toText(item.loan_type);
                const bank = item.bank ? await toText(item.bank) : '';
                const totAmt = await toNum(item.total_amount);
                const bFee = await toNum(item.bank_fee);
                const netRec = await toNum(item.net_received);
                const mPay = await toNum(item.monthly_payment);
                const remAmt = await toNum(item.remaining_amount);
                const dDay = await toText(item.due_day);
                totalRemaining += remAmt;

                const progress = item.total_installments > 0 ? Math.round((item.paid_installments / item.total_installments) * 100) : 0;

                const rate = item.interest_rate != null ? Number(item.interest_rate) : null;
                list.innerHTML += `
                    <div class="p-4 rounded-xl border" style="border-color:var(--border)">
                        <div class="flex justify-between items-start gap-2">
                            <div>
                                <p class="font-bold text-sm">${title}</p>
                                <p class="text-xs text-slate-500 mt-0.5">${lType || 'وام'} ${bank ? '· ' + bank : ''}${rate != null ? ' · نرخ ' + rate + '٪' : ''}</p>
                            </div>
                            <div class="flex gap-1">
                                <button onclick="editLoan('${item.id}')" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                                <button onclick="deleteItem('loans', '${item.id}', fetchLoans)" class="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                            <div><span class="text-slate-500">اصل:</span> <span class="font-medium ltr-num">${formatMoney(totAmt)}</span></div>
                            <div><span class="text-slate-500">قسط:</span> <span class="font-medium ltr-num">${formatMoney(mPay)}</span></div>
                            <div><span class="text-slate-500">خالص دریافتی:</span> <span class="font-medium ltr-num">${formatMoney(netRec)}</span></div>
                            <div><span class="text-slate-500">مانده:</span> <span class="font-bold text-amber-600 ltr-num">${formatMoney(remAmt)}</span></div>
                        </div>
                        <div class="mt-3">
                            <div class="flex justify-between text-xs mb-1">
                                <span>${item.paid_installments || 0} از ${item.total_installments || 0} قسط پرداخت شده</span>
                                <span>${progress}٪</span>
                            </div>
                            <div class="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div class="h-full bg-emerald-500 rounded-full transition-all" style="width:${progress}%"></div>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2 mt-3">
                            ${(item.paid_installments || 0) < (item.total_installments || 0) ? `<button type="button" onclick="payLoanInstallment('${item.id}')" class="btn-success text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"><i data-lucide="banknote" class="w-3.5 h-3.5"></i> ثبت پرداخت قسط</button>` : '<span class="text-xs text-emerald-600 font-medium">✓ تسویه شده</span>'}
                            ${dDay ? `<span class="text-xs text-slate-500 self-center">سررسید: ${dDay}</span>` : ''}
                        </div>
                    </div>`;
            }
            document.getElementById('total-loans-remaining').innerText = formatMoney(totalRemaining);
            lucide.createIcons();
        }

        async function payLoanInstallment(loanId) {
            try {
                const { data: loan, error } = await _supabase.from('loans').select('*').eq('id', loanId).single();
                if (error || !loan) { toast('وام یافت نشد', 'error'); return; }
                const paid = parseInt(loan.paid_installments || 0, 10);
                const total = parseInt(loan.total_installments || 0, 10);
                if (paid >= total) { toast('همه اقساط پرداخت شده', 'info'); return; }
                const monthly = await toNum(loan.monthly_payment);
                const principal = await toNum(loan.total_amount);
                const rate = loan.interest_rate != null ? Number(loan.interest_rate) : 0;
                const method = loan.calc_method || 'amortization';
                const fee = await toNum(loan.bank_fee);
                const newPaid = paid + 1;
                const c = calcIranLoan(principal, rate, total || 1, newPaid, fee, method);
                const remaining = c.remaining;

                if (!confirm(`ثبت پرداخت قسط ${newPaid} از ${total} به مبلغ ${formatMoney(monthly)}؟\nمانده پس از پرداخت: ${formatMoney(remaining)}`)) return;

                const patch = {
                    paid_installments: newPaid,
                    remaining_amount: remaining
                };
                let { error: uErr } = await _supabase.from('loans').update(patch).eq('id', loanId);
                if (uErr) throw uErr;

                // ثبت در loan_payments (اگر جدول باشد)
                try {
                    const today = getCurrentJalaliYM();
                    const paidAt = `${today.y}/${String(today.m).padStart(2,'0')}/${String(today.d).padStart(2,'0')}`;
                    await _supabase.from('loan_payments').insert([{
                        loan_id: loanId,
                        installment_no: newPaid,
                        amount: monthly,
                        paid_at: paidAt,
                        note: 'پرداخت از برنامه'
                    }]);
                } catch (e) { /* جدول اختیاری */ }

                // تراکنش هزینه قسط
                try {
                    const today = getCurrentJalaliYM();
                    const d = `${today.y}/${String(today.m).padStart(2,'0')}/${String(today.d).padStart(2,'0')}`;
                    await _supabase.from('transactions').insert([{
                        type: 'هزینه',
                        category: 'قسط وام',
                        amount: monthly,
                        account: 'نقد',
                        date: d,
                        description: `قسط ${newPaid}/${total} — ${await toText(loan.title)}`
                    }]);
                } catch (e) {}

                await logAction('پرداخت قسط', `وام ${await toText(loan.title)} · قسط ${newPaid}/${total} · ${formatMoney(monthly)}`);
                toast('قسط با موفقیت ثبت شد');
                await fetchLoans();
                await fetchTransactions();
                updateDashboard();
            } catch (err) {
                console.error(err);
                toast('خطا در ثبت قسط: ' + (err.message || err), 'error');
            }
        }

        // ==================== BUDGET ====================
        function loadBudget() {
            const el = document.getElementById('budget-limit');
            if (!el) return;
            const v = localStorage.getItem('mgh_budget_limit') || '';
            el.value = v;
        }
        function saveBudget() {
            const el = document.getElementById('budget-limit');
            const v = V.toEnDigits((el?.value || '').trim()).replace(/[^\d]/g, '');
            localStorage.setItem('mgh_budget_limit', v);
            toast('بودجه ماهانه ذخیره شد');
            const expText = document.getElementById('total-expense')?.innerText || '0';
            const exp = parseFloat(V.toEnDigits(expText).replace(/[^\d.]/g, '')) || 0;
            updateBudgetStatus(exp);
        }
        function updateBudgetStatus(totalExpense) {
            const box = document.getElementById('budget-status');
            const el = document.getElementById('budget-limit');
            if (!box) return;
            const limit = parseFloat(V.toEnDigits((el?.value || localStorage.getItem('mgh_budget_limit') || '0')).replace(/[^\d]/g, '')) || 0;
            if (!limit) {
                box.innerHTML = '<p class="text-xs text-slate-400">بودجه‌ای تعریف نشده. سقف هزینه ماه را وارد و ذخیره کنید.</p>';
                return;
            }
            const used = totalExpense || 0;
            const pct = Math.min(100, Math.round((used / limit) * 100));
            const left = Math.max(0, limit - used);
            const over = used > limit;
            box.innerHTML = `
                <div class="flex justify-between text-xs mb-1">
                    <span>مصرف: <strong class="ltr-num">${formatNum(used)}</strong> از <span class="ltr-num">${formatNum(limit)}</span></span>
                    <span class="${over ? 'text-red-600 font-bold' : 'text-emerald-600'}">${over ? 'تجاوز از بودجه!' : 'مانده ' + formatNum(left)}</span>
                </div>
                <div class="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width:${Math.min(100,pct)}%"></div>
                </div>
                <p class="text-[10px] text-slate-400 mt-1">${pct}٪ بودجه مصرف شده</p>`;
        }

        // ==================== GLOBAL SEARCH ====================
        let _gsTimer = null;
        function onGlobalSearch() {
            clearTimeout(_gsTimer);
            _gsTimer = setTimeout(runGlobalSearch, 280);
        }
        function clearGlobalSearch() {
            const inp = document.getElementById('global-search');
            if (inp) inp.value = '';
            const box = document.getElementById('global-search-results');
            if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
        }
        async function runGlobalSearch() {
            const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();
            const box = document.getElementById('global-search-results');
            if (!box) return;
            if (q.length < 2) { box.classList.add('hidden'); box.innerHTML = ''; return; }
            box.classList.remove('hidden');
            box.innerHTML = '<p class="p-2 text-slate-400 text-xs">جستجو...</p>';
            const hits = [];
            try {
                const [contacts, tasks, notes, txs, loans] = await Promise.all([
                    safeSelect('contacts'), safeSelect('tasks'), safeSelect('notes'),
                    safeSelect('transactions'), safeSelect('loans', 'id')
                ]);
                (contacts || []).forEach(c => {
                    const blob = [c.name, c.mobile, c.phones, c.email, c.category].join(' ').toLowerCase();
                    if (blob.includes(q)) hits.push({ type: 'مخاطب', title: c.name, sub: c.mobile || c.phones || '', tab: 'contacts', id: c.id, action: `viewContact('${c.id}')` });
                });
                (tasks || []).forEach(t => {
                    const blob = [t.title, t.description, t.status].join(' ').toLowerCase();
                    if (blob.includes(q)) hits.push({ type: 'کار', title: t.title, sub: t.due_date || t.status || '', tab: 'tasks', id: t.id, action: `viewTask('${t.id}')` });
                });
                (notes || []).forEach(n => {
                    const blob = [n.title, n.content, n.category].join(' ').toLowerCase();
                    if (blob.includes(q)) hits.push({ type: 'یادداشت', title: n.title, sub: n.category || '', tab: 'notes', id: n.id, action: `viewNote('${n.id}')` });
                });
                for (const x of (txs || [])) {
                    const type = await toText(x.type);
                    const cat = await toText(x.category);
                    const desc = await toText(x.description);
                    const blob = [type, cat, desc].join(' ').toLowerCase();
                    if (blob.includes(q)) hits.push({ type: 'تراکنش', title: cat || type, sub: formatMoney(await toNum(x.amount)), tab: 'finance', id: x.id, action: `viewTransaction('${x.id}')` });
                }
                for (const l of (loans || [])) {
                    const title = await toText(l.title);
                    const bank = l.bank ? await toText(l.bank) : '';
                    const blob = [title, bank, l.loan_type].join(' ').toLowerCase();
                    if (blob.includes(q)) hits.push({ type: 'وام', title, sub: 'مانده ' + formatMoney(await toNum(l.remaining_amount)), tab: 'finance', id: l.id, action: `editLoan('${l.id}')` });
                }
            } catch (e) {
                console.error(e);
            }
            if (!hits.length) {
                box.innerHTML = '<p class="p-3 text-slate-400 text-xs">موردی یافت نشد</p>';
                return;
            }
            box.innerHTML = hits.slice(0, 30).map(h => `
                <button type="button" class="w-full text-right p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex gap-2 items-start border-b" style="border-color:var(--border)"
                    onclick="switchTab('${h.tab}'); setTimeout(()=>{ try{ ${h.action} }catch(e){} clearGlobalSearch(); }, 120)">
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 shrink-0">${h.type}</span>
                    <span class="min-w-0 flex-1">
                        <span class="font-medium text-sm block truncate">${h.title || '—'}</span>
                        <span class="text-xs text-slate-400 block truncate">${h.sub || ''}</span>
                    </span>
                </button>`).join('');
            lucide.createIcons();
        }

        async function editLoan(id) {
            let { data } = await _supabase.from('loans').select('*').eq('id', id).single();
            if (!data) return;
            _loanManualMonthly = true; // keep saved monthly unless user recalculates
            document.getElementById('loan-id').value = id;
            document.getElementById('loan-modal-title').innerText = 'ویرایش وام';
            document.getElementById('loan-title').value = await toText(data.title) || '';
            const lType = await toText(data.loan_type) || 'مرابحه';
            const typeEl = document.getElementById('loan-type');
            if ([...typeEl.options].some(o => o.value === lType)) typeEl.value = lType;
            else typeEl.value = 'سایر';
            document.getElementById('loan-bank').value = data.bank ? await toText(data.bank) : '';
            document.getElementById('loan-calc-method').value = data.calc_method || 'amortization';
            document.getElementById('loan-principal').value = await toNum(data.total_amount) || '';
            document.getElementById('loan-rate').value = data.interest_rate != null ? data.interest_rate : '0';
            const months = data.total_installments || 0;
            document.getElementById('loan-count').value = months;
            document.getElementById('loan-years').value = months ? (months / 12) : '';
            document.getElementById('loan-fee').value = await toNum(data.bank_fee) || '0';
            document.getElementById('loan-paid-count').value = data.paid_installments || '0';
            document.getElementById('loan-monthly').value = await toNum(data.monthly_payment) || '';
            document.getElementById('loan-date').value = await toText(data.due_day) || '';
            document.getElementById('loan-desc').value = await toText(data.description) || '';
            openModal('loan-modal');
            setTimeout(() => {
                onManualMonthly();
            }, 50);
        }

        // ==================== CONTACTS ====================
        function openContactModal(item = null) {
            document.getElementById('contact-id').value = item ? item.id : '';
            document.getElementById('contact-modal-title').innerText = item ? 'ویرایش مخاطب' : 'ثبت مخاطب جدید';
            if (!item) {
                ['contact-name','contact-mobile','contact-phone2','contact-work','contact-home','contact-email','contact-address','contact-notes','contact-birthday'].forEach(id => {
                    document.getElementById(id).value = '';
                });
                document.getElementById('contact-category').value = 'دوستان';
                clearAttachments('contact');
            }
            openModal('contact-modal');
            setTimeout(bindNumericInputs, 100);
        }

        async function saveContact(e) {
            e.preventDefault();
            const id = document.getElementById('contact-id').value;
            const name = document.getElementById('contact-name').value.trim();
            let mobile = document.getElementById('contact-mobile').value.trim();
            const phone2 = document.getElementById('contact-phone2').value.trim();
            const work = document.getElementById('contact-work').value.trim();
            const home = document.getElementById('contact-home').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            const address = document.getElementById('contact-address').value.trim();
            const notes = document.getElementById('contact-notes').value.trim();
            const birthday = document.getElementById('contact-birthday').value.trim();

            const err = V.firstError(
                V.required(name, 'نام و نام خانوادگی'),
                V.minLength(name, 2, 'نام'),
                V.maxLength(name, 80, 'نام'),
                V.mobile(mobile, true),
                phone2 ? V.phoneAny(phone2) : null,
                work ? V.landline(work) : null,
                home ? V.landline(home) : null,
                V.email(email),
                birthday ? V.jalaliDate(birthday) : null,
                V.maxLength(address, 200, 'آدرس'),
                V.maxLength(notes, 500, 'توضیحات')
            );
            if (err) { toast(err, 'error'); return; }

            mobile = V.normalizeMobile(mobile);

            let payload = {
                name,
                phones: mobile,
                category: document.getElementById('contact-category').value
            };
            const extra = {
                mobile,
                phone2: phone2 ? V.onlyDigits(phone2) : '',
                work_phone: work ? V.onlyDigits(work) : '',
                home_phone: home ? V.onlyDigits(home) : '',
                email,
                address,
                notes,
                birthday: birthday ? V.toEnDigits(birthday).replace(/-/g, '/') : '',
                attachments: JSON.stringify(getDraftAttachments('contact'))
            };
            Object.assign(payload, extra);

            try {
                let error;
                if (id) {
                    ({ error } = await _supabase.from('contacts').update(payload).eq('id', id));
                    if (error && error.message && error.message.includes('column')) {
                        // Retry with only base fields
                        payload = { name, phones: payload.phones, category: payload.category };
                        ({ error } = await _supabase.from('contacts').update(payload).eq('id', id));
                    }
                    if (error) throw error;
                    await logAction('ویرایش مخاطب', `مخاطب ${name} ویرایش شد`);
                    toast('مخاطب ویرایش شد');
                } else {
                    ({ error } = await _supabase.from('contacts').insert([payload]));
                    if (error && error.message && error.message.includes('column')) {
                        payload = { name, phones: payload.phones || payload.mobile, category: payload.category };
                        ({ error } = await _supabase.from('contacts').insert([payload]));
                    }
                    if (error) throw error;
                    await logAction('ثبت مخاطب', `مخاطب جدید: ${name}`);
                    toast('مخاطب با موفقیت ثبت شد');
                }
                closeModal('contact-modal');
                await fetchContacts();
                updateDashboard();
            } catch (err) {
                toast('خطا در ذخیره مخاطب: ' + (err.message || err), 'error');
                await logAction('خطای مخاطب', String(err.message || err));
            }
        }

        async function fetchContacts() {
            allContacts = await safeSelect('contacts');
            renderContacts(allContacts);
        }

        function renderContacts(data) {
            const list = document.getElementById('contacts-list');
            if (!data || data.length === 0) {
                list.innerHTML = `<p class="text-center text-slate-400 text-sm py-8 col-span-full">مخاطبی ثبت نشده است.</p>`;
                return;
            }
            const sorted = [...data].sort((a, b) => String(a.name||'').localeCompare(String(b.name||''), 'fa'));
            list.innerHTML = sorted.map(item => {
                const mobile = item.mobile || item.phones || '';
                const phone2 = item.phone2 || '';
                const actions = contactActionButtons(mobile, item.email);
                const initial = (item.name || '?').charAt(0);
                return `
                    <div class="list-card">
                        <div class="list-card-body">
                            <div class="flex items-start gap-3">
                                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shrink-0 avatar-ring">
                                    ${initial}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center justify-between gap-2">
                                        <p class="font-bold text-base truncate">${item.name || '—'}</p>
                                        <span class="badge-soft bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 shrink-0">${item.category || 'سایر'}</span>
                                    </div>
                                    ${mobile ? `<p class="text-sm text-slate-600 dark:text-slate-300 mt-1.5 ltr-num font-medium">${mobile}</p>` : ''}
                                    ${phone2 ? `<p class="text-xs text-slate-500 ltr-num mt-0.5">${phone2}</p>` : ''}
                                    ${item.email ? `<p class="text-xs text-slate-400 mt-0.5 truncate" dir="ltr">${item.email}</p>` : ''}
                                    ${item.address ? `<p class="text-xs text-slate-400 mt-0.5 truncate">${item.address}</p>` : ''}
                                </div>
                            </div>
                        </div>
                        ${actions ? `<div class="list-card-actions">${actions}</div>` : ''}
                        <div class="list-card-actions !pt-0" style="border-top:none;padding-top:0">
                            <button onclick="viewContact('${item.id}')" class="action-btn action-view flex-1"><i data-lucide="eye" class="w-3.5 h-3.5"></i> نمایش</button>
                            <button onclick="editContact('${item.id}')" class="action-btn action-edit"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                            <button onclick="deleteItem('contacts', '${item.id}', fetchContacts)" class="action-btn action-del"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>`;
            }).join('');
            lucide.createIcons();
        }

        function filterContacts() {
            const q = document.getElementById('contact-search').value.trim().toLowerCase();
            if (!q) { renderContacts(allContacts); return; }
            const filtered = allContacts.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.mobile || '').includes(q) ||
                (c.phones || '').includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.category || '').includes(q)
            );
            renderContacts(filtered);
        }

