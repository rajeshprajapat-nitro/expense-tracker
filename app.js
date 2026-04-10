// ── State ─────────────────────────────────────────────────────────────────────
let transactions = JSON.parse(localStorage.getItem('ft_transactions') || '[]');
let budget       = JSON.parse(localStorage.getItem('ft_budget') || '{"total":0,"cats":{}}');
let currentType  = 'expense';

const CATEGORIES = {
  expense: [
    { name: 'Food & Dining',   icon: '🍔', color: '#f4506e' },
    { name: 'Transport',       icon: '🚗', color: '#f5c842' },
    { name: 'Shopping',        icon: '🛍️', color: '#a78bfa' },
    { name: 'Entertainment',   icon: '🎮', color: '#38bdf8' },
    { name: 'Health',          icon: '💊', color: '#22d3a0' },
    { name: 'Education',       icon: '📚', color: '#fb923c' },
    { name: 'Utilities',       icon: '⚡', color: '#e879f9' },
    { name: 'Rent',            icon: '🏠', color: '#6ee7b7' },
    { name: 'Other Expense',   icon: '📦', color: '#94a3b8' },
  ],
  income: [
    { name: 'Salary',          icon: '💼', color: '#22d3a0' },
    { name: 'Freelance',       icon: '💻', color: '#38bdf8' },
    { name: 'Investment',      icon: '📈', color: '#a78bfa' },
    { name: 'Gift',            icon: '🎁', color: '#f5c842' },
    { name: 'Other Income',    icon: '💰', color: '#6ee7b7' },
  ]
};

const ALL_CATS = [...CATEGORIES.expense, ...CATEGORIES.income];
const catMap   = Object.fromEntries(ALL_CATS.map(c => [c.name, c]));

// ── Greeting ──────────────────────────────────────────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning 👋' : h < 17 ? 'Good afternoon ☀️' : 'Good evening 🌙';
  document.getElementById('greeting').textContent = g;
}

// ── Persist ───────────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem('ft_transactions', JSON.stringify(transactions));
  localStorage.setItem('ft_budget',       JSON.stringify(budget));
}

// ── Format ────────────────────────────────────────────────────────────────────
function fmt(n) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

// ── Derived Stats ─────────────────────────────────────────────────────────────
function getStats() {
  const income  = transactions.filter(t => t.type === 'income').reduce((s,t)=>s+t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s,t)=>s+t.amount, 0);
  return { income, expense, balance: income - expense };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const { income, expense, balance } = getStats();
  const savRate = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;

  document.getElementById('total-income').textContent  = fmt(income);
  document.getElementById('total-expense').textContent = fmt(expense);
  document.getElementById('net-balance').textContent   = (balance >= 0 ? '' : '-') + fmt(balance);
  document.getElementById('income-count').textContent  = transactions.filter(t=>t.type==='income').length + ' transactions';
  document.getElementById('expense-count').textContent = transactions.filter(t=>t.type==='expense').length + ' transactions';
  document.getElementById('savings-rate').textContent  = savRate + '% savings rate';

  // Budget
  const budgetUsed = budget.total > 0 ? Math.min((expense / budget.total) * 100, 100) : 0;
  document.getElementById('budget-used-pct').textContent = Math.round(budgetUsed) + '%';
  document.getElementById('budget-remain').textContent = fmt(Math.max(budget.total - expense, 0)) + ' remaining';

  // Sidebar
  document.getElementById('sidebar-balance').textContent = (balance >= 0 ? '' : '-') + fmt(balance);
  document.getElementById('sidebar-balance').style.color = balance >= 0 ? 'var(--green)' : 'var(--red)';
  const fillPct = income > 0 ? Math.max(Math.min((balance / income) * 100, 100), 0) : 0;
  document.getElementById('sidebar-bar').style.width = fillPct + '%';

  renderBarChart();
  renderDonutChart();
  renderRecentList();
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
let barChart = null;
function renderBarChart() {
  const months = getLast6Months();
  const incomes  = months.map(m => getMonthTotal(m, 'income'));
  const expenses = months.map(m => getMonthTotal(m, 'expense'));
  const labels   = months.map(m => {
    const [y, mo] = m.split('-');
    return new Date(y, mo-1).toLocaleString('en', { month: 'short' });
  });

  const ctx = document.getElementById('bar-chart').getContext('2d');
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Income',  data: incomes,  backgroundColor:'rgba(34,211,160,0.7)',  borderRadius:6, borderSkipped:false },
        { label:'Expense', data: expenses, backgroundColor:'rgba(244,80,110,0.7)', borderRadius:6, borderSkipped:false },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color:'#7070a0', font:{ family:'DM Mono' } } } },
      scales: {
        x: { ticks:{ color:'#7070a0' }, grid:{ color:'rgba(255,255,255,0.04)' } },
        y: { ticks:{ color:'#7070a0', callback: v => '₹'+v.toLocaleString('en-IN') }, grid:{ color:'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
let donutChart = null;
function renderDonutChart() {
  const expenses = transactions.filter(t => t.type === 'expense');
  const catTotals = {};
  expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
  const sorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,6);

  const labels = sorted.map(([c]) => c);
  const data   = sorted.map(([,v]) => v);
  const colors = labels.map(l => catMap[l]?.color || '#7c6af7');

  const ctx = document.getElementById('donut-chart').getContext('2d');
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
    options: {
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } }
      }
    }
  });

  // Legend
  const leg = document.getElementById('donut-legend');
  leg.innerHTML = labels.map((l,i) =>
    `<div class="legend-item"><div class="legend-dot" style="background:${colors[i]}"></div>${l}</div>`
  ).join('');
}

