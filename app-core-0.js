,
                    colors: {
                        primary: {
                            50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
                            400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
                            800: '#1e40af', 900: '#1e3a8a', 950: '#172554'
                        }
                    }
                }
            }
        }

// ==================== CONFIG & STATE ====================
        const APP_VERSION = '3.9.1';
        const APP_NAME = 'سیستم جامع مدیریت هوشمند';
        const DEFAULT_ADMIN_USER = 'admin';
        const DEFAULT_ADMIN_PASS_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // SHA256("admin")
        const CFG_KEY = 'mgh_supabase_cfg_v1';
        const DEFAULT_SUPABASE_URL = 'https://przihknusaqtpbeyrwwo.supabase.co';
        const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_-klKgev9J-Isn74qlBDGJg_DnZM6Lu-';

        function loadServerConfig() {
            try {
                const raw = localStorage.getItem(CFG_KEY);
                if (raw) {
                    const c = JSON.parse(raw);
                    if (c.url && c.key) return c;
                }
            } catch (e) {}
            return { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_ANON_KEY };
        }

        function saveServerConfig(url, key) {
            localStorage.setItem(CFG_KEY, JSON.stringify({ url: url.trim(), key: key.trim(), saved_at: new Date().toISOString() }));
        }

        let serverCfg = loadServerConfig();
        let _supabase = supabase.createClient(serverCfg.url, serverCfg.key);

        function reconnectSupabase(url, key) {
            serverCfg = { url, key };
            saveServerConfig(url, key);
            _supabase = supabase.createClient(url, key);
        }

        let currentUser = null;
        let currentUserRole = 'admin';
        let currentUserId = null;
        let sessionEncryptionKey = null;
        let cropper = null;
        let notifCheckInterval = null;
        let croppedAvatarBase64 = '';
        let currentUnlockedNoteId = null;
        let tempNoteContent = '';
        let correctNotePass = '';
        let taskFilter = 'all';
        let noteFilter = '';
        let allContacts = [];
        let calYear = 1404, calMonth = 7; // Will be set to current
        let chartIncomeExpense = null, chartCategories = null, chartTasks = null, chartLoans = null;

        // ==================== CRYPTO ====================
        async function hashPassword(password) {
            const msgBuffer = new TextEncoder().encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        async function deriveEncryptionKey(password) {
            const enc = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
            return await crypto.subtle.deriveKey(
                { name: "PBKDF2", salt: enc.encode("mgh_secure_salt_v3"), iterations: 100000, hash: "SHA-256" },
                keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
            );
        }

        async function encryptData(text) {
            if (!sessionEncryptionKey || text === null || text === undefined || text === '') return text;
            try {
                const enc = new TextEncoder();
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sessionEncryptionKey, enc.encode(String(text)));
                return JSON.stringify({ iv: btoa(String.fromCharCode(...iv)), data: btoa(String.fromCharCode(...new Uint8Array(encrypted))) });
            } catch (e) { return text; }
        }

        async function decryptData(cipherJson) {
            if (!sessionEncryptionKey || !cipherJson) return cipherJson;
            try {
                if (typeof cipherJson !== 'string' || !cipherJson.startsWith('{')) return cipherJson;
                const parsed = JSON.parse(cipherJson);
                if (!parsed.iv || !parsed.data) return cipherJson;
                const iv = Uint8Array.from(atob(parsed.iv), c => c.charCodeAt(0));
                const data = Uint8Array.from(atob(parsed.data), c => c.charCodeAt(0));
                const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sessionEncryptionKey, data);
                return new TextDecoder().decode(decrypted);
            } catch (e) { return cipherJson; }
        }

        // ==================== SESSION SECURITY ====================
        const SESSION_MAX_MS = 8 * 60 * 60 * 1000; // 8 hours
        const MAX_LOGIN_FAILS = 5;
        const LOCK_MS = 5 * 60 * 1000;
        let encryptionEnabled = localStorage.getItem('mgh_encrypt') !== '0';

        function getLoginFails() {
            try { return JSON.parse(localStorage.getItem('mgh_login_fails') || '{"n":0,"until":0}'); }
            catch { return { n: 0, until: 0 }; }
        }
        function setLoginFails(obj) {
            localStorage.setItem('mgh_login_fails', JSON.stringify(obj));
        }
        function isLoginLocked() {
            const f = getLoginFails();
            if (f.until && Date.now() < f.until) return Math.ceil((f.until - Date.now()) / 60000);
            return 0;
        }
        function recordLoginFail() {
            const f = getLoginFails();
            f.n = (f.n || 0) + 1;
            if (f.n >= MAX_LOGIN_FAILS) {
                f.until = Date.now() + LOCK_MS;
                f.n = 0;
            }
            setLoginFails(f);
        }
        function clearLoginFails() { setLoginFails({ n: 0, until: 0 }); }

        function saveSessionMeta(user, role) {
            const exp = Date.now() + SESSION_MAX_MS;
            sessionStorage.setItem('mgh_session', JSON.stringify({ user, role, exp, at: Date.now() }));
            localStorage.setItem('mgh_user', user);
            localStorage.setItem('mgh_role', role || 'admin');
        }
        function clearSessionMeta() {
            sessionStorage.removeItem('mgh_session');
            localStorage.removeItem('mgh_user');
            localStorage.removeItem('mgh_role');
        }
        function validateSession() {
            try {
                const raw = sessionStorage.getItem('mgh_session');
                if (!raw) return false;
                const s = JSON.parse(raw);
                if (!s.exp || Date.now() > s.exp) { clearSessionMeta(); return false; }
                return s;
            } catch { return false; }
        }

        async function encryptSensitive(text) {
            if (!encryptionEnabled || !sessionEncryptionKey) return text;
            return await encryptData(text);
        }

        // ==================== ATTACHMENTS ====================
        const ATTACH_MAX = 5;
        const ATTACH_IMG_MAX = 1.5 * 1024 * 1024;
        const ATTACH_FILE_MAX = 500 * 1024;

        function parseAttachments(raw) {
            if (!raw) return [];
            try {
                if (typeof raw === 'string') {
                    if (!raw.trim() || raw === '[]') return [];
                    const p = JSON.parse(raw);
                    return Array.isArray(p) ? p : [];
                }
                return Array.isArray(raw) ? raw : [];
            } catch { return []; }
        }

        function getDraftAttachments(prefix) {
            return parseAttachments(document.getElementById(prefix + '-attachments')?.value || '[]');
        }
        function setDraftAttachments(prefix, arr) {
            const el = document.getElementById(prefix + '-attachments');
            if (el) el.value = JSON.stringify(arr || []);
            renderAttachPreview(prefix);
        }
        function clearAttachments(prefix) {
            setDraftAttachments(prefix, []);
            const inp = document.getElementById(prefix + '-attach-input');
            if (inp) inp.value = '';
        }

        function renderAttachPreview(prefix) {
            const box = document.getElementById(prefix + '-attach-preview');
            if (!box) return;
            const arr = getDraftAttachments(prefix);
            if (!arr.length) { box.innerHTML = ''; return; }
            box.innerHTML = arr.map((a, i) => {
                const isImg = (a.type || '').startsWith('image/') && a.data;
                if (isImg) {
                    return `<div class="attach-item"><img src="${a.data}" alt="${a.name||''}"><button type="button" class="rm" onclick="removeAttachment('${prefix}',${i})" title="حذف">×</button></div>`;
                }
                const icon = (a.type || '').includes('pdf') ? 'PDF' : 'FILE';
                return `<div class="attach-item"><span>${icon}<br>${(a.name||'فایل').slice(0,12)}</span><button type="button" class="rm" onclick="removeAttachment('${prefix}',${i})" title="حذف">×</button></div>`;
            }).join('');
        }

        function removeAttachment(prefix, idx) {
            const arr = getDraftAttachments(prefix);
            arr.splice(idx, 1);
            setDraftAttachments(prefix, arr);
        }

        function renderAttachmentGallery(raw) {
            const arr = parseAttachments(raw);
            if (!arr.length) return '';
            const items = arr.map((a, i) => {
                const isImg = (a.type || '').startsWith('image/') && a.data;
                if (isImg) {
                    return `<a href="${a.data}" target="_blank" rel="noopener" title="${a.name||'تصویر'}"><img src="${a.data}" alt=""></a>`;
                }
                const href = a.data || '#';
                const label = (a.name || 'فایل').slice(0, 14);
                return `<a href="${href}" download="${a.name||'file'}" title="${a.name||''}" style="flex-direction:column;gap:2px;text-decoration:none;color:inherit"><span style="font-size:16px">📎</span><span>${label}</span></a>`;
            }).join('');
            return `<div class="mt-3"><p class="text-xs font-bold mb-1">پیوست‌ها (${arr.length})</p><div class="attach-gallery">${items}</div></div>`;
        }

        function compressImage(file, maxW = 1200, quality = 0.75) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                    try {
                        let w = img.width, h = img.height;
                        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
                        const canvas = document.createElement('canvas');
                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        URL.revokeObjectURL(url);
                        resolve({ name: (file.name || 'image').replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', size: Math.round(dataUrl.length * 0.75), data: dataUrl });
                    } catch (e) { URL.revokeObjectURL(url); reject(e); }
                };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('خواندن تصویر ناموفق')); };
                img.src = url;
            });
        }

        function readFileAsDataUrl(file) {
            return new Promise((resolve, reject) => {
                if (file.size > ATTACH_FILE_MAX) {
                    reject(new Error(`فایل «${file.name}» بزرگ‌تر از ۵۰۰ کیلوبایت است`));
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: reader.result });
                reader.onerror = () => reject(new Error('خواندن فایل ناموفق'));
                reader.readAsDataURL(file);
            });
        }

        async function onAttachFilesSelected(prefix, fileList) {
            const files = Array.from(fileList || []);
            if (!files.length) return;
            let arr = getDraftAttachments(prefix);
            for (const file of files) {
                if (arr.length >= ATTACH_MAX) { toast('حداکثر ۵ پیوست مجاز است', 'error'); break; }
                try {
                    let item;
                    if ((file.type || '').startsWith('image/')) {
                        if (file.size > 8 * 1024 * 1024) { toast('تصویر خیلی بزرگ است (حد ۸ مگ)', 'error'); continue; }
                        item = await compressImage(file);
                        if (item.data && item.data.length > ATTACH_IMG_MAX * 1.4) {
                            item = await compressImage(file, 900, 0.6);
                        }
                    } else {
                        item = await readFileAsDataUrl(file);
                    }
                    arr.push(item);
                } catch (e) {
                    toast(e.message || 'خطا در خواندن فایل', 'error');
                }
            }
            setDraftAttachments(prefix, arr);
            const inp = document.getElementById(prefix + '-attach-input');
            if (inp) inp.value = '';
        }


        async function decryptSensitive(text) {
            return await toText(text);
        }

        function openForgotPassword() {
            document.getElementById('forgot-email').value = '';
            document.getElementById('forgot-mobile').value = '';
            document.getElementById('forgot-new-pass').value = '';
            document.getElementById('forgot-confirm').value = '';
            document.getElementById('forgot-msg').innerText = '';
            openModal('forgot-pass-modal');
            lucide.createIcons();
        }

        async function resetPasswordWithRecovery() {
            const email = (document.getElementById('forgot-email').value || '').trim().toLowerCase();
            const mobile = V.normalizeMobile(document.getElementById('forgot-mobile').value || '') || V.onlyDigits(document.getElementById('forgot-mobile').value || '');
            const np = document.getElementById('forgot-new-pass').value;
            const cp = document.getElementById('forgot-confirm').value;
            const msg = document.getElementById('forgot-msg');
            if (!email || !mobile) { msg.innerText = 'ایمیل و موبایل الزامی است'; msg.className = 'text-xs text-red-600'; return; }
            if (!np || np.length < 8) { msg.innerText = 'رمز جدید حداقل ۸ کاراکتر'; msg.className = 'text-xs text-red-600'; return; }
            if (np !== cp) { msg.innerText = 'تکرار رمز مطابقت ندارد'; msg.className = 'text-xs text-red-600'; return; }
            try {
                let { data } = await _supabase.from('user_profile').select('*').limit(1);
                if (!data || !data.length) { msg.innerText = 'پروفایلی یافت نشد'; msg.className = 'text-xs text-red-600'; return; }
                const p = data[0];
                const re = String(p.recovery_email || '').trim().toLowerCase();
                const rm = V.normalizeMobile(p.recovery_mobile || '') || V.onlyDigits(p.recovery_mobile || '');
                if (!re || !rm) {
                    msg.innerText = 'ابتدا از داخل برنامه (با رمز فعلی) ایمیل و موبایل بازیابی را ذخیره کنید';
                    msg.className = 'text-xs text-amber-600';
                    return;
                }
                if (email !== re || mobile !== rm) {
                    await logAction('بازیابی ناموفق', 'ایمیل/موبایل نامعتبر', { security: true });
                    msg.innerText = 'ایمیل یا موبایل با اطلاعات ثبت‌شده مطابقت ندارد';
                    msg.className = 'text-xs text-red-600';
                    return;
                }
                const newHash = await hashPassword(np);
                const { error } = await _supabase.from('user_profile').update({ admin_pass: newHash }).eq('id', p.id);
                if (error) throw error;
                try { await _supabase.from('app_users').update({ password_hash: newHash }).eq('username', p.admin_user || 'admin'); } catch (e) {}
                await logAction('بازیابی رمز', 'رمز با ایمیل و موبایل تغییر کرد', { security: true });
                msg.innerText = 'رمز با موفقیت تغییر کرد. اکنون وارد شوید.';
                msg.className = 'text-xs text-emerald-600';
                setTimeout(() => closeModal('forgot-pass-modal'), 1200);
                toast('رمز جدید ذخیره شد');
            } catch (err) {
                msg.innerText = 'خطا: ' + (err.message || err);
                msg.className = 'text-xs text-red-600';
            }
        }

        // ==================== UTILS ====================
        let currencyUnit = localStorage.getItem('mgh_currency') || 'toman'; // toman | rial

        function currencyLabel() {
            return currencyUnit === 'rial' ? 'ریال' : 'تومان';
        }
        function formatNum(n) {
            return Number(n || 0).toLocaleString('fa-IR');
        }
        function formatMoney(n) {
            return formatNum(n) + ' ' + currencyLabel();
        }
        function changeCurrency(unit) {
            const next = (unit === 'rial') ? 'rial' : 'toman';
            const prev = currencyUnit;
            if (next === prev) return;
            const convert = confirm(
                (next === 'rial'
                    ? 'تبدیل همه مبالغ ذخیره‌شده به ریال؟ (×۱۰)\n'
                    : 'تبدیل همه مبالغ ذخیره‌شده به تومان؟ (÷۱۰)\n')
                + 'لغو = فقط برچسب نمایش عوض شود، اعداد دیتابیس ثابت بمانند.'
            );
            currencyUnit = next;
            localStorage.setItem('mgh_currency', currencyUnit);
            document.querySelectorAll('.currency-unit-label').forEach(el => { el.innerText = currencyLabel(); });
            if (convert) {
                convertAllAmounts(prev, next).then(() => {
                    logAction('تبدیل واحد پول', prev + ' → ' + next + ' با تبدیل اعداد', { security: true });
                    fetchTransactions(); fetchLoans(); updateDashboard();
                    toast('تبدیل مبالغ انجام شد · واحد: ' + currencyLabel());
                }).catch(e => {
                    toast('خطا در تبدیل: ' + (e.message || e), 'error');
                });
            } else {
                try { logAction('تنظیم واحد پول', 'فقط برچسب: ' + currencyLabel()); } catch (e) {}
                try { fetchTransactions(); fetchLoans(); updateDashboard(); } catch (e) {}
                toast('واحد نمایش: ' + currencyLabel());
            }
        }
        async function convertAllAmounts(from, to) {
            const factor = (from === 'toman' && to === 'rial') ? 10 : (from === 'rial' && to === 'toman') ? 0.1 : 1;
            if (factor === 1) return;
            const scale = (n) => Math.round(Number(n || 0) * factor);
            // transactions
            const { data: txs } = await _supabase.from('transactions').select('id,amount');
            for (const row of (txs || [])) {
                const a = await toNum(row.amount);
                await _supabase.from('transactions').update({ amount: scale(a) }).eq('id', row.id);
            }
            // loans
            const { data: loans } = await _supabase.from('loans').select('*');
            for (const L of (loans || [])) {
                const patch = {
                    total_amount: scale(await toNum(L.total_amount)),
                    bank_fee: scale(await toNum(L.bank_fee)),
                    net_received: scale(await toNum(L.net_received)),
                    monthly_payment: scale(await toNum(L.monthly_payment)),
                    remaining_amount: scale(await toNum(L.remaining_amount))
                };
                if (L.total_interest != null) patch.total_interest = scale(await toNum(L.total_interest));
                if (L.total_repay != null) patch.total_repay = scale(await toNum(L.total_repay));
                await _supabase.from('loans').update(patch).eq('id', L.id);
            }
            // budget local
            const b = localStorage.getItem('mgh_budget_limit');
            if (b) localStorage.setItem('mgh_budget_limit', String(scale(b)));
        }
        function applyCurrencyLabels() {
            document.querySelectorAll('.currency-unit-label').forEach(el => { el.innerText = currencyLabel(); });
            const sel = document.getElementById('prof-currency');
            if (sel) sel.value = currencyUnit;
        }

        // Parse number that may be plain numeric OR encrypted JSON string (legacy)
        async function toNum(val) {
            if (val === null || val === undefined || val === '') return 0;
            if (typeof val === 'number') return val;
            const s = String(val);
            if (s.startsWith('{') && s.includes('iv')) {
                const d = await decryptData(s);
                return Number(d) || 0;
            }
            return Number(s) || 0;
        }

        // Parse text that may be plain OR encrypted
        async function toText(val) {
            if (val === null || val === undefined) return '';
            const s = String(val);
            if (s.startsWith('{') && s.includes('"iv"')) return await decryptData(s);
            return s;
        }

        function openModal(id) {
            const el = document.getElementById(id);
            el.classList.remove('hidden');
            el.classList.add('flex');
            setTimeout(() => lucide.createIcons(), 50);
        }

        function closeModal(id) {
            const el = document.getElementById(id);
            el.classList.add('hidden');
            el.classList.remove('flex');
        }

        function toast(msg, type = 'success') {
            const existing = document.getElementById('app-toast');
            if (existing) existing.remove();
            const el = document.createElement('div');
            el.id = 'app-toast';
            el.className = `fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl shadow-xl text-sm font-medium text-white animate-fade ${type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`;
            el.innerText = msg;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 3500);
        }

        // ==================== VALIDATION (Iran rules) ====================
        const V = {
            toEnDigits(str) {
                if (str === null || str === undefined) return '';
                return String(str)
                    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
                    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
            },
            onlyDigits(str) {
                return this.toEnDigits(str).replace(/\D/g, '');
            },
            mobile(val, required = false) {
                if (!val || !String(val).trim()) return required ? 'شماره موبایل الزامی است' : null;
                const d = this.onlyDigits(val);
                if (d.length === 10 && d.startsWith('9')) return null;
                if (d.length === 11 && d.startsWith('09')) return null;
                if (d.length >= 12 && (d.startsWith('989') || d.startsWith('00989'))) return null;
                return 'موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)';
            },
            landline(val, required = false) {
                if (!val || !String(val).trim()) return required ? 'شماره تلفن الزامی است' : null;
                const d = this.onlyDigits(val);
                if (d.length >= 8 && d.length <= 11) return null;
                return 'تلفن ثابت معتبر نیست (۸ تا ۱۱ رقم، با کد شهر)';
            },
            phoneAny(val, required = false) {
                if (!val || !String(val).trim()) return required ? 'شماره تماس الزامی است' : null;
                const d = this.onlyDigits(val);
                if (d.length >= 8 && d.length <= 13) return null;
                return 'شماره تماس معتبر نیست';
            },
            jalaliDate(val, required = false) {
                if (!val || !String(val).trim()) return required ? 'تاریخ الزامی است' : null;
                const s = this.toEnDigits(String(val).trim()).replace(/-/g, '/');
                const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
                if (!m) return 'فرمت تاریخ شمسی: ۱۴۰۴/۰۷/۲۰';
                const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
                if (y < 1300 || y > 1500) return 'سال شمسی نامعتبر (۱۳۰۰ تا ۱۵۰۰)';
                if (mo < 1 || mo > 12) return 'ماه باید بین ۱ تا ۱۲ باشد';
                const maxD = mo <= 6 ? 31 : 30;
                if (d < 1 || d > maxD) return 'روز برای این ماه نامعتبر است';
                return null;
            },
            amount(val, required = true) {
                if (val === null || val === undefined || String(val).trim() === '')
                    return required ? 'مبلغ الزامی است' : null;
                const n = Number(this.toEnDigits(String(val)).replace(/,/g, ''));
                if (isNaN(n)) return 'مبلغ باید عدد باشد';
                if (n <= 0) return 'مبلغ باید بزرگ‌تر از صفر باشد';
                if (n > 1e15) return 'مبلغ بیش از حد مجاز است';
                return null;
            },
            positiveInt(val, required = true, min = 1, max = 1200) {
                if (val === null || val === undefined || String(val).trim() === '')
                    return required ? 'این فیلد الزامی است' : null;
                const n = parseInt(this.toEnDigits(String(val)), 10);
                if (isNaN(n) || n < min) return `عدد باید حداقل ${min} باشد`;
                if (n > max) return `عدد نباید بیشتر از ${max} باشد`;
                return null;
            },
            email(val, required = false) {
                if (!val || !String(val).trim()) return required ? 'ایمیل الزامی است' : null;
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(val).trim())) return 'ایمیل معتبر نیست';
                return null;
            },
            required(val, label = 'این فیلد') {
                if (val === null || val === undefined || String(val).trim() === '') return `${label} الزامی است`;
                return null;
            },
            minLength(val, min, label = 'این فیلد') {
                if (!val) return null;
                if (String(val).trim().length < min) return `${label} حداقل ${min} کاراکتر باشد`;
                return null;
            },
            maxLength(val, max, label = 'این فیلد') {
                if (!val) return null;
                if (String(val).length > max) return `${label} حداکثر ${max} کاراکتر باشد`;
                return null;
            },
            password(val, required = false) {
                if (!val || !String(val).trim()) return required ? 'رمز عبور الزامی است' : null;
                if (String(val).length < 6) return 'رمز عبور حداقل ۶ کاراکتر باشد';
                return null;
            },
            normalizeMobile(val) {
                let d = this.onlyDigits(val);
                if (d.startsWith('0098')) d = '0' + d.slice(4);
                else if (d.startsWith('98') && d.length >= 12) d = '0' + d.slice(2);
                else if (d.length === 10 && d.startsWith('9')) d = '0' + d;
                return d;
            },
            firstError(...checks) {
                for (const c of checks) { if (c) return c; }
                return null;
            }
        };

        function bindNumericInputs() {
            const phoneIds = ['contact-mobile', 'contact-phone2', 'contact-work', 'contact-home'];
            phoneIds.forEach(id => {
                const el = document.getElementById(id);
                if (!el || el.dataset.boundNum) return;
                el.dataset.boundNum = '1';
                el.setAttribute('inputmode', 'numeric');
                el.setAttribute('maxlength', '13');
                el.addEventListener('input', function () {
                    this.value = V.toEnDigits(this.value).replace(/[^\d+]/g, '');
                });
            });
            ['tx-amount', 'loan-principal', 'loan-rate', 'loan-fee', 'loan-monthly', 'loan-count', 'loan-paid-count', 'loan-years'].forEach(id => {
                const el = document.getElementById(id);
                if (!el || el.dataset.boundNum) return;
                el.dataset.boundNum = '1';
                el.addEventListener('input', function () {
                    this.value = V.toEnDigits(this.value).replace(/[^\d.]/g, '');
                });
            });
        }

        function nowJalali() {
            const j = gregorianToJalali(new Date());
            return `${j.jy}/${String(j.jm).padStart(2,'0')}/${String(j.jd).padStart(2,'0')}`;
        }

        // --- Accurate Gregorian ↔ Jalali ---
        function gregorianToJalali(date) {
            let gy = date.getFullYear();
            let gm = date.getMonth() + 1;
            let gd = date.getDate();
            const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
            let jy = (gy <= 1600) ? 0 : 979;
            gy -= (gy <= 1600) ? 621 : 1600;
            const gy2 = (gm > 2) ? (gy + 1) : gy;
            let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
            jy += 33 * Math.floor(days / 12053);
            days %= 12053;
            jy += 4 * Math.floor(days / 1461);
            days %= 1461;
            if (days > 365) {
                jy += Math.floor((days - 1) / 365);
                days = (days - 1) % 365;
            }
            const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
            const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
            return { jy, jm, jd };
        }

        function jalaliToGregorian(jy, jm, jd) {
            let gy = (jy <= 979) ? 621 : 1600;
            jy -= (jy <= 979) ? 0 : 979;
            const days = (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30 + 186));
            gy += 400 * Math.floor(days / 146097);
            let d = days % 146097;
            if (d > 36524) {
                gy += 100 * Math.floor(--d / 36524);
                d %= 36524;
                if (d >= 365) d++;
            }
            gy += 4 * Math.floor(d / 1461);
            d %= 1461;
            if (d > 365) {
                gy += Math.floor((d - 1) / 365);
                d = (d - 1) % 365;
            }
            const gd = d + 1;
            const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            let gm = 0;
            let v = gd;
            for (gm = 1; gm <= 12 && v > sal_a[gm]; gm++) v -= sal_a[gm];
            return new Date(gy, gm - 1, v);
        }

        function getCurrentJalaliYM() {
            const j = gregorianToJalali(new Date());
            return { y: j.jy, m: j.jm, d: j.jd };
        }

        // Weekday of Jalali date: 0=Saturday ... 6=Friday (Iran week)
