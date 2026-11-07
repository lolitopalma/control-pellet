
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://qhqfucaiquguhevxictb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_o-dR5lD0o3QTJqL8wuxO4Q_DUVhWhuD';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById('app');

let purchases = [];
let openings = [];

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function euros(value) {
  return Number(value || 0).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR'
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function showMessage(message, error = false) {
  const box = document.getElementById('message');
  if (!box) return;
  box.textContent = message;
  box.style.background = error ? '#fbe9e7' : '#edf3ec';
  box.style.color = error ? '#a12d25' : '#263b2c';
}

function renderLogin() {
  app.innerHTML = `
    <header>
      <h1>🔥 Mi control de pellet</h1>
      <p>Controla tus compras y consumo</p>
    </header>
    <main>
      <section class="card">
        <h2>Entrar en tu cuenta</h2>
        <p>Te enviaremos un enlace a tu correo para acceder.</p>
        <form id="loginForm">
          <label for="email">Tu correo electrónico</label>
          <input id="email" type="email" required
            placeholder="tu correo electrónico">
          <button type="submit">Enviar enlace de acceso</button>
        </form>
        <div id="message" class="message hidden"></div>
      </section>
    </main>
  `;

  document.getElementById('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const button = event.submitter;
    button.disabled = true;
    button.textContent = 'Enviando...';

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin +
          window.location.pathname
      }
    });

    button.disabled = false;
    button.textContent = 'Enviar enlace de acceso';

    const box = document.getElementById('message');
    box.classList.remove('hidden');

    if (error) {
      showMessage('No se pudo enviar el correo: ' + error.message, true);
    } else {
      showMessage('¡Correo enviado! Abre el enlace que te hemos enviado para entrar.');
    }
  });
}

function getStats() {
  const sacksBought = purchases.reduce(
    (sum, item) => sum + Number(item.sack_count), 0
  );

  const sacksOpened = openings.length;
  const stock = sacksBought - sacksOpened;

  const totalSpent = purchases.reduce(
    (sum, item) => sum + Number(item.total_cost), 0
  );

  const totalSacks = sacksBought;
  const averagePrice = totalSacks ? totalSpent / totalSacks : 0;

  const dates = openings
    .map(item => item.opening_date)
    .sort();

  let averageDays = 0;

  if (dates.length >= 2) {
    let totalDays = 0;

    for (let i = 1; i < dates.length; i++) {
      const first = new Date(dates[i - 1] + 'T12:00:00');
      const second = new Date(dates[i] + 'T12:00:00');
      totalDays += (second - first) / 86400000;
    }

    averageDays = totalDays / (dates.length - 1);
  }

  const lastOpening = dates.length
    ? dates[dates.length - 1]
    : null;

  let daysRemaining = null;

  if (lastOpening && averageDays > 0 && stock > 0) {
    const lastDate = new Date(lastOpening + 'T12:00:00');
    const elapsed = Math.floor(
      (new Date() - lastDate) / 86400000
    );
    daysRemaining = Math.max(
      0,
      Math.round(stock * averageDays - elapsed)
    );
  }

  return {
    sacksBought,
    sacksOpened,
    stock,
    totalSpent,
    averagePrice,
    averageDays,
    daysRemaining
  };
}

async function loadData() {
  const { data: purchaseData, error: purchaseError } =
    await supabase
      .from('purchases')
      .select('*')
      .order('purchase_date', { ascending: false });

  const { data: openingData, error: openingError } =
    await supabase
      .from('openings')
      .select('*')
      .order('opening_date', { ascending: false });

  if (purchaseError || openingError) {
    app.innerHTML = `
      <main>
        <section class="card">
          <h2>Error al cargar los datos</h2>
          <p>${escapeHTML(
            purchaseError?.message || openingError?.message
          )}</p>
          <button onclick="location.reload()">Volver a intentar</button>
        </section>
      </main>`;
    return;
  }

  purchases = purchaseData || [];
  openings = openingData || [];
  renderDashboard();
}