// ── Recent Transactions ───────────────────────────────────────────────────────
function renderRecentList() {
  const list = document.getElementById('recent-list');
  const recent = [...transactions].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,6);

  if (!recent.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">💸</div>No transactions yet. Add one!</div>`;
    return;
  }
  list.innerHTML = recent.map(t => txItemHTML(t)).join('');
  list.querySelectorAll('.tx-del').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });
}

function txItemHTML(t) {
  const cat = catMap[t.category] || { icon:'💰', color:'#7c6af7' };
  return `<div class="tx-item">
    <div class="tx-icon" style="background:${cat.color}22">${cat.icon}</div>
    <div class="tx-info">
      <div class="tx-desc">${t.desc}</div>
      <div class="tx-meta">${t.category} · ${fmtDate(t.date)}${t.note ? ' · '+t.note : ''}</div>
    </div>
    <div class="tx-amount ${t.type==='income'?'inc':'exp'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
    <button class="tx-del" data-id="${t.id}" title="Delete">✕</button>
  </div>`;
}

// ── Transactions Tab ──────────────────────────────────────────────────────────
function renderTransactionsTab() {
  // Populate category filter
  const catSel = document.getElementById('filter-cat');
  const existing = Array.from(catSel.options).map(o => o.value);
  ALL_CATS.forEach(c => {
    if (!existing.includes(c.name)) {
      const opt = document.createElement('option');
      opt.value = c.name; opt.textContent = c.name;
      catSel.appendChild(opt);
    }
  });
  renderTxTable();
}

