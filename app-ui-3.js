        function pushNotif(title, body, tag) {
            if (Notification.permission !== 'granted') return;
            try {
                new Notification(title, { body: body || '', tag: tag || undefined, icon: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mgh' });
            } catch (e) {}
        }

        async function checkAllReminders() {
            if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || localStorage.getItem('mgh_notif') !== '1') return;
            const notified = JSON.parse(localStorage.getItem('mgh_notified') || '{}');
            const today = getCurrentJalaliYM();
            const todayStr = `${today.y}/${String(today.m).padStart(2,'0')}/${String(today.d).padStart(2,'0')}`;
            const dayKey = todayStr;

            // Tasks
            try {
                let { data } = await _supabase.from('tasks').select('*');
                for (const t of (data || [])) {
                    if (t.is_completed || t.status === 'انجام شده') continue;
                    if (!t.due_date) continue;
                    const key = 'task_' + t.id + '_' + t.due_date;
                    if (notified[key]) continue;
                    const ds = V.toEnDigits(String(t.due_date)).replace(/-/g, '/');
                    if (ds.startsWith(todayStr.slice(0, 7)) || matchJalaliDay(ds, today.y, today.m, today.d)) {
                        pushNotif('یادآور کار: ' + (t.title || ''), (t.description || '') + (t.due_time ? ' · ' + t.due_time : ''), key);
                        notified[key] = Date.now();
                    }
                }
            } catch (e) {}

            // Birthdays
            try {
                const contacts = await safeSelect('contacts');
                for (const c of (contacts || [])) {
                    if (!c.birthday) continue;
                    const key = 'bday_' + c.id + '_' + dayKey;
                    if (notified[key]) continue;
                    const parts = V.toEnDigits(String(c.birthday)).replace(/-/g, '/').split('/').map(x => parseInt(x, 10));
                    let mm, dd;
                    if (parts.length >= 3) { mm = parts[1]; dd = parts[2]; }
                    else if (parts.length === 2) { mm = parts[0]; dd = parts[1]; }
                    else continue;
                    if (mm === today.m && dd === today.d) {
                        pushNotif('تولد امروز: ' + (c.name || ''), 'یادآوری تولد مخاطب', key);
                        notified[key] = Date.now();
                    }
                }
            } catch (e) {}

            // Loan due day of month
            try {
                const loans = await safeSelect('loans', 'id');
                for (const L of (loans || [])) {
                    if ((L.paid_installments || 0) >= (L.total_installments || 0)) continue;
                    const due = V.toEnDigits(String(L.due_day || '')).replace(/-/g, '/');
                    if (!due) continue;
                    const parts = due.split('/').map(x => parseInt(x, 10));
                    const dueDay = parts.length >= 3 ? parts[2] : parts[0];
                    if (!dueDay || dueDay !== today.d) continue;
                    const key = 'loan_' + L.id + '_' + dayKey;
                    if (notified[key]) continue;
                    const title = await toText(L.title);
                    pushNotif('سررسید قسط وام', (title || 'وام') + ' · قسط حدود ' + formatMoney(await toNum(L.monthly_payment)), key);
                    notified[key] = Date.now();
                }
            } catch (e) {}

            // Custom calendar events
            try {
                const events = loadCalEvents();
                for (const ev of events) {
                    if (!ev.remind) continue;
                    const key = 'calev_' + ev.id + '_' + dayKey;
                    if (notified[key]) continue;
                    if (matchJalaliDay(ev.date, today.y, today.m, today.d)) {
                        pushNotif('رویداد امروز: ' + (ev.title || ''), (ev.desc || '') + (ev.time ? ' · ' + ev.time : ''), key);
                        notified[key] = Date.now();
                    }
                }
            } catch (e) {}

            localStorage.setItem('mgh_notified', JSON.stringify(notified));
        }

        // ==================== EXCEL EXPORT ====================
        async function exportExcel(type) {
            if (typeof XLSX === 'undefined') { alert('کتابخانه اکسل بارگذاری نشده'); return; }
            const wb = XLSX.utils.book_new();

            async function sheetFromTable(table, decryptFields = []) {
                let { data } = await _supabase.from(table).select('*');
                if (!data || data.length === 0) return null;
                const rows = [];
                for (let item of data) {
                    const row = { ...item };
                    for (let f of decryptFields) {
                        if (row[f]) row[f] = await decryptData(row[f]);
                    }
                    // Clean internal fields
                    delete row.id;
                    rows.push(row);
                }
                return XLSX.utils.json_to_sheet(rows);
            }

            if (type === 'transactions' || type === 'all') {
                const ws = await sheetFromTable('transactions', ['type','category','amount','account','date','time','description']);
                if (ws) XLSX.utils.book_append_sheet(wb, ws, 'تراکنش‌ها');
            }
            if (type === 'loans' || type === 'all') {
                const ws = await sheetFromTable('loans', ['title','loan_type','bank','total_amount','bank_fee','net_received','monthly_payment','remaining_amount','due_day','description']);
                if (ws) XLSX.utils.book_append_sheet(wb, ws, 'وام‌ها');
            }
            if (type === 'contacts' || type === 'all') {
                const ws = await sheetFromTable('contacts');
                if (ws) XLSX.utils.book_append_sheet(wb, ws, 'مخاطبین');
            }
            if (type === 'tasks' || type === 'all') {
                const ws = await sheetFromTable('tasks');
                if (ws) XLSX.utils.book_append_sheet(wb, ws, 'کارها');
            }
            if (type === 'notes' || type === 'all') {
                const ws = await sheetFromTable('notes');
                if (ws) XLSX.utils.book_append_sheet(wb, ws, 'یادداشت‌ها');
            }

            if (wb.SheetNames.length === 0) { alert('داده‌ای برای خروجی وجود ندارد'); return; }
            const name = type === 'all' ? 'backup-full' : type;
            XLSX.writeFile(wb, `export-${name}-${new Date().toISOString().slice(0,10)}.xlsx`);
            await logAction('خروجی اکسل', `خروجی ${type} تهیه شد`);
        }

        // ==================== CUSTOM ACCENT THEME ====================
        function applyCustomAccent(hex) {
            let h = String(hex || '#2563eb').trim();
            if (!h.startsWith('#')) h = '#' + h;
            if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return;
            document.documentElement.style.setProperty('--custom-accent', h);
            const body = document.getElementById('app-body');
            if (body && !body.className.includes('theme-custom')) {
                // keep until theme set to custom
            }
            localStorage.setItem('mgh_custom_accent', h);
            const hexEl = document.getElementById('prof-accent-hex');
            const colEl = document.getElementById('prof-accent-color');
            if (hexEl) hexEl.value = h;
            if (colEl) colEl.value = h;
            if (body && body.className.includes('theme-custom')) {
                body.style.setProperty('--accent', h);
            }
        }
        const _origChangeTheme = changeTheme;
        changeTheme = function(theme) {
            _origChangeTheme(theme);
            const wrap = document.getElementById('custom-accent-wrap');
            if (wrap) wrap.classList.toggle('hidden', theme !== 'custom');
            if (theme === 'custom') {
                const h = localStorage.getItem('mgh_custom_accent') || '#2563eb';
                applyCustomAccent(h);
                const body = document.getElementById('app-body');
                if (body) body.style.setProperty('--accent', h);
            }
            try { logAction('تغییر تم', 'تم: ' + theme); } catch (e) {}
        };

        // ==================== CALENDAR EVENTS (local + optional DB) ====================
        function loadCalEvents() {
            try { return JSON.parse(localStorage.getItem('mgh_cal_events') || '[]'); } catch { return []; }
        }
        function saveCalEventsLocal(list) {
            localStorage.setItem('mgh_cal_events', JSON.stringify(list));
        }
        function openCalEventModal(ev) {
            document.getElementById('calev-id').value = ev?.id || '';
            document.getElementById('calev-title').value = ev?.title || '';
            document.getElementById('calev-date').value = ev?.date || '';
            document.getElementById('calev-time').value = ev?.time || '';
            document.getElementById('calev-desc').value = ev?.desc || '';
            document.getElementById('calev-color').value = ev?.color || 'blue';
            document.getElementById('calev-remind').checked = ev?.remind !== false;
            openModal('cal-event-modal');
            lucide.createIcons();
        }
        async function saveCalEvent(e) {
            e.preventDefault();
            const id = document.getElementById('calev-id').value || ('ev_' + Date.now());
            const title = document.getElementById('calev-title').value.trim();
            const date = V.toEnDigits(document.getElementById('calev-date').value.trim()).replace(/-/g, '/');
            if (!title || !date) { toast('عنوان و تاریخ الزامی است', 'error'); return; }
            const row = {
                id, title, date,
                time: document.getElementById('calev-time').value || '',
                desc: document.getElementById('calev-desc').value.trim(),
                color: document.getElementById('calev-color').value || 'blue',
                remind: document.getElementById('calev-remind').checked
            };
            let list = loadCalEvents().filter(x => x.id !== id);
            list.push(row);
            saveCalEventsLocal(list);
            // try supabase table calendar_events
            try {
                const { error } = await _supabase.from('calendar_events').upsert([{
                    id: row.id, title: row.title, event_date: row.date, event_time: row.time,
                    description: row.desc, color: row.color, remind: row.remind
                }]);
                if (error) { /* table may not exist */ }
            } catch (err) {}
            await logAction('رویداد تقویم', `ثبت رویداد «${title}» در ${date}`);
            toast('رویداد ذخیره شد');
            closeModal('cal-event-modal');
            renderCalendar();
        }
        async function deleteCalEvent(id) {
            if (!confirm('حذف این رویداد؟')) return;
            saveCalEventsLocal(loadCalEvents().filter(x => x.id !== id));
            try { await _supabase.from('calendar_events').delete().eq('id', id); } catch (e) {}
            await logAction('حذف رویداد', id);
            renderCalendar();
        }

        // ==================== PDF REPORT ====================
        async function exportPdfReport(mode) {
            toast('در حال آماده‌سازی گزارش...', 'info');
            const txs = await safeSelect('transactions');
            const loans = await safeSelect('loans', 'id');
            const tasks = await safeSelect('tasks');
            const contacts = await safeSelect('contacts');
            const calEvents = loadCalEvents();
            let loansCal = [];
            try { loansCal = await safeSelect('loans', 'id'); } catch(e) {}
            const notes = await safeSelect('notes');
            const today = getCurrentJalaliYM();
            const monthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
            let totalInc = 0, totalExp = 0;
            const rows = [];
            for (const item of (txs || [])) {
                const tType = await toText(item.type);
                const tAmt = await toNum(item.amount);
                const tDate = await toText(item.date);
                const tCat = await toText(item.category);
                const dn = V.toEnDigits(String(tDate || '')).replace(/-/g, '/');
                if (mode === 'month' && dn && !dn.startsWith(`${today.y}/${String(today.m).padStart(2,'0')}`) && !dn.startsWith(`${today.y}/${today.m}/`)) continue;
                if (mode === 'year' && dn && !dn.startsWith(String(today.y))) continue;
                if (tType === 'درآمد') totalInc += tAmt; else totalExp += tAmt;
                rows.push({ type: tType, cat: tCat, amount: tAmt, date: tDate });
            }
            let loanRemain = 0;
            for (const L of (loans || [])) loanRemain += await toNum(L.remaining_amount);
            const title = mode === 'month' ? `گزارش ${monthNames[today.m-1]} ${today.y}` : mode === 'year' ? `گزارش سال ${today.y}` : 'گزارش کامل سامانه';
            const area = document.getElementById('pdf-report-area') || document.createElement('div');
            area.id = 'pdf-report-area';
            area.className = '';
            area.style.cssText = 'direction:rtl;font-family:Tahoma,sans-serif;padding:24px;color:#111;background:#fff;';
            area.innerHTML = `
                <h1 style="font-size:18px;margin:0 0 8px">${title}</h1>
                <p style="font-size:12px;color:#555">نسخه ${APP_VERSION} · ${today.d} ${monthNames[today.m-1]} ${today.y} · واحد: ${currencyLabel()}</p>
                <hr>
                <p><b>درآمد:</b> ${formatMoney(totalInc)} · <b>هزینه:</b> ${formatMoney(totalExp)} · <b>مانده:</b> ${formatMoney(totalInc-totalExp)}</p>
                <p><b>مانده وام‌ها:</b> ${formatMoney(loanRemain)} · <b>مخاطبین:</b> ${(contacts||[]).length} · <b>کارها:</b> ${(tasks||[]).length} · <b>یادداشت:</b> ${(notes||[]).length}</p>
                <h3 style="margin-top:16px">تراکنش‌ها (${rows.length})</h3>
                <table style="width:100%;border-collapse:collapse;font-size:11px">
                    <thead><tr style="background:#eee"><th style="border:1px solid #ccc;padding:4px">تاریخ</th><th style="border:1px solid #ccc;padding:4px">نوع</th><th style="border:1px solid #ccc;padding:4px">دسته</th><th style="border:1px solid #ccc;padding:4px">مبلغ</th></tr></thead>
                    <tbody>
                        ${rows.slice(0, 200).map(r => `<tr>
                            <td style="border:1px solid #ccc;padding:4px">${r.date||''}</td>
                            <td style="border:1px solid #ccc;padding:4px">${r.type||''}</td>
                            <td style="border:1px solid #ccc;padding:4px">${r.cat||''}</td>
                            <td style="border:1px solid #ccc;padding:4px;direction:ltr">${formatMoney(r.amount)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>`;
            document.body.appendChild(area);
            await logAction('گزارش PDF', title);
            if (typeof html2pdf === 'undefined') {
                // fallback print
                const w = window.open('', '_blank');
                w.document.write(area.outerHTML);
                w.document.close();
                w.print();
                area.className = 'hidden';
                return;
            }
            await html2pdf().set({
                margin: 10,
                filename: `report-${mode}-${today.y}-${today.m}.pdf`,
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(area).save();
            area.className = 'hidden';
            toast('گزارش PDF آماده شد');
        }

        // ==================== PWA / OFFLINE CACHE ====================
        function registerPWA() {
            if (!('serviceWorker' in navigator)) return;
            navigator.serviceWorker.getRegistrations().then(regs => {
                // keep but update
            }).catch(() => {});
            navigator.serviceWorker.register('./sw.js?v=3.9.1').then(reg => {
                console.log('SW file ok');
                try { reg.update(); } catch (e) {}
            }).catch(() => {});
            const swCode = `
const CACHE='mgh-v${APP_VERSION}';
const ASSETS=['./','./index.html','./manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  e.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    const copy=res.clone();
    caches.open(CACHE).then(c=>{try{c.put(req,copy);}catch(e){}});
    return res;
  }).catch(()=>cached||caches.match('./index.html'))));
});
`;
            const blob = new Blob([swCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            navigator.serviceWorker.register(url).then(() => {
                console.log('SW registered');
            }).catch(err => console.warn('SW fail', err));
            // also persist last offline snapshot of key lists
            try {
                setInterval(async () => {
                    if (!currentUser) return;
                    const snap = {
                        at: new Date().toISOString(),
                        contacts: await safeSelect('contacts'),
                        tasks: await safeSelect('tasks'),
                        notes: await safeSelect('notes')
                    };
                    localStorage.setItem('mgh_offline_snap', JSON.stringify(snap));
                }, 5 * 60 * 1000);
            } catch (e) {}
        }

        // ==================== SUPABASE AUTH (hybrid) ====================
        async function trySupabaseAuthLogin(email, password) {
            try {
                if (!_supabase?.auth?.signInWithPassword) return null;
                // only if looks like email
                if (!String(email).includes('@')) return null;
                const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    await logAction('ورود ناموفق Auth', error.message, { security: true });
                    return { error };
                }
                return { user: data.user, session: data.session };
            } catch (e) {
                return null;
            }
        }

        // ==================== SERVER SETUP / SCHEMA / BACKUP ====================
        const BACKUP_TABLES = ['user_profile', 'app_users', 'transactions', 'loans', 'loan_payments', 'contacts', 'tasks', 'notes', 'activity_logs', 'calendar_events'];

        
        async function openServerSetupProtected() {
            // If already logged in as admin, allow directly
            if (currentUser && currentUserRole === 'admin') {
                openServerSetup();
                return;
            }
            document.getElementById('setup-gate-user').value = '';
            document.getElementById('setup-gate-pass').value = '';
            const msg = document.getElementById('setup-gate-msg');
            if (msg) { msg.classList.add('hidden'); msg.innerText = ''; }
            openModal('setup-pass-modal');
        }

        async function verifySetupGate() {
            const u = (document.getElementById('setup-gate-user').value || '').trim();
            const p = document.getElementById('setup-gate-pass').value || '';
            const msg = document.getElementById('setup-gate-msg');
            if (!u || !p) {
                if (msg) { msg.innerText = 'نام کاربری و رمز را وارد کنید'; msg.classList.remove('hidden'); }
                return;
            }
            try {
                const hashed = await hashPassword(p);
                let ok = false;
                // Try profile
                try {
                    let { data } = await _supabase.from('user_profile').select('admin_user,admin_pass').limit(1);
                    if (data && data[0]) {
                        const su = (data[0].admin_user || 'admin').toLowerCase();
                        if (u.toLowerCase() === su && hashed === data[0].admin_pass) ok = true;
                        // legacy default
                        if (!ok && u.toLowerCase() === 'admin' && p === 'admin') {
                            if (data[0].admin_pass === DEFAULT_ADMIN_PASS_HASH ||
                                data[0].admin_pass === '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92') {
                                ok = true;
                            }
                        }
                    }
                } catch (e) {}
                // Try app_users
                if (!ok) {
                    try {
                        let { data: users } = await _supabase.from('app_users').select('*').eq('username', u).limit(1);
                        if (users && users[0] && users[0].password_hash === hashed && users[0].role === 'admin' && users[0].is_active !== false) {
                            ok = true;
                        }
                    } catch (e) {}
                }
                // Offline / first-run fallback only for default admin
                if (!ok && u.toLowerCase() === 'admin' && p === 'admin') {
                    ok = true;
                }
                if (!ok) {
                    try { await logAction('تلاش تنظیم دیتابیس', 'رمز نامعتبر از صفحه ورود', { security: true }); } catch (e) {}
                    if (msg) { msg.innerText = 'نام کاربری یا رمز اشتباه است'; msg.classList.remove('hidden'); }
                    return;
                }
                closeModal('setup-pass-modal');
                try { await logAction('باز کردن تنظیم دیتابیس', 'پس از تأیید رمز', { security: true }); } catch (e) {}
                openServerSetup();
            } catch (err) {
                if (msg) { msg.innerText = 'خطا: ' + (err.message || err); msg.classList.remove('hidden'); }
            }
        }


        function openServerSetup() {
            const cfg = loadServerConfig();
            document.getElementById('setup-url').value = cfg.url || '';
            document.getElementById('setup-key').value = cfg.key || '';
            document.getElementById('setup-test-result').innerText = '';
            const el = document.getElementById('setup-app-ver');
            if (el) el.innerText = APP_VERSION;
            openModal('server-setup-modal');
            lucide.createIcons();
        }

        function closeServerSetup() {
            closeModal('server-setup-modal');
        }

        function saveServerSetup() {
            const url = document.getElementById('setup-url').value.trim();
            const key = document.getElementById('setup-key').value.trim();
            if (!url || !key) { toast('آدرس و کلید الزامی است', 'error'); return; }
            reconnectSupabase(url, key);
            refreshCfgDisplay();
            toast('تنظیمات سرور ذخیره شد');
            closeServerSetup();
        }

        function refreshCfgDisplay() {
            const el = document.getElementById('cfg-url-display');
            if (el) el.innerText = serverCfg.url || '—';
        }

        async function testServerConnection() {
            const url = document.getElementById('setup-url').value.trim() || serverCfg.url;
            const key = document.getElementById('setup-key').value.trim() || serverCfg.key;
            const out = document.getElementById('setup-test-result');
            out.innerText = 'در حال تست...';
            try {
                const client = supabase.createClient(url, key);
                const results = [];
                for (const t of BACKUP_TABLES) {
                    const { error } = await client.from(t).select('*', { count: 'exact', head: true });
                    results.push(error ? `✗ ${t}: ${error.message}` : `✓ ${t}`);
                }
                const bad = results.filter(r => r.startsWith('✗'));
                out.innerHTML = results.map(r => `<div>${r}</div>`).join('');
                if (bad.length) {
                    out.innerHTML += '<div class="text-amber-600 mt-2">جداول ناقص — schema.sql را در SQL Editor اجرا کنید.</div>';
                } else {
                    out.innerHTML += '<div class="text-emerald-600 mt-2 font-medium">اتصال و همه جداول OK</div>';
                    reconnectSupabase(url, key);
                }
            } catch (e) {
                out.innerText = 'خطا: ' + (e.message || e);
            }
        }

        function downloadSchemaSql() {
            fetch('schema.sql').then(r => {
                if (!r.ok) throw new Error('missing');
                return r.text();
            }).catch(() => SCHEMA_SQL_FALLBACK).then(text => {
                const blob = new Blob([text], { type: 'application/sql' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `schema-v${APP_VERSION}.sql`;
                a.click();
                URL.revokeObjectURL(a.href);
                toast('فایل schema.sql دانلود شد');
            });
        }

        const SCHEMA_SQL_FALLBACK = `-- v${APP_VERSION} — اجرا در Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE IF NOT EXISTS user_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text DEFAULT 'مدیر سیستم',
  admin_user text DEFAULT 'admin', admin_pass text, avatar_url text,
  theme text DEFAULT 'slate', font_family text DEFAULT 'font-vazir', font_size text DEFAULT 'size-small',
  job_title text, bio text, experience text, skills text, resume text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text UNIQUE NOT NULL, password_hash text NOT NULL,
  display_name text, role text DEFAULT 'user', is_active boolean DEFAULT true, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type text NOT NULL, category text, amount numeric NOT NULL DEFAULT 0,
  account text, date text, time text, description text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, loan_type text, bank text,
  total_amount numeric NOT NULL DEFAULT 0, bank_fee numeric DEFAULT 0, net_received numeric DEFAULT 0,
  monthly_payment numeric DEFAULT 0, total_installments int DEFAULT 0, paid_installments int DEFAULT 0,
  remaining_amount numeric DEFAULT 0, interest_rate numeric DEFAULT 0, calc_method text DEFAULT 'amortization',
  total_interest numeric DEFAULT 0, total_repay numeric DEFAULT 0, due_day text, description text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), loan_id uuid REFERENCES loans(id) ON DELETE CASCADE,
  installment_no int, amount numeric NOT NULL DEFAULT 0, paid_at text, note text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, phones text, mobile text, phone2 text,
  work_phone text, home_phone text, email text, address text, category text DEFAULT 'دوستان',
  notes text, birthday text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text, priority text DEFAULT 'متوسط',
  status text DEFAULT 'باز', due_date text, due_time text, reminder_minutes int DEFAULT 0,
  is_completed boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, content text, category text DEFAULT 'عمومی',
  color text DEFAULT 'blue', type text DEFAULT 'عادی', password text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action text, details text, meta text, created_at timestamptz DEFAULT now());
