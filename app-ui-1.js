        function setNoteFilter(cat) {
            noteFilter = cat;
            document.querySelectorAll('.note-filter-btn').forEach(btn => {
                btn.className = (btn.dataset.cat === cat ? 'chip active' : 'chip') + ' note-filter-btn';
            });
            fetchNotes();
        }

        async function fetchNotes() {
            const data = await safeSelect('notes');
            const list = document.getElementById('notes-list');
            if (!list) return;

            // Build category filters
            const cats = [...new Set(data.map(n => n.category || 'عمومی'))];
            const filterBox = document.getElementById('note-cat-filters');
            filterBox.innerHTML = `<button onclick="setNoteFilter('')" class="chip ${!noteFilter ? 'active' : ''} note-filter-btn" data-cat="">همه</button>`;
            cats.forEach(c => {
                filterBox.innerHTML += `<button onclick="setNoteFilter('${c}')" class="chip ${noteFilter === c ? 'active' : ''} note-filter-btn" data-cat="${c}">${c}</button>`;
            });

            let filtered = noteFilter ? data.filter(n => (n.category || 'عمومی') === noteFilter) : data;

            if (filtered.length === 0) {
                list.innerHTML = `<p class="text-center text-slate-400 text-sm py-8 col-span-full">یادداشتی یافت نشد.</p>`;
                return;
            }

            list.innerHTML = '';
            for (const item of filtered) {
                const isLocked = item.type === 'رمزدار';
                const colorClass = `note-${item.color || 'blue'}`;
                let plainContent = '';
                if (!isLocked) {
                    try { plainContent = await toText(item.content) || ''; } catch { plainContent = item.content || ''; }
                    // if still looks encrypted, show friendly text
                    if (typeof plainContent === 'string' && plainContent.startsWith('{') && plainContent.includes('"iv"')) {
                        plainContent = '🔒 محتوا رمزنگاری شده — پس از ورود مجدد با رمز صحیح نمایش داده می‌شود';
                    }
                }
                const attBadge = parseAttachments(item.attachments).length
                    ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700">📎 ${parseAttachments(item.attachments).length}</span>` : '';
                list.innerHTML += `
                    <div class="list-card ${colorClass} flex flex-col justify-between min-h-[140px]">
                        <div>
                            <div class="flex justify-between items-start gap-2 mb-2">
                                <h4 class="font-bold text-sm">${item.title}</h4>
                                <span class="flex gap-1 items-center">${attBadge}${isLocked ? '<span class="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded">🔒</span>' : ''}</span>
                            </div>
                            <p class="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line line-clamp-3" id="note-text-${item.id}">
                                ${isLocked ? '•••••••• (رمزدار)' : (plainContent || '')}
                            </p>
                        </div>
                        <div class="flex gap-2 mt-3 pt-3 border-t text-xs" style="border-color:var(--border)">
                            <button onclick="viewNote('${item.id}')" class="flex-1 py-1.5 rounded-lg font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex items-center justify-center gap-1">
                                <i data-lucide="eye" class="w-3.5 h-3.5"></i> نمایش
                            </button>
                            ${isLocked ? `<button onclick="openUnlockModal('${item.id}', '${(item.password || '').replace(/'/g, "\\'")}', \`${(item.content || '').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" class="px-2 py-1.5 rounded-lg text-amber-600">🔓</button>` : ''}
                            <button onclick="editNote('${item.id}')" class="px-2 py-1.5 rounded-lg text-slate-400 hover:text-blue-600"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                            <button onclick="deleteItem('notes', '${item.id}', fetchNotes)" class="px-2 py-1.5 rounded-lg text-slate-400 hover:text-red-600"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>`;
            });
            lucide.createIcons();
        }

        async function viewNote(id) {
            let { data } = await _supabase.from('notes').select('*').eq('id', id).single();
            if (!data) return;
            if (data.type === 'رمزدار') {
                openUnlockModal(id, data.password || '', data.content || '');
                // After unlock, user sees text on card; also show detail after verify
                const origVerify = window.verifyNotePassword;
                window.verifyNotePassword = function() {
                    if (document.getElementById('unlock-pass').value === correctNotePass) {
                        closeUnlockModal();
                        showNoteDetail(data, true);
                        window.verifyNotePassword = origVerify;
                    } else {
                        toast('رمز عبور اشتباه است', 'error');
                    }
                };
                return;
            }
            showNoteDetail(data, true);
        }

        async function showNoteDetail(data, unlocked) {
            let body = unlocked ? (data.content || '— بدون محتوا —') : '••••••••';
            if (unlocked && body) {
                try { body = await toText(body); } catch(e) {}
                if (typeof body === 'string' && body.startsWith('{') && body.includes('"iv"')) {
                    body = '🔒 محتوا رمزنگاری‌شده است. با همان رمزی که ورود کرده‌اید دوباره وارد شوید.';
                }
            }
            const gallery = unlocked ? renderAttachmentGallery(data.attachments) : '';
            document.getElementById('detail-title').innerText = data.title || 'یادداشت';
            document.getElementById('detail-body').innerHTML = `
                <div class="space-y-3 text-sm">
                    <div class="flex gap-2 flex-wrap">
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">${data.category || 'عمومی'}</span>
                        ${data.type === 'رمزدار' ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">🔒 رمزدار</span>' : ''}
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">${data.color || 'blue'}</span>
                    </div>
                    <div class="p-4 rounded-xl border whitespace-pre-line text-base leading-relaxed" style="border-color:var(--border)">
                        ${body}
                    </div>
                    ${gallery}
                </div>`;
            document.getElementById('detail-actions').innerHTML = `
                <button onclick="editNote('${data.id}'); closeModal('detail-modal')" class="flex-1 btn-primary py-2.5 rounded-xl text-sm">ویرایش</button>
                <button onclick="deleteItem('notes', '${data.id}', () => { closeModal('detail-modal'); fetchNotes(); })" class="flex-1 py-2.5 rounded-xl bg-red-100 text-red-600 text-sm">حذف</button>
            `;
            openModal('detail-modal');
            lucide.createIcons();
        }

        async function editNote(id) {
            let { data } = await _supabase.from('notes').select('*').eq('id', id).single();
            if (!data) return;
            document.getElementById('note-id').value = id;
            document.getElementById('note-modal-title').innerText = 'ویرایش یادداشت';
            document.getElementById('note-title').value = data.title || '';
            let content = data.content || '';
            try { content = await toText(content); } catch(e) {}
            if (typeof content === 'string' && content.startsWith('{') && content.includes('"iv"')) content = '';
            document.getElementById('note-content').value = content;
            document.getElementById('note-category').value = data.category || '';
            document.getElementById('note-color').value = data.color || 'blue';
            document.getElementById('note-type').value = data.type || 'عادی';
            document.getElementById('note-pass').value = data.password || '';
            toggleNotePassInput();
            setDraftAttachments('note', parseAttachments(data.attachments));
            openModal('note-modal');
        }

        function openUnlockModal(id, pass, content) {
            currentUnlockedNoteId = id;
            correctNotePass = pass;
            tempNoteContent = content;
            openModal('note-pass-modal');
        }

        function closeUnlockModal() {
            closeModal('note-pass-modal');
            document.getElementById('unlock-pass').value = '';
        }

        async function verifyNotePassword() {
            if (document.getElementById('unlock-pass').value === correctNotePass) {
                let text = tempNoteContent;
                try { text = await toText(text); } catch(e) {}
                const el = document.getElementById(`note-text-${currentUnlockedNoteId}`);
                if (el) el.innerText = text;
                closeUnlockModal();
                logAction('باز کردن یادداشت رمزدار', `یادداشت ${currentUnlockedNoteId} باز شد`);
            } else {
                alert('رمز عبور اشتباه است!');
            }
        }

        // ==================== CALENDAR ====================
        function initCalSelectors() {
            const ym = getCurrentJalaliYM();
            calYear = ym.y;
            calMonth = ym.m;
            const yearSel = document.getElementById('cal-year-select');
            if (!yearSel) return;
            yearSel.innerHTML = '';
            for (let y = calYear - 15; y <= calYear + 10; y++) {
                yearSel.innerHTML += `<option value="${y}" ${y === calYear ? 'selected' : ''}>${y}</option>`;
            }
            const monthSel = document.getElementById('cal-month-select');
            if (monthSel) monthSel.value = String(calMonth);
        }

        function onCalYearMonthChange() {
            const y = parseInt(document.getElementById('cal-year-select').value, 10);
            const m = parseInt(document.getElementById('cal-month-select').value, 10);
            if (y) calYear = y;
            if (m) calMonth = m;
            renderCalendar();
        }

        function changeCalMonth(delta) {
            calMonth += delta;
            if (calMonth > 12) { calMonth = 1; calYear++; }
            if (calMonth < 1) { calMonth = 12; calYear--; }
            const yearSel = document.getElementById('cal-year-select');
            const monthSel = document.getElementById('cal-month-select');
            if (yearSel) {
                // ensure year option exists
                if (![...yearSel.options].some(o => parseInt(o.value) === calYear)) {
                    yearSel.innerHTML += `<option value="${calYear}">${calYear}</option>`;
                }
                yearSel.value = String(calYear);
            }
            if (monthSel) monthSel.value = String(calMonth);
            renderCalendar();
        }

        function goToTodayJalali() {
            initCalSelectors();
            renderCalendar();
        }

        function daysInJalaliMonth(jy, jm) {
            if (jm <= 6) return 31;
            if (jm <= 11) return 30;
            // Esfand: 29 or 30 (simple leap approx)
            return ((jy % 4) === 3) ? 30 : 29;
        }

        function matchJalaliDay(dateStr, year, month, day) {
            if (!dateStr) return false;
            const s = String(dateStr).replace(/-/g, '/');
            const parts = s.split('/').map(x => parseInt(V.toEnDigits(x), 10));
            if (parts.length >= 3) {
                return parts[0] === year && parts[1] === month && parts[2] === day;
            }
            // فقط ماه/روز (مثل تولد)
            if (parts.length === 2) return parts[0] === month && parts[1] === day;
            const pad = (n) => String(n).padStart(2, '0');
            return s.includes(`${year}/${pad(month)}/${pad(day)}`) || s.includes(`${year}/${month}/${day}`);
        }

        async function renderCalendar() {
            const monthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
            const yearSel = document.getElementById('cal-year-select');
            const monthSel = document.getElementById('cal-month-select');
            if (yearSel && !yearSel.options.length) initCalSelectors();
            if (yearSel) yearSel.value = String(calYear);
            if (monthSel) monthSel.value = String(calMonth);

            const grid = document.getElementById('calendar-grid');
            if (!grid) return;
            grid.innerHTML = '';

            const daysCount = daysInJalaliMonth(calYear, calMonth);
            const prefix = `${calYear}/${String(calMonth).padStart(2,'0')}/`;
            const startWd = jalaliWeekday(calYear, calMonth, 1);

            const tasks = await safeSelect('tasks');
            const contacts = await safeSelect('contacts');
            const calEvents = loadCalEvents();
            let loansCal = [];
            try { loansCal = await safeSelect('loans', 'id'); } catch(e) {}

            const todayJ = getCurrentJalaliYM();
            const todayDay = (todayJ.y === calYear && todayJ.m === calMonth) ? todayJ.d : 0;

            for (let i = 0; i < startWd; i++) {
                grid.innerHTML += `<div class="cal-day p-1.5 text-xs opacity-30"></div>`;
            }

            const monthEvents = [];

            for (let d = 1; d <= daysCount; d++) {
                const dayStr = prefix + String(d).padStart(2, '0');
                const dayTasks = tasks.filter(t => matchJalaliDay(t.due_date, calYear, calMonth, d));
                const dayBirths = contacts.filter(c => {
                    const b = c.birthday;
                    if (!b) return false;
                    const s = String(b).replace(/-/g, '/');
                    const parts = s.split('/').map(x => parseInt(V.toEnDigits(x), 10));
                    if (parts.length >= 3) return parts[1] === calMonth && parts[2] === d;
                    if (parts.length === 2) return parts[0] === calMonth && parts[1] === d;
                    return false;
                });
                dayTasks.forEach(t => monthEvents.push({ type: 'task', day: d, date: dayStr, title: t.title, meta: t }));
                dayBirths.forEach(c => monthEvents.push({ type: 'birthday', day: d, date: dayStr, title: '🎂 ' + (c.name || 'مخاطب'), meta: c }));
                calEvents.filter(ev => matchJalaliDay(ev.date, calYear, calMonth, d)).forEach(ev => monthEvents.push({ type: 'event', day: d, date: dayStr, title: '📌 ' + (ev.title||''), meta: ev }));
                loansCal.forEach(L => {
                    const due = V.toEnDigits(String(L.due_day||'')).replace(/-/g,'/');
                    const parts = due.split('/').map(x => parseInt(x,10));
                    const dd = parts.length >= 3 ? parts[2] : parts[0];
                    if (dd === d && (L.paid_installments||0) < (L.total_installments||0))
                        monthEvents.push({ type: 'loan', day: d, date: dayStr, title: '💳 قسط ' + (L.title||'وام'), meta: L });
                });

                const count = dayTasks.length + dayBirths.length;
                const isToday = d === todayDay;
                grid.innerHTML += `
                    <div class="cal-day p-1.5 text-xs ${isToday ? 'today' : ''} ${count ? 'has-event' : ''}" onclick="showDayEvents('${dayStr}', ${d})">
                        <span class="font-medium ${isToday ? 'text-blue-600 font-bold' : ''}">${d}</span>
                        <div class="mt-1 flex flex-wrap gap-0.5">
                            ${dayTasks.slice(0, 3).map(e => `<span class="cal-event-dot" style="background:${e.priority==='فوری'?'#ef4444':(e.is_completed?'#94a3b8':'#3b82f6')}"></span>`).join('')}
                            ${dayBirths.slice(0, 2).map(() => `<span class="cal-event-dot" style="background:#ec4899"></span>`).join('')}
                        </div>
                    </div>`;
            }

            const todayEl = document.getElementById('cal-today-events');
            const titleEl = document.getElementById('cal-events-title');
            if (titleEl) titleEl.innerText = `رویدادهای ${monthNames[calMonth - 1]} ${calYear}`;
            if (!monthEvents.length) {
                todayEl.innerHTML = '<p class="text-slate-400 text-sm">رویداد یا یادآوری در این ماه نیست. با «یادآوری جدید» ثبت کنید.</p>';
            } else {
                monthEvents.sort((a, b) => a.day - b.day);
                todayEl.innerHTML = monthEvents.slice(0, 30).map(ev => `
                    <div class="flex items-center gap-2 p-2.5 rounded-lg border" style="border-color:var(--border)">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0 ${ev.type==='birthday'?'bg-pink-500':(ev.meta.priority==='فوری'?'bg-red-500':'bg-blue-500')}"></span>
                        <span class="text-sm flex-1 ${ev.meta.is_completed?'line-through text-slate-400':''}">${ev.title}</span>
                        <span class="text-xs text-slate-400">${ev.date}</span>
                        ${ev.type==='task' ? `<button onclick="viewTask('${ev.meta.id}')" class="text-blue-600 text-xs">نمایش</button>` : ''}
                    </div>
                `).join('');
            }
            lucide.createIcons();
        }

