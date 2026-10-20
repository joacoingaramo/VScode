# Editor de Presupuestos

App web (HTML + JS, sin dependencias) para cargar un presupuesto y bajarle el precio rápido.

Abrí `index.html` en el navegador.

## Funciones
- **Descuento general**: -5 / -10 / -15 / -20 % o un % a elección.
- **Llegar a un total**: escribís el total final (con IVA) y la app reparte la rebaja proporcionalmente entre los ítems.
- **Redondear precios** hacia abajo (a 1, 10, 100 o 1000).
- **Solo ítems seleccionados**: las rebajas se aplican únicamente a los ítems tildados.
- Descuento % por ítem, IVA configurable y comparación precio original vs. rebajado.
- **Deshacer** (Ctrl+Z) y **Volver a precios originales**.
- Guardado automático en el navegador; exportar/importar JSON, exportar/importar CSV (`descripción;cantidad;precio`).
- **Imprimir / PDF**: oculta los controles y los precios originales.

Doble clic en un precio original para cambiarlo.
