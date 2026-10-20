// Editor de presupuestos: carga ítems y aplica rebajas rápidas
// (porcentaje, total objetivo, redondeo). Se guarda solo en localStorage.

const CLAVE = 'presupuesto-actual';
const $ = (s) => document.querySelector(s);
const tbody = $('#tabla tbody');

let estado = cargar() || nuevoPresupuesto();
let historial = [];
let snapshotFoco = null;

function nuevoPresupuesto() {
  return {
    cliente: '', numero: '', moneda: '$', iva: 21, notas: '',
    fecha: new Date().toISOString().slice(0, 10),
    items: [nuevoItem('Ejemplo de ítem', 1, 1000)],
  };
}

function nuevoItem(desc = '', cant = 1, precio = 0) {
  return { id: crypto.randomUUID(), desc, cant, original: precio, precio, pct: 0, sel: false };
}

// ---------- cálculos ----------

const redondear2 = (n) => Math.round(n * 100) / 100;
const subtotalItem = (it) => it.cant * it.precio * (1 - it.pct / 100);
const subtotalOriginal = (it) => it.cant * it.original;
const suma = (items, f) => items.reduce((a, it) => a + f(it), 0);

function fmt(n) {
  return estado.moneda + ' ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function objetivos() {
  const sel = estado.items.filter((it) => it.sel);
  return $('#solo-seleccion').checked && sel.length ? sel : estado.items;
}

// ---------- historial ----------

function guardarHistorial(snap = JSON.stringify(estado)) {
  historial.push(snap);
  if (historial.length > 100) historial.shift();
}

function deshacer() {
  const prev = historial.pop();
  if (!prev) return;
  estado = JSON.parse(prev);
  renderTodo();
}

// ---------- rebajas ----------

function aplicarPorcentaje(p) {
  if (!(p > 0 && p < 100)) return alert('Ingresá un porcentaje entre 0 y 100.');
  guardarHistorial();
  for (const it of objetivos()) it.precio = redondear2(it.precio * (1 - p / 100));
  renderTodo();
}

function ajustarATotal(totalDeseado) {
  if (!(totalDeseado > 0)) return alert('Ingresá un total válido.');
  const afectados = objetivos();
  const fijos = estado.items.filter((it) => !afectados.includes(it));
  const subDeseado = totalDeseado / (1 + estado.iva / 100);
  const subAfectados = suma(afectados, subtotalItem);
  const restante = subDeseado - suma(fijos, subtotalItem);
  if (subAfectados <= 0 || restante <= 0) {
    return alert('No se puede llegar a ese total con los ítems elegidos.');
  }
  guardarHistorial();
  const factor = restante / subAfectados;
  for (const it of afectados) it.precio = redondear2(it.precio * factor);
  corregirCentavos(afectados, restante);
  renderTodo();
}

// Tras redondear a centavos el total puede quedar corrido unos centavos:
// se compensa en el ítem afectado de cantidad 1 sin descuento, si existe.
function corregirCentavos(afectados, objetivo) {
  const dif = redondear2(objetivo - suma(afectados, subtotalItem));
  const it = afectados.find((i) => i.cant === 1 && i.pct === 0);
  if (dif && it) it.precio = redondear2(it.precio + dif);
}

function redondearPrecios(paso) {
  guardarHistorial();
  // Se redondea hacia abajo: la idea es bajar el precio, nunca subirlo.
  for (const it of objetivos()) it.precio = Math.floor(it.precio / paso) * paso;
  renderTodo();
}

function restaurar() {
  guardarHistorial();
  for (const it of objetivos()) { it.precio = it.original; it.pct = 0; }
  renderTodo();
}

// ---------- render ----------

