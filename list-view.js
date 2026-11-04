// View modes like Windows Explorer: tiles (image), grid, list, details + sort
(function () {
    const KEY = 'mgh_list_view_v2';
    const DEFAULT = {
        contacts: { mode: 'grid', sortKey: 'name', sortDir: 'asc' },
        tasks: { mode: 'list', sortKey: 'created_at', sortDir: 'desc' },
        notes: { mode: 'grid', sortKey: 'created_at', sortDir: 'desc' },
        transactions: { mode: 'list', sortKey: 'date', sortDir: 'desc' },
        loans: { mode: 'list', sortKey: 'created_at', sortDir: 'desc' }
    };

    function loadAll() {
        try {
            const raw = localStorage.getItem(KEY) || localStorage.getItem('mgh_list_view_v1');
            if (raw) return Object.assign({}, DEFAULT, JSON.parse(raw));
        } catch (e) {}
        return JSON.parse(JSON.stringify(DEFAULT));
    }

    let state = loadAll();

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }

    window.getListView = function (section) {
        if (!state[section]) state[section] = Object.assign({}, DEFAULT[section] || { mode: 'list', sortKey: 'created_at', sortDir: 'desc' });
        return state[section];
    };

    window.setListMode = function (section, mode) {
        const s = window.getListView(section);
        s.mode = mode;
        save();
        refreshListSection(section);
        updateListModeButtons(section);
    };

    window.setListSort = function (section, key) {
        const s = window.getListView(section);
        if (s.sortKey === key) s.sortDir = s.sortDir === 'asc' ? 'desc' : 'asc';
        else { s.sortKey = key; s.sortDir = key === 'created_at' || key === 'date' || key === 'due_date' ? 'desc' : 'asc'; }
        save();
        refreshListSection(section);
        updateListModeButtons(section);
    };

    window.setListSortPreset = function (section, value) {
        const parts = String(value || '').split(':');
        const s = window.getListView(section);
        s.sortKey = parts[0] || 'created_at';
        s.sortDir = parts[1] === 'asc' ? 'asc' : 'desc';
        save();
        refreshListSection(section);
    };

    function refreshListSection(section) {
        try {
            if (section === 'contacts') {
                if (typeof filterContacts === 'function' && document.getElementById('contact-search') && document.getElementById('contact-search').value)
                    filterContacts();
                else if (typeof fetchContacts === 'function') fetchContacts();
            } else if (section === 'tasks' && typeof fetchTasks === 'function') fetchTasks();
            else if (section === 'notes' && typeof fetchNotes === 'function') fetchNotes();
            else if (section === 'transactions' && typeof fetchTransactions === 'function') fetchTransactions();
            else if (section === 'loans' && typeof fetchLoans === 'function') fetchLoans();
        } catch (e) { console.warn(e); }
    }

    window.updateListModeButtons = function (section) {
        const s = window.getListView(section);
        document.querySelectorAll('[data-list-mode-for="' + section + '"]').forEach(function (btn) {
            const m = btn.getAttribute('data-mode');
            btn.classList.toggle('view-btn-on', m === s.mode);
        });
        const sel = document.getElementById(section + '-sort');
        if (sel) {
            const v = s.sortKey + ':' + s.sortDir;
            if ([].some.call(sel.options, function (o) { return o.value === v; })) sel.value = v;
        }
        const el = document.getElementById(section + '-list');
        if (!el) return;
        el.classList.remove(
            'grid', 'grid-cols-2', 'grid-cols-1', 'sm:grid-cols-3', 'md:grid-cols-2', 'md:grid-cols-4',
            'xl:grid-cols-3', 'xl:grid-cols-6', 'gap-3', 'gap-2', 'space-y-2', 'space-y-0'
        );
        if (s.mode === 'tiles') el.classList.add('grid', 'grid-cols-2', 'sm:grid-cols-3', 'md:grid-cols-4', 'xl:grid-cols-6', 'gap-3');
        else if (s.mode === 'grid') el.classList.add('grid', 'grid-cols-1', 'md:grid-cols-2', 'xl:grid-cols-3', 'gap-3');
        else if (s.mode === 'list') el.classList.add('space-y-2');
        else el.classList.add('space-y-0');
    };

    window.sortRows = function (rows, key, dir) {
        const d = dir === 'desc' ? -1 : 1;
        return (rows || []).slice().sort(function (a, b) {
            let va = a[key];
            let vb = b[key];
            if (key === 'amount' || key === 'total_amount' || key === 'remaining_amount' || key === 'monthly_payment') {
                return ((Number(va) || 0) - (Number(vb) || 0)) * d;
            }
            if (key === 'created_at') {
                const ta = va ? new Date(va).getTime() : 0;
                const tb = vb ? new Date(vb).getTime() : 0;
                return (ta - tb) * d;
            }
            return String(va == null ? '' : va).localeCompare(String(vb == null ? '' : vb), 'fa', { numeric: true }) * d;
        });
    };

    window.firstThumb = function (item) {
        try {
            const atts = (typeof parseAttachments === 'function') ? parseAttachments(item && item.attachments) : [];
            const img = (atts || []).find(function (a) {
                const t = String(a.type || a.mime || '');
                const data = String(a.data || a.url || a.src || '');
                return t.indexOf('image') === 0 || data.indexOf('data:image') === 0;
            });
            return img ? (img.data || img.url || img.src || '') : '';
        } catch (e) { return ''; }
    };

    window.fmtWhen = function (item) {
        if (!item) return '';
        if (item.created_at) {
            const d = new Date(item.created_at);
            if (!isNaN(d.getTime())) {
                const p = function (n) { return n < 10 ? '0' + n : '' + n; };
                return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
            }
        }
        return '';
    };

    window.renderTableShell = function (section, columns, rows, rowHtmlFn) {
        const s = window.getListView(section);
        const sorted = window.sortRows(rows, s.sortKey, s.sortDir);
        const head = columns.map(function (c) {
            const active = s.sortKey === c.key;
            const arrow = active ? (s.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
            return '<th class="px-3 py-2 text-right text-xs font-semibold cursor-pointer select-none whitespace-nowrap" onclick="setListSort(\'' + section + '\',\'' + c.key + '\')">' + c.label + arrow + '</th>';
        }).join('') + '<th class="px-3 py-2 text-xs">عملیات</th>';
        const body = sorted.map(rowHtmlFn).join('');
        return '<div class="overflow-x-auto rounded-xl border" style="border-color:var(--border)"><table class="w-full text-sm"><thead class="bg-slate-50 dark:bg-slate-800/80"><tr>' + head + '</tr></thead><tbody class="divide-y" style="border-color:var(--border)">' + body + '</tbody></table></div>';
    };

    document.addEventListener('DOMContentLoaded', function () {
        ['contacts', 'tasks', 'notes', 'transactions', 'loans'].forEach(function (sec) {
            try { updateListModeButtons(sec); } catch (e) {}
        });
    });
})();