function renderDashboard() {
  const stats = getStats();

  const purchaseList = purchases.length
    ? purchases.map(item => `
        <div class="list-item">
          <strong>${escapeHTML(item.purchase_date)}</strong><br>
          ${escapeHTML(item.sack_count)} sacos ·
          ${euros(item.total_cost)}
        </div>
      `).join('')
    : '<p>Aún no hay compras registradas.</p>';

  const openingList = openings.length
    ? openings.map(item => `
        <div class="list-item">
          Apertura del <strong>${escapeHTML(item.opening_date)}</strong>
        </div>
      `).join('')
    : '<p>Aún no hay sacos abiertos.</p>';

  app.innerHTML = `
    <header>
      <h1>🔥 Mi control de pellet</h1>
      <p>Tu consumo, siempre bajo control</p>
    </header>

    <main>
      <section class="card">
        <h2>📊 Mi resumen</h2>
        <div class="stats">
          <div class="stat">
            Sacos disponibles
            <strong>${stats.stock}</strong>
          </div>
          <div class="stat">
            Kilos disponibles
            <strong>${stats.stock * 15} kg</strong>
          </div>
          <div class="stat">
            Gasto total
            <strong>${euros(stats.totalSpent)}</strong>
          </div>
          <div class="stat">
            Precio medio por saco
            <strong>${euros(stats.averagePrice)}</strong>
          </div>
          <div class="stat">
            Sacos abiertos
            <strong>${stats.sacksOpened}</strong>
          </div>
          <div class="stat">
            Duración media
            <strong>${stats.averageDays
              ? stats.averageDays.toFixed(1) + ' días'
              : 'Pendiente'}</strong>
          </div>
        </div>
        <p>
          ${stats.daysRemaining !== null
            ? 'Previsión aproximada: quedan ' +
              stats.daysRemaining + ' días de pellet.'
            : 'La previsión aparecerá cuando registres al menos dos aperturas y tengas existencias.'}
        </p>
      </section>

      <section class="card">
        <h2>🛒 Registrar una compra</h2>
        <form id="purchaseForm">
          <label for="purchaseDate">Fecha de compra</label>
          <input id="purchaseDate" type="date"
            value="${today()}" required>

          <label for="sackCount">Número de sacos de 15 kg</label>
          <input id="sackCount" type="number"
            min="1" step="1" required placeholder="Ej. 20">

          <label for="totalCost">Coste total (€)</label>
          <input id="totalCost" type="number"
            min="0.01" step="0.01" required placeholder="Ej. 120">

          <button type="submit">Guardar compra</button>
        </form>
        <div id="message" class="message hidden"></div>
      </section>

      <section class="card">
        <h2>🔥 Registrar apertura de un saco</h2>
        <form id="openingForm">
          <label for="openingDate">Fecha de apertura</label>
          <input id="openingDate" type="date"
            value="${today()}" required>
          <button type="submit">Registrar apertura</button>
        </form>
      </section>

      <section class="card">
        <h2>🛒 Mis compras</h2>
        ${purchaseList}
      </section>

      <section class="card">
        <h2>🔥 Mis aperturas</h2>
        ${openingList}
      </section>

      <button id="logout" class="secondary">Cerrar sesión</button>
      <footer>Mi control de pellet · Sacos de 15 kg</footer>
    </main>
  `;

  document.getElementById('purchaseForm')
    .addEventListener('submit', savePurchase);

  document.getElementById('openingForm')
    .addEventListener('submit', saveOpening);

  document.getElementById('logout')
    .addEventListener('click', async () => {
      await supabase.auth.signOut();
      renderLogin();
    });
}

async function savePurchase(event) {
  event.preventDefault();

  const button = event.submitter;
  button.disabled = true;

  const purchase = {
    purchase_date: document.getElementById('purchaseDate').value,
    sack_count: Number(document.getElementById('sackCount').value),
    total_cost: Number(document.getElementById('totalCost').value)
  };

  const { error } = await supabase
    .from('purchases')
    .insert(purchase);

  button.disabled = false;

  if (error) {
    showMessage('Error al guardar la compra: ' + error.message, true);
    return;
  }

  await loadData();
}

async function saveOpening(event) {
  event.preventDefault();

  const button = event.submitter;
  button.disabled = true;

  const stats = getStats();

  if (stats.stock <= 0) {
    button.disabled = false;
    showMessage('No tienes sacos disponibles. Registra primero una compra.', true);
    return;
  }

  const opening = {
    opening_date: document.getElementById('openingDate').value
  };

  const { error } = await supabase
    .from('openings')
    .insert(opening);

  button.disabled = false;

  if (error) {
    showMessage('Error al guardar la apertura: ' + error.message, true);
    return;
  }

  await loadData();
}

async function start() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    await loadData();
  } else {
    renderLogin();
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    loadData();
  }
});

start();