function renderFila(it) {
  const tr = document.createElement('tr');
  tr.dataset.id = it.id;
  tr.innerHTML = `
    <td class="no-print"><input type="checkbox" data-campo="sel"></td>
    <td class="desc"><input data-campo="desc" placeholder="Descripción"></td>
    <td class="cant"><input type="number" min="0" step="any" data-campo="cant"></td>
    <td class="num orig no-print"></td>
    <td class="pu"><input type="number" min="0" step="0.01" data-campo="precio"></td>
    <td class="pct"><input type="number" min="0" max="100" step="0.5" data-campo="pct"></td>
    <td class="num sub"></td>
    <td class="no-print"><button class="borrar" title="Eliminar">×</button></td>`;
  tr.querySelector('[data-campo=sel]').checked = it.sel;
  for (const campo of ['desc', 'cant', 'precio', 'pct']) {
    tr.querySelector(`[data-campo=${campo}]`).value = it[campo];
  }
  return tr;
}

function renderTodo() {
  for (const campo of ['cliente', 'numero', 'fecha', 'moneda', 'iva', 'notas']) {
    $('#' + campo).value = estado[campo];
  }
  tbody.replaceChildren(...estado.items.map(renderFila));
  actualizarTotales();
}

// Actualiza cifras sin re-crear inputs (para no perder el foco al tipear).
function actualizarTotales() {
  for (const it of estado.items) {
    const tr = tbody.querySelector(`tr[data-id="${it.id}"]`);
    if (!tr) continue;
    tr.querySelector('.orig').textContent = fmt(it.original);
    tr.querySelector('.sub').textContent = fmt(subtotalItem(it));
    tr.classList.toggle('rebajado', it.precio < it.original);
  }
  const sub = suma(estado.items, subtotalItem);
  const orig = suma(estado.items, subtotalOriginal);
  const iva = sub * estado.iva / 100;
  $('#t-subtotal').textContent = fmt(sub);
  $('#t-original').textContent = fmt(orig);
  const ahorro = orig - sub;
  $('#t-ahorro').textContent = fmt(ahorro) + (orig > 0 ? ` (${(ahorro / orig * 100).toFixed(1)}%)` : '');
  $('#t-iva').textContent = fmt(iva);
  $('#t-total').textContent = fmt(sub + iva);
  $('#sel-todos').checked = estado.items.length > 0 && estado.items.every((it) => it.sel);
  guardar();
}

// ---------- persistencia ----------

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch {}
}

function cargar() {
  try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; }
}