function renderTxTable() {
  const type   = document.getElementById('filter-type').value;
  const cat    = document.getElementById('filter-cat').value;
  const search = document.getElementById('search-input').value.toLowerCase();

  let list = [...transactions].sort((a,b) => new Date(b.date)-new Date(a.date));
  if (type !== 'all')   list = list.filter(t => t.type === type);
  if (cat  !== 'all')   list = list.filter(t => t.category === cat);
  if (search)           list = list.filter(t => t.desc.toLowerCase().includes(search) || t.category.toLowerCase().includes(search));

  const tbody = document.getElementById('tx-table-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">No transactions found</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(t => {
    const cat = catMap[t.category] || { icon:'💰' };
    return `<tr>
      <td>${fmtDate(t.date)}</td>
      <td>${cat.icon} ${t.desc}</td>
      <td>${t.category}</td>
      <td><span class="badge ${t.type==='income'?'badge-inc':'badge-exp'}">${t.type}</span></td>
      <td style="font-family:var(--mono);color:${t.type==='income'?'var(--green)':'var(--red)'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</td>
      <td><button class="tx-del" data-id="${t.id}" style="opacity:1">✕</button></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('.tx-del').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────
let barCatChart = null, lineChart = null;
function renderAnalytics() {
  // Category bar
  const expenses = transactions.filter(t => t.type === 'expense');
  const catTotals = {};
  expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
  const sorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);

  const ctx1 = document.getElementById('bar-cat-chart').getContext('2d');
  if (barCatChart) barCatChart.destroy();
  barCatChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: sorted.map(([c])=>c),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: sorted.map(([c])=>catMap[c]?.color||'#7c6af7'), borderRadius:6, borderSkipped:false }]
    },
    options: {
      indexAxis:'y', responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ ticks:{ color:'#7070a0', callback:v=>'₹'+v.toLocaleString('en-IN') }, grid:{ color:'rgba(255,255,255,0.04)' } },
        y:{ ticks:{ color:'#7070a0' }, grid:{ display:false } }
      }
    }
  });

  // Line chart
  const months = getLast6Months();
  const ctx2   = document.getElementById('line-chart').getContext('2d');
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(ctx2, {
    type:'line',
    data:{
      labels: months.map(m=>{const[y,mo]=m.split('-');return new Date(y,mo-1).toLocaleString('en',{month:'short'});}),
      datasets:[
        { label:'Income',  data:months.map(m=>getMonthTotal(m,'income')),  borderColor:'var(--green)', backgroundColor:'rgba(34,211,160,0.08)', fill:true, tension:0.4, pointRadius:4 },
        { label:'Expense', data:months.map(m=>getMonthTotal(m,'expense')), borderColor:'var(--red)',   backgroundColor:'rgba(244,80,110,0.08)',  fill:true, tension:0.4, pointRadius:4 }
      ]
    },
    options:{
      responsive:true,
      plugins:{ legend:{ labels:{ color:'#7070a0' } } },
      scales:{
        x:{ ticks:{ color:'#7070a0' }, grid:{ color:'rgba(255,255,255,0.04)' } },
        y:{ ticks:{ color:'#7070a0', callback:v=>'₹'+v.toLocaleString('en-IN') }, grid:{ color:'rgba(255,255,255,0.04)' } }
      }
    }
  });

  // Top categories
  const topEl = document.getElementById('top-categories');
  const total = sorted.reduce((s,[,v])=>s+v,0);
  topEl.innerHTML = sorted.slice(0,6).map(([cat,val],i)=>`
    <div class="top-item">
      <span class="top-rank">#${i+1}</span>
      <span class="top-name">${cat}</span>
      <div class="top-bar-wrap"><div class="top-bar-fill" style="width:${total?((val/total)*100):0}%"></div></div>
      <span class="top-val">${fmt(val)}</span>
    </div>`).join('') || '<div class="empty">No data yet</div>';

  // Monthly summary
  const msEl = document.getElementById('month-summary');
  msEl.innerHTML = getLast6Months().reverse().map(m=>{
    const [y,mo] = m.split('-');
    const label  = new Date(y,mo-1).toLocaleString('en',{month:'long',year:'numeric'});
    const inc    = getMonthTotal(m,'income');
    const exp    = getMonthTotal(m,'expense');
    return `<div class="ms-row">
      <span class="ms-month">${label}</span>
      <span class="ms-inc">+${fmt(inc)}</span>
      <span class="ms-exp">-${fmt(exp)}</span>
    </div>`;
  }).join('');
}

// ── Budget Tab ────────────────────────────────────────────────────────────────
function renderBudget() {
  document.getElementById('budget-input').value = budget.total || '';

  // Category budget inputs
  const catsEl = document.getElementById('budget-cats');
  const existing = catsEl.querySelectorAll('.budget-cat-row');
  if (!existing.length) {
    CATEGORIES.expense.forEach(c => {
      const row = document.createElement('div');
      row.className = 'budget-cat-row';
      row.innerHTML = `<span class="budget-cat-label">${c.icon} ${c.name}</span>
        <input class="budget-cat-input" type="number" placeholder="₹ limit" data-cat="${c.name}" value="${budget.cats[c.name]||''}"/>`;
      catsEl.appendChild(row);
    });
  }

  // Progress
  const { expense } = getStats();
  const progEl = document.getElementById('budget-progress-list');
  const items  = [];

  if (budget.total) {
    const pct = Math.min((expense / budget.total) * 100, 100);
    const col = pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--yellow)' : 'var(--green)';
    items.push(`<div class="progress-item">
      <div class="progress-header"><span class="progress-name">Overall Budget</span><span class="progress-vals">${fmt(expense)} / ${fmt(budget.total)}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${col}"></div></div>
    </div>`);
  }

  CATEGORIES.expense.forEach(c => {
    const limit = budget.cats[c.name];
    if (!limit) return;
    const spent = transactions.filter(t=>t.type==='expense'&&t.category===c.name).reduce((s,t)=>s+t.amount,0);
    const pct   = Math.min((spent/limit)*100,100);
    const col   = pct>90?'var(--red)':pct>70?'var(--yellow)':catMap[c.name]?.color||'var(--accent)';
    items.push(`<div class="progress-item">
      <div class="progress-header"><span class="progress-name">${c.icon} ${c.name}</span><span class="progress-vals">${fmt(spent)} / ${fmt(limit)}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${col}"></div></div>
    </div>`);
  });

  progEl.innerHTML = items.length ? items.join('') : '<div class="empty">Set a budget to track progress</div>';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLast6Months() {
  const months = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`);
  }
  return months;
}

