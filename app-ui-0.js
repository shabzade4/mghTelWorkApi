        async function viewContact(id) {
            const item = allContacts.find(c => c.id === id);
            if (!item) return;
            const mobile = item.mobile || item.phones || '';
            const actions = contactActionButtons(mobile, item.email);
            document.getElementById('detail-title').innerText = item.name || 'مخاطب';
            document.getElementById('detail-body').innerHTML = `
                <div class="flex flex-col items-center mb-4">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl mb-2">
                        ${(item.name || '?').charAt(0)}
                    </div>
                    <p class="text-lg font-bold">${item.name || '—'}</p>
                    <span class="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 mt-1">${item.category || 'سایر'}</span>
                </div>
                ${actions ? `<div class="flex gap-2 mb-4">${actions}</div>` : '<p class="text-xs text-slate-400 text-center mb-3">شماره یا ایمیل برای تماس ثبت نشده</p>'}
                <div class="space-y-3 text-sm">
                    <div class="p-3 rounded-xl border" style="border-color:var(--border)">
                        <p class="text-xs text-slate-500 mb-1">موبایل</p>
                        <p class="font-semibold text-base ltr-num">${mobile || '—'}</p>
                    </div>
                    ${item.phone2 ? `<div class="p-3 rounded-xl border" style="border-color:var(--border)"><p class="text-xs text-slate-500 mb-1">شماره دوم</p><p class="font-medium ltr-num">${item.phone2}</p>${hrefCall(item.phone2) ? `<a href="${hrefCall(item.phone2)}" class="text-xs text-emerald-600 mt-1 inline-block">تماس با این شماره</a>` : ''}</div>` : ''}
                    ${item.work_phone ? `<div class="p-3 rounded-xl border" style="border-color:var(--border)"><p class="text-xs text-slate-500 mb-1">تلفن محل کار</p><p class="font-medium ltr-num">${item.work_phone}</p>${hrefCall(item.work_phone) ? `<a href="${hrefCall(item.work_phone)}" class="text-xs text-emerald-600 mt-1 inline-block">تماس</a>` : ''}</div>` : ''}
                    ${item.home_phone ? `<div class="p-3 rounded-xl border" style="border-color:var(--border)"><p class="text-xs text-slate-500 mb-1">تلفن منزل</p><p class="font-medium ltr-num">${item.home_phone}</p>${hrefCall(item.home_phone) ? `<a href="${hrefCall(item.home_phone)}" class="text-xs text-emerald-600 mt-1 inline-block">تماس</a>` : ''}</div>` : ''}
                    ${item.email ? `<div class="p-3 rounded-xl border" style="border-color:var(--border)"><p class="text-xs text-slate-500 mb-1">ایمیل</p><p class="font-medium" dir="ltr">${item.email}</p></div>` : ''}
                    ${item.address ? `<div class="p-3 rounded-xl border" style="border-color:var(--border)"><p class="text-xs text-slate-500 mb-1">آدرس</p><p class="font-medium">${item.address}</p></div>` : ''}
                    ${item.birthday ? `<div class="p-3 rounded-xl border" style="border-color:var(--border)"><p class="text-xs text-slate-500 mb-1">تاریخ تولد</p><p class="font-medium">${item.birthday}</p></div>` : ''}
                    ${item.notes ? `<div class="p-3 rounded-xl border" style="border-color:var(--border)"><p class="text-xs text-slate-500 mb-1">توضیحات</p><p class="font-medium whitespace-pre-line">${item.notes}</p></div>` : ''}
                </div>`;
            const _attG = renderAttachmentGallery(item.attachments);
            if (_attG) document.getElementById('detail-body').innerHTML += _attG;
            document.getElementById('detail-actions').innerHTML = `
                <button onclick="editContact('${id}'); closeModal('detail-modal')" class="flex-1 btn-primary py-2.5 rounded-xl text-sm font-medium">ویرایش</button>
                <button onclick="deleteItem('contacts', '${id}', () => { closeModal('detail-modal'); fetchContacts(); })" class="flex-1 py-2.5 rounded-xl bg-red-100 text-red-600 text-sm font-medium">حذف</button>
            `;
            openModal('detail-modal');
            lucide.createIcons();
        }

        async function editContact(id) {
            const item = allContacts.find(c => c.id === id);
            if (!item) return;
            document.getElementById('contact-id').value = id;
            document.getElementById('contact-modal-title').innerText = 'ویرایش مخاطب';
            document.getElementById('contact-name').value = item.name || '';
            document.getElementById('contact-mobile').value = item.mobile || item.phones || '';
            document.getElementById('contact-phone2').value = item.phone2 || '';
            document.getElementById('contact-work').value = item.work_phone || '';
            document.getElementById('contact-home').value = item.home_phone || '';
            document.getElementById('contact-email').value = item.email || '';
            document.getElementById('contact-address').value = item.address || '';
            document.getElementById('contact-category').value = item.category || 'دوستان';
            document.getElementById('contact-notes').value = item.notes || '';
            document.getElementById('contact-birthday').value = item.birthday || '';
            setDraftAttachments('contact', parseAttachments(item.attachments));
            openModal('contact-modal');
        }

        async function insertImportedContact(row) {
            const name = (row.name || '').trim();
            if (!name) return false;
            let mobile = (row.mobile || row.phones || '').trim();
            let phone2 = (row.phone2 || '').trim();
            let work = (row.work_phone || '').trim();
            let home = (row.home_phone || '').trim();
            let email = (row.email || '').trim();
            if (mobile) mobile = V.normalizeMobile(mobile) || V.onlyDigits(mobile);
            const payload = {
                name,
                phones: mobile,
                mobile,
                phone2: phone2 ? V.onlyDigits(phone2) : '',
                work_phone: work ? V.onlyDigits(work) : '',
                home_phone: home ? V.onlyDigits(home) : '',
                email,
                category: row.category || 'دوستان',
                notes: row.notes || '',
                address: row.address || '',
                birthday: row.birthday || ''
            };
            let { error } = await _supabase.from('contacts').insert([payload]);
            if (error && error.message && error.message.includes('column')) {
                ({ error } = await _supabase.from('contacts').insert([{ name, phones: mobile, category: payload.category }]));
            }
            return !error;
        }

        // ایمپورت مستقیم از دفترچه تلفن گوشی (Contact Picker API — Chrome/Edge اندروید)
        async function importFromPhoneContacts() {
            // Contact Picker: Chrome/Edge اندروید + HTTPS
            const supported = typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
            if (!supported) {
                toast('انتخاب مستقیم فقط روی Chrome اندروید (HTTPS) است. از «فایل VCF» استفاده کنید.', 'info');
                setTimeout(() => document.getElementById('vcf-file-input')?.click(), 400);
                return;
            }
            try {
                const props = [];
                const available = await navigator.contacts.getProperties?.() || ['name', 'tel', 'email', 'address'];
                ['name', 'tel', 'email', 'address'].forEach(p => { if (available.includes(p)) props.push(p); });
                if (!props.includes('name')) props.unshift('name');
                if (!props.includes('tel')) props.push('tel');

                const selected = await navigator.contacts.select(props, { multiple: true });
                if (!selected || !selected.length) {
                    toast('مخاطبی انتخاب نشد', 'info');
                    return;
                }
                toast('در حال ذخیره مخاطبین...', 'info');
                let count = 0, fail = 0;
                for (const c of selected) {
                    const name = (c.name && c.name[0]) ? String(c.name[0]).trim() : '';
                    const tels = (c.tel || []).map(t => String(t).trim()).filter(Boolean);
                    const emails = (c.email || []).map(e => String(e).trim()).filter(Boolean);
                    const addrs = c.address || [];
                    let addrStr = '';
                    if (addrs.length) {
                        const a = addrs[0];
                        addrStr = a.addressLine ? (Array.isArray(a.addressLine) ? a.addressLine.join(' ') : a.addressLine)
                            : [a.city, a.country].filter(Boolean).join('، ');
                    }
                    const ok = await insertImportedContact({
                        name: name || tels[0] || 'بدون نام',
                        mobile: tels[0] || '',
                        phone2: tels[1] || '',
                        work_phone: tels[2] || '',
                        home_phone: tels[3] || '',
                        email: emails[0] || '',
                        address: addrStr || '',
                        category: 'دوستان'
                    });
                    if (ok) count++; else fail++;
                }
                toast(`${count} مخاطب از گوشی ذخیره شد${fail ? ' · ' + fail + ' ناموفق' : ''}`);
                await logAction('ایمپورت از گوشی', `${count} مخاطب`);
                await fetchContacts();
                try { updateDashboard(); } catch (e) {}
                switchTab('contacts');
            } catch (err) {
                console.error(err);
                if (err && err.name === 'InvalidStateError') {
                    toast('انتخاب مخاطب باید با لمس دکمه باشد', 'error');
                } else if (err && err.name === 'SecurityError') {
                    toast('این قابلیت فقط روی HTTPS (مثلاً Vercel) کار می‌کند', 'error');
                } else {
                    toast('ایمپورت مستقیم ممکن نشد — از فایل VCF استفاده کنید', 'error');
                    setTimeout(() => document.getElementById('vcf-file-input')?.click(), 500);
                }
            }
        }

        function parseVCardText(text) {
            const rows = [];
            const blocks = String(text).split(/BEGIN:VCARD/i);
            for (let block of blocks) {
                if (!/FN[:;]/i.test(block) && !/N[:;]/i.test(block)) continue;
                const get = (re) => {
                    const m = block.match(re);
                    return m ? m[1].replace(/\\n/gi, ' ').replace(/\\,/g, ',').trim() : '';
                };
                let name = get(/FN[;:][^\n:]*:(.+)/i);
                if (!name) {
                    const n = get(/N[;:][^\n:]*:(.+)/i);
                    if (n) name = n.split(';').filter(Boolean).reverse().join(' ').trim();
                }
                const tels = [...block.matchAll(/TEL[^:]*:([^\r\n]+)/gi)].map(m => m[1].trim());
                const emails = [...block.matchAll(/EMAIL[^:]*:([^\r\n]+)/gi)].map(m => m[1].trim());
                const bday = get(/BDAY[;:][^\n:]*:([^\r\n]+)/i);
                const note = get(/NOTE[;:][^\n:]*:([^\r\n]+)/i);
                const adr = get(/ADR[^:]*:([^\r\n]+)/i);
                rows.push({
                    name,
                    mobile: tels[0] || '',
                    phone2: tels[1] || '',
                    work_phone: tels[2] || '',
                    home_phone: tels[3] || '',
                    email: emails[0] || '',
                    birthday: bday ? bday.replace(/-/g, '/').slice(0, 10) : '',
                    notes: note,
                    address: adr ? adr.split(';').filter(Boolean).join('، ') : '',
                    category: 'دوستان'
                });
            }
            return rows;
        }

        function importVCard(e) {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            let total = 0;
            let pending = files.length;
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    try {
                        const rows = parseVCardText(ev.target.result);
                        for (const row of rows) {
                            if (await insertImportedContact(row)) total++;
                        }
                    } catch (err) {
                        console.error(err);
                    }
                    pending--;
                    if (pending === 0) {
                        toast(`${total} مخاطب از فایل VCF ایمپورت شد`);
                        await logAction('ایمپورت VCF', `ایمپورت ${total} مخاطب`);
                        await fetchContacts();
                        updateDashboard();
                        e.target.value = '';
                    }
                };
                reader.readAsText(file, 'UTF-8');
            });
        }

        // ==================== TASKS ====================
        function openTaskModal(item = null) {
            document.getElementById('task-id').value = item ? item.id : '';
            document.getElementById('task-modal-title').innerText = item ? 'ویرایش کار' : 'ثبت کار جدید';
            if (!item) {
                document.getElementById('task-title').value = '';
                document.getElementById('task-desc').value = '';
                document.getElementById('task-priority').value = 'متوسط';
                document.getElementById('task-status').value = 'باز';
                document.getElementById('task-due-date').value = '';
                document.getElementById('task-due-time').value = '';
                document.getElementById('task-reminder').value = '0';
                clearAttachments('task');
            }
            openModal('task-modal');
        }

        async function saveTask(e) {
            e.preventDefault();
            const id = document.getElementById('task-id').value;
            const title = document.getElementById('task-title').value.trim();
            const description = document.getElementById('task-desc').value.trim();
            const due_date = document.getElementById('task-due-date').value.trim();
            const due_time = document.getElementById('task-due-time').value;

            const err = V.firstError(
                V.required(title, 'موضوع کار'),
                V.minLength(title, 2, 'موضوع کار'),
                V.maxLength(title, 150, 'موضوع کار'),
                V.maxLength(description, 1000, 'توضیحات'),
                due_date ? V.jalaliDate(due_date) : null
            );
            if (err) { toast(err, 'error'); return; }

            const status = document.getElementById('task-status').value;
            const priority = document.getElementById('task-priority').value || 'متوسط';
            const is_completed = status === 'انجام شده';

            // چند لایه payload برای جداول قدیمی/ناقص
            const full = {
                title,
                priority,
                is_completed,
                description: description || null,
                status: status || (is_completed ? 'انجام شده' : 'باز'),
                due_date: due_date ? V.toEnDigits(due_date).replace(/-/g, '/') : null,
                due_time: due_time || null,
                reminder_minutes: parseInt(document.getElementById('task-reminder').value, 10) || 0,
                attachments: JSON.stringify(getDraftAttachments('task'))
            };
            const mid = { title, priority, is_completed, description: description || null, status: full.status, due_date: full.due_date };
            const minimal = { title, priority, is_completed };

            try {
                let saved = null;
                let lastErr = null;
                const attempts = id
                    ? [
                        () => _supabase.from('tasks').update(full).eq('id', id).select(),
                        () => _supabase.from('tasks').update(mid).eq('id', id).select(),
                        () => _supabase.from('tasks').update(minimal).eq('id', id).select()
                      ]
                    : [
                        () => _supabase.from('tasks').insert([full]).select(),
                        () => _supabase.from('tasks').insert([mid]).select(),
                        () => _supabase.from('tasks').insert([minimal]).select()
                      ];

                for (const run of attempts) {
                    const { data, error } = await run();
                    if (!error) {
                        saved = data;
                        lastErr = null;
                        break;
                    }
                    lastErr = error;
                    // فقط برای خطای ستون ادامه بده؛ بقیه را قطع کن
                    if (!(error.message && (error.message.includes('column') || error.code === 'PGRST204' || error.code === '42703'))) {
                        break;
                    }
                }
                if (lastErr) throw lastErr;

                await logAction(id ? 'ویرایش کار' : 'ثبت کار', `کار «${title}»`);
                toast(id ? 'کار ویرایش شد' : 'کار با موفقیت ثبت شد');
                closeModal('task-modal');

                // فیلتر را روی «همه» بگذار تا مورد جدید دیده شود
                taskFilter = 'all';
                ['all','open','done','urgent'].forEach(x => {
                    const btn = document.getElementById(`tf-${x}`);
                    if (btn) btn.className = x === 'all' ? 'chip active' : 'chip';
                });
                switchTab('tasks');
                await fetchTasks();
                try { updateDashboard(); } catch (e) {}
            } catch (err) {
                console.error(err);
                toast('خطا در ذخیره کار: ' + (err.message || err), 'error');
                try { await logAction('خطای کار', String(err.message || err)); } catch (e) {}
            }
        }

        function setTaskFilter(f) {
            taskFilter = f;
            ['all','open','done','urgent'].forEach(x => {
                const btn = document.getElementById(`tf-${x}`);
                if (btn) btn.className = x === f ? 'chip active' : 'chip';
            });
            fetchTasks();
        }

        async function fetchTasks() {
            const list = document.getElementById('tasks-list');
            if (!list) return;
            list.innerHTML = `<p class="text-center text-slate-400 text-sm py-4">در حال بارگذاری...</p>`;

            const data = await safeSelect('tasks');
            // اگر order معکوس نیست، جدیدترین‌ها را با created_at یا id جلو بیاور
            const sorted = [...(data || [])].sort((a, b) => {
                const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                if (tb !== ta) return tb - ta;
                return String(b.id || '').localeCompare(String(a.id || ''));
            });

            let filtered = sorted;
            if (taskFilter === 'open') filtered = sorted.filter(t => !t.is_completed && t.status !== 'انجام شده');
            else if (taskFilter === 'done') filtered = sorted.filter(t => t.is_completed || t.status === 'انجام شده');
            else if (taskFilter === 'urgent') filtered = sorted.filter(t => t.priority === 'فوری');

            if (filtered.length === 0) {
                list.innerHTML = `<p class="text-center text-slate-400 text-sm py-6">کاری یافت نشد. با دکمه «کار جدید» ثبت کنید.${sorted.length ? ' (فیلتر فعال است — «همه» را بزنید)' : ''}</p>`;
                return;
            }

            list.innerHTML = '';
            filtered.forEach(item => {
                const isDone = !!(item.is_completed || item.status === 'انجام شده');
                const priColor = item.priority === 'فوری' ? 'bg-red-100 text-red-700' : item.priority === 'کم' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700';
                const tid = item.id;
                list.innerHTML += `
                    <div class="list-card ${isDone ? 'opacity-60' : ''}">
                        <div class="flex items-start gap-3">
                            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleTask('${tid}', ${!isDone})" class="mt-1 w-5 h-5 rounded text-blue-600">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-medium text-sm ${isDone ? 'line-through' : ''}">${item.title || '—'}</span>
                                    <span class="text-[10px] px-2 py-0.5 rounded-full ${priColor}">${item.priority || 'متوسط'}</span>
                                    ${item.status ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">${item.status}</span>` : ''}
                                </div>
                                ${item.description ? `<p class="text-xs text-slate-500 mt-1 line-clamp-2">${item.description}</p>` : ''}
                                <div class="flex gap-3 mt-2 text-xs text-slate-400">
                                    ${item.due_date ? `<span>📅 ${item.due_date}${item.due_time ? ' ' + item.due_time : ''}</span>` : ''}
                                    ${item.reminder_minutes > 0 ? `<span>🔔 ${item.reminder_minutes} دقیقه قبل</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-2 mt-3 pt-3 border-t" style="border-color:var(--border)">
                            <button onclick="viewTask('${tid}')" class="flex-1 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex items-center justify-center gap-1">
                                <i data-lucide="eye" class="w-3.5 h-3.5"></i> نمایش
                            </button>
                            <button onclick="editTask('${tid}')" class="px-3 py-1.5 rounded-lg text-slate-400 hover:text-blue-600"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                            <button onclick="deleteItem('tasks', '${tid}', fetchTasks)" class="px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>`;
            });
            lucide.createIcons();
        }

        async function viewTask(id) {
            let { data } = await _supabase.from('tasks').select('*').eq('id', id).single();
            if (!data) { toast('کار یافت نشد', 'error'); return; }
            const isDone = data.is_completed || data.status === 'انجام شده';
            document.getElementById('detail-title').innerText = data.title || 'جزئیات کار';
            document.getElementById('detail-body').innerHTML = `
                <div class="space-y-3 text-sm">
                    <div class="flex flex-wrap gap-2">
                        <span class="text-[10px] px-2 py-0.5 rounded-full ${data.priority==='فوری'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}">${data.priority || 'متوسط'}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full ${isDone?'bg-emerald-100 text-emerald-700':'bg-blue-50 text-blue-600'}">${data.status || (isDone?'انجام شده':'باز')}</span>
                    </div>
                    ${data.description ? `<div class="p-3 rounded-xl border whitespace-pre-line" style="border-color:var(--border)"><p class="text-xs text-slate-500 mb-1">توضیحات</p>${data.description}</div>` : ''}
                    <div class="grid grid-cols-2 gap-2">
                        <div class="p-3 rounded-xl border" style="border-color:var(--border)"><p class="text-xs text-slate-500">تاریخ سررسید</p><p class="font-medium">${data.due_date || '—'}</p></div>
                        <div class="p-3 rounded-xl border" style="border-color:var(--border)"><p class="text-xs text-slate-500">ساعت</p><p class="font-medium">${data.due_time || '—'}</p></div>
                        <div class="p-3 rounded-xl border" style="border-color:var(--border)"><p class="text-xs text-slate-500">یادآوری</p><p class="font-medium">${data.reminder_minutes > 0 ? data.reminder_minutes + ' دقیقه قبل' : 'ندارد'}</p></div>
                        <div class="p-3 rounded-xl border" style="border-color:var(--border)"><p class="text-xs text-slate-500">وضعیت</p><p class="font-medium">${isDone ? 'انجام شده' : 'باز'}</p></div>
                    </div>
                </div>`;
            const _tg = renderAttachmentGallery(data.attachments);
            if (_tg) document.getElementById('detail-body').innerHTML += _tg;
            document.getElementById('detail-actions').innerHTML = `
                <button onclick="editTask('${id}'); closeModal('detail-modal')" class="flex-1 btn-primary py-2.5 rounded-xl text-sm">ویرایش</button>
                <button onclick="deleteItem('tasks', '${id}', () => { closeModal('detail-modal'); fetchTasks(); })" class="flex-1 py-2.5 rounded-xl bg-red-100 text-red-600 text-sm">حذف</button>
            `;
            openModal('detail-modal');
            lucide.createIcons();
        }

        async function editTask(id) {
            let { data } = await _supabase.from('tasks').select('*').eq('id', id).single();
            if (!data) return;
            document.getElementById('task-id').value = id;
            document.getElementById('task-modal-title').innerText = 'ویرایش کار';
            document.getElementById('task-title').value = data.title || '';
            document.getElementById('task-desc').value = data.description || '';
            document.getElementById('task-priority').value = data.priority || 'متوسط';
            document.getElementById('task-status').value = data.status || (data.is_completed ? 'انجام شده' : 'باز');
            document.getElementById('task-due-date').value = data.due_date || '';
            document.getElementById('task-due-time').value = data.due_time || '';
            document.getElementById('task-reminder').value = data.reminder_minutes || '0';
            setDraftAttachments('task', parseAttachments(data.attachments));
            openModal('task-modal');
        }

        async function toggleTask(id, status) {
            await _supabase.from('tasks').update({ is_completed: status, status: status ? 'انجام شده' : 'باز' }).eq('id', id);
            await logAction(status ? 'تکمیل کار' : 'بازگشت کار', `وضعیت کار ${id} تغییر کرد`);
            fetchTasks();
            updateDashboard();
        }

        // ==================== NOTES ====================
        function openNoteModal(item = null) {
            document.getElementById('note-id').value = item ? item.id : '';
            document.getElementById('note-modal-title').innerText = item ? 'ویرایش یادداشت' : 'ثبت یادداشت جدید';
            if (!item) {
                document.getElementById('note-title').value = '';
                document.getElementById('note-content').value = '';
                document.getElementById('note-category').value = '';
                document.getElementById('note-color').value = 'blue';
                document.getElementById('note-type').value = 'عادی';
                document.getElementById('note-pass').value = '';
                document.getElementById('note-pass').classList.add('hidden');
                clearAttachments('note');
            }
            openModal('note-modal');
        }

        function toggleNotePassInput() {
            const type = document.getElementById('note-type').value;
            const passInput = document.getElementById('note-pass');
            if (type === 'رمزدار') passInput.classList.remove('hidden');
            else passInput.classList.add('hidden');
        }

        async function saveNote(e) {
            e.preventDefault();
            const id = document.getElementById('note-id').value;
            const type = document.getElementById('note-type').value;
            const title = document.getElementById('note-title').value.trim();
            const content = document.getElementById('note-content').value;
            const category = document.getElementById('note-category').value.trim() || 'عمومی';
            const notePass = document.getElementById('note-pass').value;

            const err = V.firstError(
                V.required(title, 'عنوان یادداشت'),
                V.minLength(title, 2, 'عنوان'),
                V.maxLength(title, 150, 'عنوان'),
                V.maxLength(content, 5000, 'محتوا'),
                V.maxLength(category, 40, 'دسته'),
                type === 'رمزدار' ? V.password(notePass, true) : null
            );
            if (err) { toast(err, 'error'); return; }

            let storeContent = content;
            if (encryptionEnabled && content) storeContent = await encryptSensitive(content);
            const attachments = JSON.stringify(getDraftAttachments('note'));
            const payload = {
                title,
                content: storeContent,
                category,
                color: document.getElementById('note-color').value,
                type: type,
                password: type === 'رمزدار' ? notePass : null,
                attachments
            };

            try {
                if (id) {
                    let { error } = await _supabase.from('notes').update(payload).eq('id', id);
                    if (error && String(error.message || '').includes('column')) {
                        delete payload.attachments;
                        ({ error } = await _supabase.from('notes').update(payload).eq('id', id));
                    }
                    if (error) throw error;
                    await logAction('ویرایش یادداشت', `یادداشت «${title}» ویرایش شد`);
                    toast('یادداشت ویرایش شد');
                } else {
                    let { error } = await _supabase.from('notes').insert([payload]);
                    if (error && String(error.message || '').includes('column')) {
                        delete payload.attachments;
                        ({ error } = await _supabase.from('notes').insert([payload]));
                    }
                    if (error) throw error;
                    await logAction('ثبت یادداشت', `یادداشت جدید: ${title}`);
                    toast('یادداشت با موفقیت ثبت شد');
                }
                closeModal('note-modal');
                fetchNotes();
                updateDashboard();
            } catch (err) {
                toast('خطا در ذخیره یادداشت: ' + (err.message || err), 'error');
            }
        }