function descargar(nombre, contenido, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

function nombreArchivo(ext) {
  return `presupuesto-${estado.numero || 'sin-numero'}-${estado.fecha}.${ext}`;
}

function exportarCSV() {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const filas = [['Descripción', 'Cantidad', 'Precio original', 'Precio unitario', 'Descuento %', 'Subtotal']];
  for (const it of estado.items) {
    filas.push([it.desc, it.cant, it.original, it.precio, it.pct, redondear2(subtotalItem(it))]);
  }
  descargar(nombreArchivo('csv'), filas.map((f) => f.map(esc).join(';')).join('\n'), 'text/csv');
}

// CSV simple: descripción;cantidad;precio (también acepta coma como separador).
function importarCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  const sep = lineas[0]?.includes(';') ? ';' : ',';
  const num = (v) => parseFloat(String(v ?? '').replace(/"/g, '').replace(',', '.')) || 0;
  const items = [];
  for (const linea of lineas) {
    const [desc, cant, precio] = linea.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    if (isNaN(parseFloat(cant))) continue; // salta encabezados
    items.push(nuevoItem(desc, num(cant), num(precio)));
  }
  return items;
}

function importar(archivo) {
  const lector = new FileReader();
  lector.onload = () => {
    try {
      guardarHistorial();
      if (archivo.name.toLowerCase().endsWith('.csv')) {
        estado.items = importarCSV(lector.result);
      } else {
        estado = { ...nuevoPresupuesto(), ...JSON.parse(lector.result) };
      }
      renderTodo();
    } catch (e) {
      historial.pop();
      alert('No se pudo leer el archivo: ' + e.message);
    }
  };
  lector.readAsText(archivo);
}

// ---------- eventos ----------

const itemDe = (el) => estado.items.find((it) => it.id === el.closest('tr')?.dataset.id);

tbody.addEventListener('focusin', () => { snapshotFoco = JSON.stringify(estado); });
tbody.addEventListener('change', () => {
  if (snapshotFoco) guardarHistorial(snapshotFoco);
  snapshotFoco = JSON.stringify(estado);
});

tbody.addEventListener('input', (e) => {
  const it = itemDe(e.target);
  const campo = e.target.dataset.campo;
  if (!it || !campo) return;
  if (campo === 'sel') it.sel = e.target.checked;
  else if (campo === 'desc') it.desc = e.target.value;
  else {
    const valor = parseFloat(e.target.value) || 0;
    // Mientras el ítem no esté rebajado, cargar el precio también fija el original.
    if (campo === 'precio' && it.precio === it.original) it.original = valor;
    it[campo] = valor;
  }
  actualizarTotales();
});

tbody.addEventListener('click', (e) => {
  if (!e.target.classList.contains('borrar')) return;
  guardarHistorial();
  estado.items = estado.items.filter((it) => it !== itemDe(e.target));
  renderTodo();
});

// Si se edita el precio original directamente, se toma como nuevo original.
tbody.addEventListener('dblclick', (e) => {
  const td = e.target.closest('td.orig');
  if (!td) return;
  const it = itemDe(td);
  const v = parseFloat(prompt('Nuevo precio original:', it.original));
  if (isNaN(v)) return;
  guardarHistorial();
  it.original = v;
  renderTodo();
});

for (const campo of ['cliente', 'numero', 'fecha', 'moneda', 'notas', 'iva']) {
  $('#' + campo).addEventListener('input', (e) => {
    estado[campo] = campo === 'iva' ? parseFloat(e.target.value) || 0 : e.target.value;
    actualizarTotales();
  });
}

$('#sel-todos').addEventListener('change', (e) => {
  for (const it of estado.items) it.sel = e.target.checked;
  renderTodo();
});

$('#btn-agregar').addEventListener('click', () => {
  guardarHistorial();
  estado.items.push(nuevoItem());
  renderTodo();
  tbody.lastElementChild.querySelector('[data-campo=desc]').focus();
});

document.querySelectorAll('[data-pct]').forEach((b) =>
  b.addEventListener('click', () => aplicarPorcentaje(parseFloat(b.dataset.pct))));
document.querySelectorAll('[data-redondeo]').forEach((b) =>
  b.addEventListener('click', () => redondearPrecios(parseFloat(b.dataset.redondeo))));

$('#btn-pct').addEventListener('click', () => aplicarPorcentaje(parseFloat($('#pct-custom').value)));
$('#btn-objetivo').addEventListener('click', () => ajustarATotal(parseFloat($('#total-objetivo').value)));
$('#btn-restaurar').addEventListener('click', restaurar);
$('#btn-deshacer').addEventListener('click', deshacer);
$('#btn-imprimir').addEventListener('click', () => window.print());
$('#btn-exportar').addEventListener('click', () =>
  descargar(nombreArchivo('json'), JSON.stringify(estado, null, 2), 'application/json'));
$('#btn-csv').addEventListener('click', exportarCSV);
$('#btn-importar').addEventListener('click', () => $('#archivo').click());
$('#archivo').addEventListener('change', (e) => {
  if (e.target.files[0]) importar(e.target.files[0]);
  e.target.value = '';
});

$('#btn-nuevo').addEventListener('click', () => {
  if (!confirm('¿Empezar un presupuesto nuevo? Se puede deshacer.')) return;
  guardarHistorial();
  estado = nuevoPresupuesto();
  renderTodo();
});

document.addEventListener('keydown', (e) => {
  const enTexto = e.target.matches('input:not([type=checkbox]), textarea');
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !enTexto) {
    e.preventDefault();
    deshacer();
  }
});

renderTodo();