function getMonthTotal(ym, type) {
  return transactions
    .filter(t => t.type === type && t.date.startsWith(ym))
    .reduce((s,t)=>s+t.amount, 0);
}

// ── Add Transaction ───────────────────────────────────────────────────────────
function addTransaction() {
  const desc   = document.getElementById('tx-desc').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const date   = document.getElementById('tx-date').value;
  const cat    = document.getElementById('tx-category').value;
  const note   = document.getElementById('tx-note').value.trim();

  if (!desc)        return showToast('Please enter a description');
  if (!amount || amount <= 0) return showToast('Enter a valid amount');
  if (!date)        return showToast('Please select a date');

  const tx = {
    id: Date.now().toString(),
    type: currentType, desc, amount, date, category: cat, note
  };
  transactions.unshift(tx);
  save();
  closeModal();
  renderAll();
  showToast(`${currentType === 'income' ? '💰' : '💸'} Transaction added!`);

  // Budget alert
  if (currentType === 'expense' && budget.total) {
    const { expense } = getStats();
    const pct = (expense / budget.total) * 100;
    if (pct >= 90) showToast('⚠️ You have used 90%+ of your budget!');
  }
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  renderAll();
  showToast('Transaction deleted');
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV() {
  if (!transactions.length) return showToast('No data to export');
  const rows = [['Date','Description','Category','Type','Amount','Note']];
  [...transactions].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(t => {
    rows.push([t.date, t.desc, t.category, t.type, t.amount, t.note||'']);
  });
  const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'fintrack-export.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('📥 CSV exported!');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  populateCategorySelect();
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  ['tx-desc','tx-amount','tx-note'].forEach(id => document.getElementById(id).value = '');
}
function populateCategorySelect() {
  const sel = document.getElementById('tx-category');
  sel.innerHTML = '';
  CATEGORIES[currentType].forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name; opt.textContent = `${c.icon} ${c.name}`;
    sel.appendChild(opt);
  });
}

// ── Render All ────────────────────────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderTransactionsTab();
  renderAnalytics();
  renderBudget();
}

// ── Tab Switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
}

// ── Event Listeners ───────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('open-modal-btn').addEventListener('click', openModal);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentType = btn.dataset.type;
    populateCategorySelect();
  });
});

document.getElementById('add-tx-btn').addEventListener('click', addTransaction);
document.getElementById('export-btn').addEventListener('click', exportCSV);

document.getElementById('filter-type').addEventListener('change', renderTxTable);
document.getElementById('filter-cat').addEventListener('change', renderTxTable);
document.getElementById('search-input').addEventListener('input', renderTxTable);

document.getElementById('save-budget-btn').addEventListener('click', () => {
  budget.total = parseFloat(document.getElementById('budget-input').value) || 0;
  document.querySelectorAll('.budget-cat-input').forEach(inp => {
    const cat = inp.dataset.cat;
    const val = parseFloat(inp.value) || 0;
    if (val > 0) budget.cats[cat] = val;
    else delete budget.cats[cat];
  });
  save();
  renderBudget();
  renderDashboard();
  showToast('✅ Budget saved!');
});

// Keyboard shortcut: press N to open modal
document.addEventListener('keydown', e => {
  if (e.key === 'n' && !e.ctrlKey && document.activeElement.tagName !== 'INPUT') openModal();
  if (e.key === 'Escape') closeModal();
});

// ── Init ──────────────────────────────────────────────────────────────────────
setGreeting();
renderAll();
