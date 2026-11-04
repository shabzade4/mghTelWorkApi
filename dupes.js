// Duplicate guards — contacts, tasks, notes, money, loans, users, calendar
(function () {
    function digits(s) {
        return String(s || '').replace(/\D/g, '');
    }
    function norm(s) {
        return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }
    function phonesOf(c) {
        return [c.mobile, c.phones, c.phone2, c.work_phone, c.home_phone]
            .map(digits)
            .filter((d) => d.length >= 8);
    }

    window.findDuplicate = async function (kind, draft) {
        const id = draft && draft.id ? String(draft.id) : '';
        try {
            if (kind === 'contact') {
                const rows = (typeof allContacts !== 'undefined' && allContacts && allContacts.length)
                    ? allContacts
                    : await safeSelect('contacts');
                const mine = (draft.phones || []).map(digits).filter((d) => d.length >= 8);
                const em = norm(draft.email);
                for (const c of rows || []) {
                    if (String(c.id) === id) continue;
                    const theirs = phonesOf(c);
                    for (const p of mine) {
                        if (theirs.includes(p)) {
                            return 'شماره «' + p + '» قبلاً برای مخاطب «' + (c.name || 'بدون نام') + '» ثبت شده و قابل ثبت مجدد نیست.';
                        }
                    }
                    if (em && norm(c.email) === em) {
                        return 'ایمیل «' + draft.email + '» قبلاً برای مخاطب «' + (c.name || 'بدون نام') + '» ثبت شده است.';
                    }
                }
                return null;
            }

            if (kind === 'task') {
                const rows = await safeSelect('tasks');
                const title = norm(draft.title);
                const due = String(draft.due_date || '');
                for (const r of rows || []) {
                    if (String(r.id) === id) continue;
                    if (norm(r.title) === title && String(r.due_date || '') === due) {
                        return 'کار «' + draft.title + '» با همین سررسید قبلاً ثبت شده است.';
                    }
                }
                return null;
            }

            if (kind === 'note') {
                const rows = await safeSelect('notes');
                const title = norm(draft.title);
                const cat = norm(draft.category || 'عمومی');
                for (const r of rows || []) {
                    if (String(r.id) === id) continue;
                    if (norm(r.title) === title && norm(r.category || 'عمومی') === cat) {
                        return 'یادداشت «' + draft.title + '» در دسته «' + (draft.category || 'عمومی') + '» تکراری است.';
                    }
                }
                return null;
            }

            if (kind === 'loan') {
                const rows = await safeSelect('loans');
                const title = norm(draft.title);
                const bank = norm(draft.bank || '');
                const amount = Number(draft.total_amount) || 0;
                for (const r of rows || []) {
                    if (String(r.id) === id) continue;
                    const rAmt = Number(r.total_amount) || 0;
                    if (norm(r.title) === title && norm(r.bank || '') === bank && rAmt === amount) {
                        return 'وام «' + draft.title + '» با همین مبلغ و بانک قبلاً ثبت شده است.';
                    }
                }
                return null;
            }

            if (kind === 'tx') {
                const rows = await safeSelect('transactions');
                for (const r of rows || []) {
                    if (String(r.id) === id) continue;
                    const type = typeof toText === 'function' ? await toText(r.type) : r.type;
                    const cat = typeof toText === 'function' ? await toText(r.category) : r.category;
                    const amt = typeof toNum === 'function' ? Number(await toNum(r.amount)) : Number(r.amount);
                    const date = typeof toText === 'function' ? await toText(r.date) : r.date;
                    const desc = typeof toText === 'function' ? await toText(r.description) : r.description;
                    const time = r.time && typeof toText === 'function' ? await toText(r.time) : (r.time || '');
                    if (
                        String(type || '') === String(draft.type || '') &&
                        String(cat || '') === String(draft.category || '') &&
                        amt === Number(draft.amount) &&
                        String(date || '') === String(draft.date || '') &&
                        String(time || '') === String(draft.time || '') &&
                        norm(desc) === norm(draft.description)
                    ) {
                        return 'این تراکنش (نوع، دسته، مبلغ، تاریخ و توضیح) قبلاً ثبت شده است.';
                    }
                }
                return null;
            }

            if (kind === 'user') {
                const { data } = await _supabase.from('app_users').select('id,username').eq('username', draft.username);
                const hit = (data || []).find((u) => String(u.id) !== id);
                if (hit) return 'نام کاربری «' + draft.username + '» قبلاً وجود دارد.';
                return null;
            }

            if (kind === 'cal') {
                const list = typeof loadCalEvents === 'function' ? loadCalEvents() : [];
                const title = norm(draft.title);
                const date = String(draft.date || '');
                const hit = list.find((x) => String(x.id) !== id && norm(x.title) === title && String(x.date || '') === date);
                if (hit) return 'رویداد «' + draft.title + '» در تاریخ ' + date + ' تکراری است.';
                return null;
            }
        } catch (e) {
            console.warn('dup check', e);
        }
        return null;
    };
})();