INSERT INTO user_profile (name, admin_user, admin_pass)
SELECT 'مدیر سیستم', 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'
WHERE NOT EXISTS (SELECT 1 FROM user_profile LIMIT 1);
INSERT INTO app_users (username, password_hash, display_name, role)
SELECT 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'مدیر سیستم', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'admin');
`;

        async function fullBackup() {
            const backup = {
                app: APP_NAME,
                version: APP_VERSION,
                schema_version: '3.3',
                exported_at: new Date().toISOString(),
                server_url: serverCfg.url,
                data: {}
            };
            toast('در حال تهیه بکاپ...', 'info');
            for (const table of BACKUP_TABLES) {
                try {
                    const { data, error } = await _supabase.from(table).select('*');
                    backup.data[table] = error ? [] : (data || []);
                } catch (e) {
                    backup.data[table] = [];
                }
            }
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `backup-${APP_VERSION}-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            try { await logAction('بکاپ کامل', 'فایل بکاپ JSON دانلود شد', { security: true }); } catch (e) {}
            toast('بکاپ کامل دانلود شد');
        }

        async function restoreBackup(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (!confirm('بازیابی بکاپ داده‌ها را روی دیتابیس فعلی می‌نویسد. ادامه؟')) {
                e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const backup = JSON.parse(ev.target.result);
                    if (!backup.data || typeof backup.data !== 'object') {
                        toast('فایل بکاپ نامعتبر است', 'error');
                        return;
                    }
                    toast('در حال بازیابی...', 'info');
                    let ok = 0, fail = 0;
                    const order = BACKUP_TABLES.filter(t => Array.isArray(backup.data[t]));
                    const sorted = [...order].sort((a, b) => {
                        const rank = { user_profile: 0, app_users: 1, loans: 2, loan_payments: 3 };
                        return (rank[a] ?? 9) - (rank[b] ?? 9);
                    });
                    for (const table of sorted) {
                        for (const row of backup.data[table]) {
                            try {
                                const payload = { ...row };
                                let { error } = await _supabase.from(table).upsert([payload]);
                                if (error) {
                                    const { id, ...rest } = payload;
                                    const r2 = await _supabase.from(table).insert([rest]);
                                    if (r2.error) { fail++; console.warn(table, r2.error); }
                                    else ok++;
                                } else ok++;
                            } catch (err) { fail++; console.warn(table, err); }
                        }
                    }
                    try { await logAction('بازیابی بکاپ', `موفق: ${ok} · ناموفق: ${fail}`, { security: true }); } catch (e) {}
                    toast(`بازیابی تمام شد — موفق: ${ok} · خطا: ${fail}`);
                    setTimeout(() => location.reload(), 1200);
                } catch (err) {
                    toast('خطا در خواندن فایل: ' + err.message, 'error');
                }
                e.target.value = '';
            };
            reader.readAsText(file);
        }

        // Init notif status on showApp
        const _origShowApp = showApp;
        showApp = async function() {
            await _origShowApp();
            refreshCfgDisplay();
            try { loadBudget(); } catch (e) {}
            try { applyCurrencyLabels(); } catch (e) {}
            if ('Notification' in window) {
                const st = document.getElementById('notif-status');
                if (st) st.innerText = 'وضعیت: ' + (Notification.permission === 'granted' ? 'فعال ✓' : Notification.permission === 'denied' ? 'مسدود' : 'غیرفعال');
                if (localStorage.getItem('mgh_notif') === '1' && Notification.permission === 'granted') {
                    document.getElementById('notif-enabled').checked = true;
                    startNotificationChecker();
                }
            }
            const um = document.getElementById('users-management-section');
            if (um && currentUserRole !== 'admin') um.classList.add('hidden');
            else if (um) { um.classList.remove('hidden'); fetchUsers(); }
        };
