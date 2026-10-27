        function showDayEvents(dayStr, dayNum) {
            document.getElementById('detail-title').innerText = 'رویدادهای ' + dayStr;
            document.getElementById('detail-body').innerHTML = '<p class="text-sm text-slate-500">در حال بارگذاری...</p>';
            document.getElementById('detail-actions').innerHTML = `
                <button onclick="closeModal('detail-modal'); openTaskModal(); setTimeout(()=>{document.getElementById('task-due-date').value='${dayStr}';},100)" class="flex-1 btn-primary py-2 rounded-xl text-sm">ثبت یادآوری</button>
                <button onclick="closeModal('detail-modal')" class="flex-1 py-2 rounded-xl bg-slate-200 text-sm">بستن</button>`;
            openModal('detail-modal');
            Promise.all([safeSelect('tasks'), safeSelect('contacts')]).then(([tasks, contacts]) => {
                const dayTasks = tasks.filter(t => matchJalaliDay(t.due_date, calYear, calMonth, dayNum));
                const dayBirths = contacts.filter(c => {
                    if (!c.birthday) return false;
                    const s = String(c.birthday).replace(/-/g, '/');
                    const parts = s.split('/').map(x => parseInt(V.toEnDigits(x), 10));
                    if (parts.length >= 3) return parts[1] === calMonth && parts[2] === dayNum;
                    if (parts.length === 2) return parts[0] === calMonth && parts[1] === dayNum;
                    return false;
                });
                const dayEvs = loadCalEvents().filter(ev => matchJalaliDay(ev.date, calYear, calMonth, dayNum));
                if (!dayTasks.length && !dayBirths.length && !dayEvs.length) {
                    document.getElementById('detail-body').innerHTML = '<p class="text-sm text-slate-400">رویدادی برای این روز نیست. با دکمه رویداد ثبت کنید.</p>';
                } else {
                    document.getElementById('detail-body').innerHTML = `
                        ${dayEvs.map(ev => `
                            <div class="p-3 rounded-xl border mb-2" style="border-color:var(--border)">
                                <p class="font-medium text-sm">📌 ${ev.title||''}</p>
                                <p class="text-xs text-slate-500 mt-1">${ev.date||''} ${ev.time||''}</p>
                                <p class="text-xs mt-1">${ev.desc||''}</p>
                                <button onclick="deleteCalEvent('${ev.id}'); closeModal('detail-modal')" class="text-xs text-red-600 mt-1">حذف رویداد</button>
                            </div>`).join('')}
                        ${dayTasks.map(t => `
                            <div class="p-3 rounded-xl border mb-2" style="border-color:var(--border)">
                                <p class="font-medium text-sm">${t.title}</p>
                                <p class="text-xs text-slate-500 mt-1">${t.due_date || ''} ${t.due_time || ''} · ${t.priority || ''}</p>
                                <button onclick="viewTask('${t.id}'); closeModal('detail-modal')" class="text-xs text-blue-600 mt-1">نمایش کامل</button>
                            </div>`).join('')}
                        ${dayBirths.map(c => `
                            <div class="p-3 rounded-xl border mb-2" style="border-color:var(--border)">
                                <p class="font-medium text-sm">🎂 تولد ${c.name}</p>
                                <p class="text-xs text-slate-500">${c.birthday || ''}</p>
                            </div>`).join('')}
                    `;
                }
            });
        }

        // ==================== REPORTS ====================
        async function renderReports() {
            const chartOpts = { plugins: { legend: { position: 'bottom', labels: { font: { family: 'Vazirmatn', size: 11 } } } } };

            const txs = await safeSelect('transactions');
            const loans = await safeSelect('loans', 'id');
            const tasks = await safeSelect('tasks');
            const contacts = await safeSelect('contacts');
            const calEvents = loadCalEvents();
            let loansCal = [];
            try { loansCal = await safeSelect('loans', 'id'); } catch(e) {}
            const notes = await safeSelect('notes');

            let totalInc = 0, totalExp = 0;
            const catMap = {};
            if (txs) {
                for (let item of txs) {
                    const tType = await toText(item.type);
                    const tCat = await toText(item.category);
                    const tAmt = await toNum(item.amount);
                    if (tType === 'درآمد') totalInc += tAmt;
                    else {
                        totalExp += tAmt;
                        catMap[tCat || 'سایر'] = (catMap[tCat || 'سایر'] || 0) + tAmt;
                    }
                }
            }

            let loanRemain = 0, loanPrincipal = 0, loanMonthly = 0;
            const loanLabels = [], loanRemVals = [];
            if (loans) {
                for (let l of loans) {
                    const rem = await toNum(l.remaining_amount);
                    const tot = await toNum(l.total_amount);
                    const mon = await toNum(l.monthly_payment);
                    loanRemain += rem;
                    loanPrincipal += tot;
                    loanMonthly += mon;
                    loanLabels.push(await toText(l.title) || 'وام');
                    loanRemVals.push(rem);
                }
            }

            let taskOpen = 0, taskDone = 0, taskUrgent = 0;
            if (tasks) {
                for (let t of tasks) {
                    if (t.is_completed || t.status === 'انجام شده') taskDone++;
                    else {
                        taskOpen++;
                        if (t.priority === 'فوری') taskUrgent++;
                    }
                }
            }

            const balance = totalInc - totalExp;

            document.getElementById('report-stats').innerHTML = `
                <div class="p-3 rounded-xl border text-center" style="border-color:var(--border)">
                    <p class="text-xs text-slate-500">کل درآمد</p>
                    <p class="font-bold text-emerald-600 ltr-num text-sm">${formatMoney(totalInc)}</p>
                </div>
                <div class="p-3 rounded-xl border text-center" style="border-color:var(--border)">
                    <p class="text-xs text-slate-500">کل هزینه</p>
                    <p class="font-bold text-red-600 ltr-num text-sm">${formatMoney(totalExp)}</p>
                </div>
                <div class="p-3 rounded-xl border text-center" style="border-color:var(--border)">
                    <p class="text-xs text-slate-500">مانده خالص</p>
                    <p class="font-bold text-blue-600 ltr-num text-sm">${formatNum(balance)} تومان</p>
                </div>
                <div class="p-3 rounded-xl border text-center" style="border-color:var(--border)">
                    <p class="text-xs text-slate-500">مانده وام‌ها</p>
                    <p class="font-bold text-amber-600 ltr-num text-sm">${formatNum(loanRemain)} تومان</p>
                </div>
                <div class="p-3 rounded-xl border text-center" style="border-color:var(--border)">
                    <p class="text-xs text-slate-500">کارهای باز</p>
                    <p class="font-bold text-violet-600">${taskOpen}</p>
                </div>
                <div class="p-3 rounded-xl border text-center" style="border-color:var(--border)">
                    <p class="text-xs text-slate-500">تراکنش‌ها</p>
                    <p class="font-bold">${txs ? txs.length : 0}</p>
                </div>`;

            const ctx1 = document.getElementById('chart-income-expense');
            if (chartIncomeExpense) chartIncomeExpense.destroy();
            chartIncomeExpense = new Chart(ctx1, {
                type: 'doughnut',
                data: {
                    labels: ['درآمد', 'هزینه'],
                    datasets: [{ data: [totalInc || 0.001, totalExp || 0.001], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0 }]
                },
                options: chartOpts
            });

            const ctx2 = document.getElementById('chart-categories');
            if (chartCategories) chartCategories.destroy();
            const catLabels = Object.keys(catMap).length ? Object.keys(catMap) : ['بدون داده'];
            const catValues = Object.keys(catMap).length ? Object.values(catMap) : [0];
            chartCategories = new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: catLabels,
                    datasets: [{ label: 'هزینه (تومان)', data: catValues, backgroundColor: '#3b82f6', borderRadius: 6 }]
                },
                options: {
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });

            const ctx3 = document.getElementById('chart-tasks');
            if (chartTasks) chartTasks.destroy();
            if (ctx3) {
                chartTasks = new Chart(ctx3, {
                    type: 'doughnut',
                    data: {
                        labels: ['باز', 'انجام‌شده', 'فوری'],
                        datasets: [{ data: [taskOpen, taskDone, taskUrgent], backgroundColor: ['#6366f1', '#10b981', '#ef4444'], borderWidth: 0 }]
                    },
                    options: chartOpts
                });
            }

            const ctx4 = document.getElementById('chart-loans');
            if (chartLoans) chartLoans.destroy();
            if (ctx4) {
                chartLoans = new Chart(ctx4, {
                    type: 'bar',
                    data: {
                        labels: loanLabels.length ? loanLabels : ['بدون وام'],
                        datasets: [{ label: 'مانده (تومان)', data: loanRemVals.length ? loanRemVals : [0], backgroundColor: '#f59e0b', borderRadius: 6 }]
                    },
                    options: {
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true } }
                    }
                });
            }

            const details = document.getElementById('report-details');
            if (details) {
                details.innerHTML = `
                    <div class="p-4 rounded-xl border" style="border-color:var(--border)">
                        <p class="font-semibold mb-2">مالی</p>
                        <p class="text-xs text-slate-500">درآمد: <span class="ltr-num font-medium text-emerald-600">${formatMoney(totalInc)}</span></p>
                        <p class="text-xs text-slate-500">هزینه: <span class="ltr-num font-medium text-red-600">${formatMoney(totalExp)}</span></p>
                        <p class="text-xs text-slate-500">مانده: <span class="ltr-num font-medium">${formatNum(balance)} تومان</span></p>
                        <p class="text-xs text-slate-500">تعداد تراکنش: ${txs ? txs.length : 0}</p>
                        <p class="text-xs text-slate-500">میانگین هزینه: <span class="ltr-num">${formatNum(totalExp && txs ? Math.round(totalExp / Math.max(1, Object.values(catMap).length)) : 0)} تومان</span></p>
                    </div>
                    <div class="p-4 rounded-xl border" style="border-color:var(--border)">
                        <p class="font-semibold mb-2">وام‌ها</p>
                        <p class="text-xs text-slate-500">تعداد: ${loans ? loans.length : 0}</p>
                        <p class="text-xs text-slate-500">جمع اصل: <span class="ltr-num">${formatNum(loanPrincipal)} تومان</span></p>
                        <p class="text-xs text-slate-500">جمع مانده: <span class="ltr-num text-amber-600 font-medium">${formatNum(loanRemain)} تومان</span></p>
                        <p class="text-xs text-slate-500">جمع اقساط ماهانه: <span class="ltr-num">${formatNum(loanMonthly)} تومان</span></p>
                    </div>
                    <div class="p-4 rounded-xl border" style="border-color:var(--border)">
                        <p class="font-semibold mb-2">فعالیت‌ها</p>
                        <p class="text-xs text-slate-500">کار باز: ${taskOpen} · انجام‌شده: ${taskDone} · فوری: ${taskUrgent}</p>
                        <p class="text-xs text-slate-500">مخاطبین: ${contacts ? contacts.length : 0}</p>
                        <p class="text-xs text-slate-500">یادداشت‌ها: ${notes ? notes.length : 0}</p>
                        <p class="text-xs text-slate-500">نسبت پس‌انداز: <span class="font-medium">${totalInc > 0 ? Math.round((balance / totalInc) * 100) : 0}٪</span></p>
                    </div>`;
            }
        }

        // ==================== LOGS ====================
        async function fetchLogs() {
            const list = document.getElementById('logs-list');
            if (!list) return;
            const lim = parseInt(document.getElementById('log-filter-limit')?.value || '100', 10);
            let { data } = await _supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(lim || 100);
            if (!data) data = [];
            const q = (document.getElementById('log-filter-q')?.value || '').trim().toLowerCase();
            const typ = document.getElementById('log-filter-type')?.value || '';
            const secKeys = ['ورود', 'خروج', 'رمز', 'امنیت', 'بکاپ', 'بازیابی', 'تبدیل واحد'];
            let filtered = data.filter(item => {
                const blob = ((item.action || '') + ' ' + (item.details || '') + ' ' + (item.meta || '')).toLowerCase();
                if (q && !blob.includes(q)) return false;
                if (!typ) return true;
                if (typ === 'امنیت') return secKeys.some(k => blob.includes(k.toLowerCase())) || (item.meta && String(item.meta).includes('security'));
                return blob.includes(typ.toLowerCase());
            });
            if (filtered.length === 0) {
                list.innerHTML = '<p class="text-center text-slate-400 py-4">رویدادی با این فیلتر نیست.</p>';
                return;
            }
            list.innerHTML = filtered.map(item => {
                const date = item.created_at ? new Date(item.created_at).toLocaleString('fa-IR') : '';
                const isSec = secKeys.some(k => (item.action || '').includes(k));
                return `<div class="flex justify-between items-start gap-3 p-3 rounded-xl border ${isSec ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10' : ''}" style="border-color:var(--border)">
                    <div class="min-w-0">
                        <span class="font-semibold text-sm ${isSec ? 'text-amber-700' : 'text-blue-600'}">${item.action || ''}</span>
                        <p class="text-xs text-slate-600 mt-0.5 break-words">${item.details || ''}</p>
                    </div>
                    <span class="text-[10px] text-slate-400 shrink-0">${date}</span>
                </div>`;
            }).join('');
        }

        // ==================== DASHBOARD ====================
        async function updateDashboard() {
            // Finance
            let { data: txs } = await _supabase.from('transactions').select('*');
            let inc = 0, exp = 0;
            if (txs) {
                for (let item of txs) {
                    const t = await toText(item.type);
                    const a = await toNum(item.amount);
                    if (t === 'درآمد') inc += a; else exp += a;
                }
            }
            document.getElementById('dash-income').innerText = formatMoney(inc);
            document.getElementById('dash-expense').innerText = formatMoney(exp);
            document.getElementById('dash-balance').innerText = formatMoney(inc - exp);

            let { data: loans } = await _supabase.from('loans').select('remaining_amount');
            let loanSum = 0;
            if (loans) {
                for (let l of loans) loanSum += await toNum(l.remaining_amount);
            }
            document.getElementById('dash-loans').innerText = formatMoney(loanSum);

            // Counts
            const [tRes, cRes, nRes] = await Promise.all([
                _supabase.from('tasks').select('id,is_completed,status'),
                _supabase.from('contacts').select('id', { count: 'exact', head: true }),
                _supabase.from('notes').select('id', { count: 'exact', head: true })
            ]);
            const openTasks = (tRes.data || []).filter(t => !t.is_completed && t.status !== 'انجام شده').length;
            document.getElementById('dash-open-tasks').innerText = openTasks;
            document.getElementById('dash-contacts').innerText = cRes.count || 0;
            document.getElementById('dash-notes').innerText = nRes.count || 0;

            // Recent logs
            let { data: logs } = await _supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(6);
            const logBox = document.getElementById('dash-recent-logs');
            if (!logs || logs.length === 0) logBox.innerHTML = '<p class="text-slate-400 text-xs">رویدادی نیست</p>';
            else {
                logBox.innerHTML = logs.map(l => `
                    <div class="flex justify-between text-xs py-1.5 border-b" style="border-color:var(--border)">
                        <span><strong class="text-blue-600">${l.action}</strong>: ${l.details}</span>
                        <span class="text-slate-400">${new Date(l.created_at).toLocaleTimeString('fa-IR')}</span>
                    </div>
                `).join('');
            }
        }

        // ==================== DELETE ====================
        async function deleteItem(table, id, callback) {
            if (!confirm('آیا از حذف این مورد اطمینان دارید؟ این عمل قابل بازگشت نیست.')) return;
            await _supabase.from(table).delete().eq('id', id);
            await logAction('حذف', `حذف آیتم از جدول ${table} با شناسه ${id}`);
            if (callback) callback();
            updateDashboard();
            if (table === 'loans' || table === 'transactions') fetchTransactions();
        }

        // ==================== MULTI-USER ====================
        async function ensureUsersTable() {
            // Try to use app_users; if fails, fall back to user_profile for single admin
            try {
                let { data, error } = await _supabase.from('app_users').select('id').limit(1);
                if (error && error.code === '42P01') return false; // table does not exist
                return true;
            } catch (e) { return false; }
        }

        async function initMultiUser() {
            const hasTable = await ensureUsersTable();
            if (!hasTable) {
                // Create via insert attempt is not possible from client; user must create table
                // Fallback: single admin from user_profile
                return;
            }
            // Ensure admin exists in app_users
            let { data } = await _supabase.from('app_users').select('*').eq('username', 'admin').limit(1);
            if (!data || data.length === 0) {
                await _supabase.from('app_users').insert([{
                    username: 'admin',
                    password_hash: DEFAULT_ADMIN_PASS_HASH,
                    display_name: 'مدیر سیستم',
                    role: 'admin',
                    is_active: true
                }]);
            }
        }

        async function fetchUsers() {
            const list = document.getElementById('users-list');
            if (!list) return;
            try {
                let { data, error } = await _supabase.from('app_users').select('*').order('created_at', { ascending: true });
                if (error || !data) {
                    list.innerHTML = `<p class="text-xs text-amber-600">جدول app_users وجود ندارد. لطفاً SQL زیر را در سوپابیس اجرا کنید:<br><code class="text-[10px] block mt-1 bg-slate-100 dark:bg-slate-800 p-2 rounded">CREATE TABLE app_users (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, username text UNIQUE NOT NULL, password_hash text NOT NULL, display_name text, role text DEFAULT 'user', is_active boolean DEFAULT true, created_at timestamptz DEFAULT now());</code></p>`;
                    return;
                }
                if (data.length === 0) {
                    list.innerHTML = '<p class="text-xs text-slate-400">کاربری ثبت نشده.</p>';
                    return;
                }
                list.innerHTML = data.map(u => `
                    <div class="flex items-center justify-between p-3 rounded-xl border" style="border-color:var(--border)">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">${(u.display_name||u.username||'?').charAt(0)}</div>
                            <div>
                                <p class="font-medium text-sm">${u.display_name || u.username} <span class="text-[10px] opacity-60">@${u.username}</span></p>
                                <p class="text-[10px] text-slate-500">${u.role === 'admin' ? 'مدیر' : 'کاربر عادی'} ${u.is_active === false ? '· غیرفعال' : ''}</p>
                            </div>
                        </div>
                        <div class="flex gap-1">
                            ${u.username !== 'admin' ? `
                                <button onclick="editUser('${u.id}')" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                                <button onclick="deleteUser('${u.id}', '${u.username}')" class="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                            ` : '<span class="text-[10px] text-slate-400 px-2">اصلی</span>'}
                        </div>
                    </div>
                `).join('');
                lucide.createIcons();
            } catch (e) {
                list.innerHTML = `<p class="text-xs text-red-500">خطا در بارگذاری کاربران: ${e.message}</p>`;
            }
        }

        function openUserModal(user = null) {
            document.getElementById('user-edit-id').value = user ? user.id : '';
            document.getElementById('user-modal-title').innerText = user ? 'ویرایش کاربر' : 'افزودن کاربر';
            document.getElementById('user-username').value = user ? user.username : '';
            document.getElementById('user-username').disabled = !!user;
            document.getElementById('user-displayname').value = user ? (user.display_name || '') : '';
            document.getElementById('user-password').value = '';
            document.getElementById('user-password').placeholder = user ? 'خالی بگذارید اگر تغییر نمی‌دهید' : 'حداقل ۶ کاراکتر';
            document.getElementById('user-role').value = user ? (user.role || 'user') : 'user';
            openModal('user-modal');
        }

        async function saveUser(e) {
            e.preventDefault();
            if (currentUserRole !== 'admin') { alert('فقط ادمین می‌تواند کاربر مدیریت کند'); return; }
            const id = document.getElementById('user-edit-id').value;
            const username = document.getElementById('user-username').value.trim().toLowerCase();
            const display_name = document.getElementById('user-displayname').value.trim();
            const password = document.getElementById('user-password').value;
            const role = document.getElementById('user-role').value;

            if (!username || !display_name) { alert('نام کاربری و نام نمایشی الزامی است'); return; }

            const payload = { username, display_name, role, is_active: true };
            if (password) {
                if (password.length < 6) { alert('رمز حداقل ۶ کاراکتر'); return; }
                payload.password_hash = await hashPassword(password);
            } else if (!id) {
                alert('رمز عبور برای کاربر جدید الزامی است'); return;
            }

            try {
                if (id) {
                    if (!password) delete payload.password_hash;
                    await _supabase.from('app_users').update(payload).eq('id', id);
                    await logAction('ویرایش کاربر', `کاربر ${username} ویرایش شد`);
                } else {
                    await _supabase.from('app_users').insert([payload]);
                    await logAction('افزودن کاربر', `کاربر جدید: ${username}`);
                }
                closeModal('user-modal');
                fetchUsers();
                alert('کاربر ذخیره شد.');
            } catch (err) {
                alert('خطا: ' + (err.message || err));
            }
        }

        async function editUser(id) {
            let { data } = await _supabase.from('app_users').select('*').eq('id', id).single();
            if (data) openUserModal(data);
        }

        async function deleteUser(id, username) {
            if (username === 'admin') { alert('کاربر ادمین اصلی قابل حذف نیست'); return; }
            if (!confirm(`حذف کاربر «${username}»؟`)) return;
            await _supabase.from('app_users').delete().eq('id', id);
            await logAction('حذف کاربر', `کاربر ${username} حذف شد`);
            fetchUsers();
        }

        // Override login to support multi-user
        const _originalHandleLogin = handleLogin;
        handleLogin = async function(e) {
            if (e) e.preventDefault();
            const u = document.getElementById('login-user').value.trim().toLowerCase();
            const p = document.getElementById('login-pass').value;
            const btn = document.getElementById('login-btn');
            btn.disabled = true;
            btn.innerText = 'در حال بررسی...';

            try {
                // Try app_users first
                let { data: users, error } = await _supabase.from('app_users').select('*').eq('username', u).limit(1);
                if (!error && users && users.length > 0) {
                    const user = users[0];
                    if (user.is_active === false) {
                        alert('این حساب غیرفعال است.');
                        btn.disabled = false; btn.innerText = 'ورود به سامانه';
                        return;
                    }
                    const hashed = await hashPassword(p);
                    if (hashed === user.password_hash) {
                        sessionEncryptionKey = await deriveEncryptionKey(p);
                        currentUser = user.username;
                        currentUserRole = user.role || 'user';
                        currentUserId = user.id;
                        localStorage.setItem('mgh_user', currentUser);
                        localStorage.setItem('mgh_role', currentUserRole);
                        await logAction('ورود', `ورود موفق کاربر ${currentUser} (${currentUserRole})`);
                        showApp();
                        if (currentUserRole === 'admin') fetchUsers();
                        return;
                    }
                }

                // Fallback to original user_profile (admin)
                let { data } = await _supabase.from('user_profile').select('*').limit(1);
                let profile = (data && data.length > 0) ? data[0] : {
                    admin_user: DEFAULT_ADMIN_USER,
                    admin_pass: DEFAULT_ADMIN_PASS_HASH
                };

                // Migrate old 123456 to admin if needed
                if (profile.admin_pass === '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' && u === 'admin' && p === 'admin') {
                    const hashed = await hashPassword('admin');
                    if (data && data.length > 0) {
                        await _supabase.from('user_profile').update({ admin_user: 'admin', admin_pass: hashed }).eq('id', data[0].id);
                    }
                    profile.admin_user = 'admin';
                    profile.admin_pass = hashed;
                }

                const hashedInput = await hashPassword(p);
                if (u === (profile.admin_user || 'admin').toLowerCase() && hashedInput === profile.admin_pass) {
                    sessionEncryptionKey = await deriveEncryptionKey(p);
                    currentUser = profile.admin_user || 'admin';
                    currentUserRole = 'admin';
                    currentUserId = null;
                    localStorage.setItem('mgh_user', currentUser);
                    localStorage.setItem('mgh_role', 'admin');
                    await logAction('ورود', `ورود موفق ادمین ${currentUser}`);
                    showApp();
                    fetchUsers();
                } else {
                    await logAction('ورود ناموفق', `تلاش ناموفق: ${u}`);
                    alert('نام کاربری یا رمز عبور اشتباه است!');
                    btn.disabled = false; btn.innerText = 'ورود به سامانه';
                }
            } catch (err) {
                alert('خطای سیستمی: ' + err.message);
                btn.disabled = false; btn.innerText = 'ورود به سامانه';
            }
        };

        // ==================== NOTIFICATIONS ====================
        function requestNotificationPermission() {
            if (!('Notification' in window)) {
                alert('مرورگر شما از اعلان پشتیبانی نمی‌کند.');
                return;
            }
            Notification.requestPermission().then(perm => {
                document.getElementById('notif-status').innerText = 'وضعیت: ' + (perm === 'granted' ? 'فعال ✓' : perm === 'denied' ? 'مسدود شده' : 'در انتظار');
                if (perm === 'granted') {
                    localStorage.setItem('mgh_notif', '1');
                    document.getElementById('notif-enabled').checked = true;
                    startNotificationChecker();
                    new Notification('سامانه مدیریت', { body: 'اعلان‌ها با موفقیت فعال شدند.', icon: '/favicon.ico' });
                }
            });
        }

        function toggleNotifications(enabled) {
            if (enabled) {
                if (Notification.permission !== 'granted') {
                    requestNotificationPermission();
                    return;
                }
                localStorage.setItem('mgh_notif', '1');
                startNotificationChecker();
            } else {
                localStorage.setItem('mgh_notif', '0');
                if (notifCheckInterval) clearInterval(notifCheckInterval);
            }
        }

        function startNotificationChecker() {
            if (notifCheckInterval) clearInterval(notifCheckInterval);
            checkAllReminders();
            notifCheckInterval = setInterval(checkAllReminders, 2 * 60 * 1000);
        }

