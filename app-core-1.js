        function jalaliWeekday(jy, jm, jd) {
            const g = jalaliToGregorian(jy, jm, jd);
            // JS: 0=Sun ... 6=Sat → convert to 0=Sat ... 6=Fri
            const js = g.getDay(); // 0 Sun
            return (js + 1) % 7; // Sat=0, Sun=1, ..., Fri=6
        }

        // ==================== AUTH ====================
        window.onload = async () => {
            document.getElementById('login-modal').classList.remove('hidden');
            document.getElementById('login-modal').classList.add('flex');
            document.getElementById('sidebar').classList.add('hidden');
            document.getElementById('main-wrapper').classList.add('hidden');
            lucide.createIcons();
            
            // Ensure default admin exists
            try {
                let { data } = await _supabase.from('user_profile').select('*').limit(1);
                if (!data || data.length === 0) {
                    await _supabase.from('user_profile').insert([{
                        admin_user: DEFAULT_ADMIN_USER,
                        admin_pass: DEFAULT_ADMIN_PASS_HASH,
                        name: 'مدیر سیستم',
                        theme: 'slate',
                        font_family: 'font-vazir',
                        font_size: 'size-small'
                    }]);
                }
            } catch (e) { console.warn('Init profile:', e); }
        };

        async function handleLogin(e) {
            if (e) e.preventDefault();
            const lockedMin = isLoginLocked();
            if (lockedMin > 0) {
                alert('به دلیل تلاش‌های ناموفق، ورود تا ' + lockedMin + ' دقیقه قفل است.');
                return;
            }
            const u = document.getElementById('login-user').value.trim();
            const p = document.getElementById('login-pass').value;
            const btn = document.getElementById('login-btn');
            btn.disabled = true;
            btn.innerText = 'در حال بررسی امنیتی...';

            try {
                // Optional Supabase Auth for email users
                if (u.includes('@') && _supabase?.auth?.signInWithPassword) {
                    try {
                        const { data: authData, error: authErr } = await _supabase.auth.signInWithPassword({ email: u, password: p });
                        if (!authErr && authData?.user) {
                            sessionEncryptionKey = await deriveEncryptionKey(p);
                            currentUser = authData.user.email || u;
                            currentUserRole = 'admin';
                            clearLoginFails();
                            saveSessionMeta(currentUser, 'admin');
                            await logAction('ورود', 'ورود با Supabase Auth: ' + currentUser, { security: true });
                            showApp();
                            return;
                        }
                    } catch (ae) {}
                }

                let { data, error } = await _supabase.from('user_profile').select('*').limit(1);
                if (error) {
                    alert('خطا در اتصال به دیتابیس: ' + error.message);
                    btn.disabled = false; btn.innerText = 'ورود به سامانه';
                    return;
                }

                let profile = (data && data.length > 0) ? data[0] : {
                    admin_user: DEFAULT_ADMIN_USER,
                    admin_pass: DEFAULT_ADMIN_PASS_HASH
                };

                if (profile.admin_pass === '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' && u === 'admin' && p === 'admin') {
                    const hashed = await hashPassword('admin');
                    if (data && data.length > 0) {
                        await _supabase.from('user_profile').update({ admin_user: 'admin', admin_pass: hashed }).eq('id', data[0].id);
                    }
                    profile.admin_user = 'admin';
                    profile.admin_pass = hashed;
                }

                // also try app_users
                let ok = false;
                let role = 'admin';
                const hashedInput = await hashPassword(p);
                const storedUser = (profile.admin_user || 'admin').toLowerCase();
                if (u.toLowerCase() === storedUser && hashedInput === profile.admin_pass) {
                    ok = true; role = 'admin';
                } else {
                    try {
                        const { data: users } = await _supabase.from('app_users').select('*').eq('username', u).limit(1);
                        if (users && users[0] && users[0].password_hash === hashedInput && users[0].is_active !== false) {
                            ok = true;
                            role = users[0].role || 'user';
                            currentUserId = users[0].id;
                        }
                    } catch (e) {}
                }

                if (ok) {
                    sessionEncryptionKey = await deriveEncryptionKey(p);
                    currentUser = u;
                    currentUserRole = role;
                    clearLoginFails();
                    saveSessionMeta(currentUser, role);
                    encryptionEnabled = localStorage.getItem('mgh_encrypt') !== '0';
                    await logAction('ورود', 'ورود موفق کاربر ' + currentUser, { security: true });
                    showApp();
                } else {
                    recordLoginFail();
                    await logAction('ورود ناموفق', 'تلاش ناموفق: ' + u, { security: true });
                    const left = MAX_LOGIN_FAILS - (getLoginFails().n || 0);
                    alert('نام کاربری یا رمز عبور اشتباه است!' + (left > 0 && left < MAX_LOGIN_FAILS ? '\nمانده تا قفل: ' + left : ''));
                    btn.disabled = false; btn.innerText = 'ورود به سامانه';
                }
            } catch (err) {
                alert('خطای سیستمی: ' + err.message);
                btn.disabled = false; btn.innerText = 'ورود به سامانه';
            }
        }

        function logout() {
            logAction('خروج', 'خروج امن از سامانه', { security: true });
            clearSessionMeta();
            sessionEncryptionKey = null;
            currentUser = null;
            location.reload();
        }

        async function showApp() {
            document.getElementById('login-modal').classList.add('hidden');
            document.getElementById('login-modal').classList.remove('flex');
            document.getElementById('sidebar').classList.remove('hidden');
            document.getElementById('sidebar').classList.add('flex');
            document.getElementById('main-wrapper').classList.remove('hidden');
            
            // Init Jalali picker
            if (typeof jalaliDatepicker !== 'undefined') {
                jalaliDatepicker.startWatch({
                    time: false,
                    hasSecond: false,
                    hideAfterChange: true,
                    useDropDownYears: true
                });
            }
            
            await loadProfileData();
            await Promise.all([
                fetchTransactions(),
                fetchLoans(),
                fetchContacts(),
                fetchTasks(),
                fetchNotes(),
                fetchLogs(),
                updateDashboard()
            ]);
            
            initCalSelectors();
            renderCalendar();
            bindNumericInputs();
            
            const jToday = getCurrentJalaliYM();
            const weekNames = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
            const monthNamesFa = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
            // JS getDay: 0=Sun → map
            const wd = new Date().getDay();
            const wdFa = weekNames[wd];
            document.getElementById('dashboard-date').innerText = `${wdFa} ${jToday.d} ${monthNamesFa[jToday.m - 1]} ${jToday.y}`;
            lucide.createIcons();
            switchTab('dashboard');
        }

        // ==================== LOGGING ====================
        async function logAction(action, details, meta = {}) {
            try {
                const payload = {
                    action: String(action || 'رویداد').slice(0, 120),
                    details: typeof details === 'string' ? details : JSON.stringify(details),
                    meta: JSON.stringify({
                        user: currentUser || 'guest',
                        role: typeof currentUserRole !== 'undefined' ? currentUserRole : '',
                        ts: new Date().toISOString(),
                        path: location.pathname,
                        ua: (navigator.userAgent || '').slice(0, 120),
                        ver: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '',
                        ...meta
                    })
                };
                const { error } = await _supabase.from('activity_logs').insert([payload]);
                if (error) {
                    // fallback without meta column
                    await _supabase.from('activity_logs').insert([{ action: payload.action, details: payload.details }]);
                }
            } catch (e) { console.warn('Log failed', e); }
        }

        // ==================== NAVIGATION ====================
        function switchTab(tabName) {
            const tabs = ['dashboard', 'finance', 'contacts', 'tasks', 'notes', 'calendar', 'reports', 'logs', 'settings'];
            tabs.forEach(t => {
                const el = document.getElementById(`tab-${t}`);
                if (el) el.classList.add('hidden');
                const nav = document.getElementById(`nav-${t}`);
                if (nav) nav.classList.remove('active');
                const mnav = document.getElementById(`mnav-${t}`);
                if (mnav) { mnav.classList.remove('mnav-active'); mnav.classList.add('text-slate-500'); }
            });
            document.getElementById(`tab-${tabName}`)?.classList.remove('hidden');
            document.getElementById(`nav-${tabName}`)?.classList.add('active');
            const mnav = document.getElementById(`mnav-${tabName}`);
            if (mnav) { mnav.classList.add('mnav-active'); mnav.classList.remove('text-slate-500'); }

            // همیشه هنگام ورود به تب، داده تازه بارگذاری شود
            if (tabName === 'finance') { fetchTransactions(); fetchLoans(); }
            if (tabName === 'contacts') fetchContacts();
            if (tabName === 'tasks') fetchTasks();
            if (tabName === 'notes') fetchNotes();
            if (tabName === 'reports') setTimeout(renderReports, 80);
            if (tabName === 'calendar') renderCalendar();
            if (tabName === 'logs') fetchLogs();
            if (tabName === 'dashboard') updateDashboard();
            try { logAction('ناوبری', 'ورود به بخش «' + tabName + '»', { module: tabName }); } catch (e) {}
            lucide.createIcons();
        }

        // select با fallback اگر order/created_at خطا بدهد
        async function safeSelect(table, orderCol = 'created_at') {
            let res = await _supabase.from(table).select('*').order(orderCol, { ascending: false });
            if (res.error) {
                console.warn('safeSelect order fail', table, res.error.message);
                res = await _supabase.from(table).select('*');
            }
            if (res.error) {
                console.error('safeSelect fail', table, res.error);
                toast('خطا در خواندن «' + table + '»: ' + res.error.message, 'error');
                return [];
            }
            return res.data || [];
        }

        function cleanPhone(n) {
            if (!n) return '';
            let d = String(n).replace(/[^\d+]/g, '');
            if (d.startsWith('00')) d = '+' + d.slice(2);
            return d;
        }
        function hrefCall(n) {
            const p = cleanPhone(n);
            return p ? 'tel:' + p : '';
        }
        function hrefSms(n) {
            const p = cleanPhone(n);
            return p ? 'sms:' + p : '';
        }
        function hrefMail(e) {
            const m = String(e || '').trim();
            return m && m.includes('@') ? 'mailto:' + encodeURIComponent(m).replace(/%40/g, '@') : '';
        }
        function contactActionButtons(mobile, email) {
            const call = hrefCall(mobile);
            const sms = hrefSms(mobile);
            const mail = hrefMail(email);
            let html = '';
            if (call) html += `<a href="${call}" class="action-btn action-call flex-1" title="تماس تلفنی"><i data-lucide="phone" class="w-3.5 h-3.5"></i> تماس</a>`;
            if (sms) html += `<a href="${sms}" class="action-btn action-sms flex-1" title="ارسال پیامک"><i data-lucide="message-square" class="w-3.5 h-3.5"></i> پیامک</a>`;
            if (mail) html += `<a href="${mail}" class="action-btn action-mail flex-1" title="ارسال ایمیل"><i data-lucide="mail" class="w-3.5 h-3.5"></i> ایمیل</a>`;
            return html;
        }

        // ==================== THEME / FONT ====================
        function changeTheme(theme) {
            const body = document.getElementById('app-body');
            const classes = body.className.split(/\s+/).filter(c => c && !c.startsWith('theme-'));
            body.className = [...classes, `theme-${theme}`].join(' ');
        }
        function changeFont(fontClass) {
            const body = document.getElementById('app-body');
            const classes = body.className.split(/\s+/).filter(c => c && !c.startsWith('font-'));
            body.className = [...classes, fontClass].join(' ');
            // charts use Vazirmatn by default; no need to break layout
        }
        function changeFontSize(sizeClass) {
            const html = document.documentElement;
            html.classList.remove('size-xsmall', 'size-small', 'size-medium', 'size-large', 'size-xlarge');
            html.classList.add(sizeClass);
            const body = document.getElementById('app-body');
            const classes = body.className.split(/\s+/).filter(c => c && !c.startsWith('size-'));
            body.className = [...classes, sizeClass].join(' ');
        }

        // ==================== PROFILE ====================
        async function loadProfileData() {
            let { data } = await _supabase.from('user_profile').select('*').limit(1);
            if (data && data.length > 0) {
                const p = data[0];
                window._userProfile = p;
                const name = p.name || 'مدیر سیستم';
                document.getElementById('sidebar-username').innerText = name;
                document.getElementById('header-username').innerText = name;
                document.getElementById('prof-name').value = name;
                if (document.getElementById('prof-job')) document.getElementById('prof-job').value = p.job_title || '';
                if (document.getElementById('prof-bio')) document.getElementById('prof-bio').value = p.bio || '';
                if (document.getElementById('prof-experience')) document.getElementById('prof-experience').value = p.experience || '';
                if (document.getElementById('prof-skills')) document.getElementById('prof-skills').value = p.skills || '';
                if (document.getElementById('prof-resume')) document.getElementById('prof-resume').value = p.resume || '';
                if (document.getElementById('prof-recovery-email')) document.getElementById('prof-recovery-email').value = p.recovery_email || '';
                if (document.getElementById('prof-recovery-mobile')) document.getElementById('prof-recovery-mobile').value = p.recovery_mobile || '';
                if (document.getElementById('prof-encrypt-data')) document.getElementById('prof-encrypt-data').checked = localStorage.getItem('mgh_encrypt') !== '0';
                if (p.avatar_url) {
                    document.getElementById('sidebar-avatar').src = p.avatar_url;
                    document.getElementById('header-avatar').src = p.avatar_url;
                    document.getElementById('profile-preview').src = p.avatar_url;
                }
                if (p.theme) { document.getElementById('prof-theme').value = p.theme; changeTheme(p.theme); }
                if (p.font_family) { document.getElementById('prof-font').value = p.font_family; changeFont(p.font_family); }
                if (p.font_size) { document.getElementById('prof-size').value = p.font_size; changeFontSize(p.font_size); }
            }
        }

        async function openUserProfileModal() {
            let p = window._userProfile;
            if (!p) {
                const { data } = await _supabase.from('user_profile').select('*').limit(1);
                p = (data && data[0]) || {};
                window._userProfile = p;
            }
            const name = p.name || document.getElementById('header-username')?.innerText || 'کاربر';
            const avatar = p.avatar_url || document.getElementById('header-avatar')?.src || '';
            document.getElementById('pv-name').innerText = name;
            document.getElementById('pv-avatar').src = avatar;
            const job = p.job_title || '';
            document.getElementById('pv-job').innerText = job;
            const setBox = (boxId, elId, val, isSkills) => {
                const box = document.getElementById(boxId);
                if (!val || !String(val).trim()) { box.classList.add('hidden'); return; }
                box.classList.remove('hidden');
                if (isSkills) {
                    document.getElementById(elId).innerHTML = String(val).split(/[,،]/).map(s => s.trim()).filter(Boolean)
                        .map(s => `<span class="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">${s}</span>`).join('');
                } else {
                    document.getElementById(elId).innerText = val;
                }
            };
            setBox('pv-bio-box', 'pv-bio', p.bio);
            setBox('pv-exp-box', 'pv-experience', p.experience);
            setBox('pv-skills-box', 'pv-skills', p.skills, true);
            setBox('pv-resume-box', 'pv-resume', p.resume);
            openModal('profile-view-modal');
            lucide.createIcons();
        }

        function initCropper(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { alert('حجم تصویر حداکثر ۵ مگابایت'); return; }
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('image-to-crop').src = ev.target.result;
                openModal('cropper-modal');
                if (cropper) cropper.destroy();
                cropper = new Cropper(document.getElementById('image-to-crop'), {
                    aspectRatio: 1,
                    viewMode: 1,
                    autoCropArea: 0.8,
                    responsive: true
                });
            };
            reader.readAsDataURL(file);
        }

        function cropImage() {
            const canvas = cropper.getCroppedCanvas({ width: 200, height: 200, imageSmoothingQuality: 'high' });
            croppedAvatarBase64 = canvas.toDataURL('image/jpeg', 0.7);
            document.getElementById('profile-preview').src = croppedAvatarBase64;
            closeCropper();
            toast('تصویر برش داده شد — برای ذخیره دکمه ذخیره را بزنید');
        }

        function closeCropper() {
            closeModal('cropper-modal');
            if (cropper) { cropper.destroy(); cropper = null; }
        }

        async function updateProfile(e) {
            e.preventDefault();
            const name = document.getElementById('prof-name').value.trim();
            const currentPass = document.getElementById('prof-current-pass').value;
            const newPass = document.getElementById('prof-new-pass').value;
            const confirmPass = document.getElementById('prof-confirm-pass').value;
            const recovery_email = (document.getElementById('prof-recovery-email')?.value || '').trim().toLowerCase();
            const recovery_mobile_raw = document.getElementById('prof-recovery-mobile')?.value || '';
            const recovery_mobile = (typeof V !== 'undefined' && V.normalizeMobile)
                ? (V.normalizeMobile(recovery_mobile_raw) || V.onlyDigits(recovery_mobile_raw))
                : recovery_mobile_raw.replace(/\D/g,'');
            if (document.getElementById('prof-encrypt-data')) {
                encryptionEnabled = !!document.getElementById('prof-encrypt-data').checked;
                localStorage.setItem('mgh_encrypt', encryptionEnabled ? '1' : '0');
            }
            const theme = document.getElementById('prof-theme').value;
            const font_family = document.getElementById('prof-font').value;
            const font_size = document.getElementById('prof-size').value;
            const job_title = document.getElementById('prof-job')?.value?.trim() || '';
            const bio = document.getElementById('prof-bio')?.value?.trim() || '';
            const experience = document.getElementById('prof-experience')?.value?.trim() || '';
            const skills = document.getElementById('prof-skills')?.value?.trim() || '';
            const resume = document.getElementById('prof-resume')?.value?.trim() || '';

            if (!name) { toast('نام نمایشی الزامی است', 'error'); return; }

            let payload = { name, theme, font_family, font_size, job_title, bio, experience, skills, resume, recovery_email, recovery_mobile };

            // Password change
            if (newPass || confirmPass || currentPass) {
                if (!currentPass) { toast('رمز فعلی الزامی است (یا از فراموشی رمز استفاده کنید)', 'error'); return; }
                if (newPass && newPass.length < 8) { toast('رمز جدید حداقل ۸ کاراکتر باشد', 'error'); return; }
                if (newPass !== confirmPass) { toast('رمز جدید و تکرار آن مطابقت ندارند', 'error'); return; }

                const hashedCurrent = await hashPassword(currentPass);
                let passOk = false;

                // Check user_profile
                let { data: profiles } = await _supabase.from('user_profile').select('*').limit(1);
                if (profiles && profiles.length > 0) {
                    if (hashedCurrent === profiles[0].admin_pass) passOk = true;
                    // Also accept if still old 123456 hash and user typed admin
                    if (profiles[0].admin_pass === '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' && currentPass === 'admin') passOk = true;
                    if (profiles[0].admin_pass === DEFAULT_ADMIN_PASS_HASH && currentPass === 'admin') passOk = true;
                }

                // Check app_users for current logged-in user
                if (!passOk && currentUser) {
                    try {
                        let { data: users } = await _supabase.from('app_users').select('*').eq('username', currentUser).limit(1);
                        if (users && users.length > 0 && users[0].password_hash === hashedCurrent) passOk = true;
                    } catch (e) {}
                }

                if (!passOk) {
                    toast('رمز عبور فعلی اشتباه است', 'error');
                    await logAction('تغییر رمز ناموفق', 'رمز فعلی اشتباه وارد شد');
                    return;
                }

                if (newPass) {
                    const newHash = await hashPassword(newPass);
                    payload.admin_pass = newHash;
                    sessionEncryptionKey = await deriveEncryptionKey(newPass);
                    await logAction('تغییر رمز', 'رمز عبور از تنظیمات تغییر کرد', { security: true });

                    // Also update app_users if exists
                    try {
                        if (currentUserId) {
                            await _supabase.from('app_users').update({ password_hash: newHash }).eq('id', currentUserId);
                        } else if (currentUser) {
                            await _supabase.from('app_users').update({ password_hash: newHash }).eq('username', currentUser);
                        }
                    } catch (e) {}

                    await logAction('تغییر رمز', 'رمز عبور با موفقیت تغییر کرد');
                    toast('رمز عبور تغییر کرد', 'success');
                }
            }

            // Compress avatar more to avoid DB size limits
            if (croppedAvatarBase64) {
                try {
                    const img = new Image();
                    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = croppedAvatarBase64; });
                    const c = document.createElement('canvas');
                    c.width = 200; c.height = 200;
                    c.getContext('2d').drawImage(img, 0, 0, 200, 200);
                    payload.avatar_url = c.toDataURL('image/jpeg', 0.65);
                } catch (e) {
                    payload.avatar_url = croppedAvatarBase64;
                }
            }

            // Apply theme/font immediately
            changeTheme(theme);
            changeFont(font_family);
            changeFontSize(font_size);

            try {
                let { data, error: selErr } = await _supabase.from('user_profile').select('id').limit(1);
                if (selErr) throw selErr;

                const tryWrite = async (p) => {
                    if (data && data.length > 0) return await _supabase.from('user_profile').update(p).eq('id', data[0].id);
                    const ins = { ...p, admin_user: DEFAULT_ADMIN_USER, admin_pass: p.admin_pass || DEFAULT_ADMIN_PASS_HASH };
                    return await _supabase.from('user_profile').insert([ins]);
                };
                let { error } = await tryWrite(payload);
                if (error && error.message && error.message.includes('column')) {
                    // core fields only if extended profile columns missing
                    const core = { name, theme, font_family, font_size };
                    if (payload.avatar_url) core.avatar_url = payload.avatar_url;
                    if (payload.admin_pass) core.admin_pass = payload.admin_pass;
                    ({ error } = await tryWrite(core));
                    if (!error) toast('ظاهر ذخیره شد — برای رزومه/سوابق ستون‌های پروفایل را در دیتابیس اضافه کنید', 'info');
                }
                if (error) throw error;

                document.getElementById('prof-current-pass').value = '';
                document.getElementById('prof-new-pass').value = '';
                document.getElementById('prof-confirm-pass').value = '';
                croppedAvatarBase64 = '';
                window._userProfile = { ...(window._userProfile || {}), ...payload };

                // Update UI avatars immediately
                if (payload.avatar_url) {
                    document.getElementById('sidebar-avatar').src = payload.avatar_url;
                    document.getElementById('header-avatar').src = payload.avatar_url;
                    document.getElementById('profile-preview').src = payload.avatar_url;
                }
                document.getElementById('sidebar-username').innerText = name;
                document.getElementById('header-username').innerText = name;

                await logAction('تنظیمات', `پروفایل و ظاهر به‌روزرسانی شد (نام: ${name}, تم: ${theme}, فونت: ${font_family})`);
                toast('تغییرات با موفقیت ذخیره شد');
                await loadProfileData();
            } catch (err) {
                console.error(err);
                toast('خطا در ذخیره: ' + (err.message || err), 'error');
                await logAction('خطای تنظیمات', String(err.message || err));
            }
        }

        // ==================== TRANSACTIONS ====================
        function openTxModal(item = null) {
            document.getElementById('tx-id').value = item ? item.id : '';
            document.getElementById('tx-modal-title').innerText = item ? 'ویرایش تراکنش' : 'ثبت تراکنش جدید';
            if (item) {
                // Will be filled after decrypt in edit flow
            } else {
                document.getElementById('tx-type').value = 'هزینه';
                updateTxCategories();
                document.getElementById('tx-amount').value = '';
                document.getElementById('tx-account').value = '';
                document.getElementById('tx-date').value = '';
                document.getElementById('tx-time').value = '';
                document.getElementById('tx-desc').value = '';
            }
            openModal('tx-modal');
        }

