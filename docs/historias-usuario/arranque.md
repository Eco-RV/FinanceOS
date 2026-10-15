# Arranque de 0

> Ver convención general en [`README.md`](./README.md).

## Resumen

Rutina para **empezar de nuevo** sin perder la historia: archiva todos los
movimientos, elimina financiamientos y préstamos y crea un saldo inicial nuevo
por cada cuenta y tarjeta (regla M8 de
[`../dominio/reglas.md`](../dominio/reglas.md)).

## Historias de usuario

### 1. Arrancar de 0
Como usuario quiero reiniciar mis finanzas desde los saldos reales de hoy,
para dejar atrás registros incompletos o de prueba sin borrar mis cuentas ni
mi configuración.

**Criterios de aceptación**
- Página `Ajustes → Arranque de 0` (`/ajustes/arranque`), con un aviso de qué
  pasará y cuántos movimientos, financiamientos y préstamos se afectan.
- Se pide un **saldo inicial nuevo** para cada cuenta activa y para cada
  tarjeta activa en colones y en dólares (deuda). Vienen precargados con el
  saldo de hoy; 0 = sin saldo.
- Una **fecha** para esos saldos (default hoy). En tarjetas, el saldo cuenta
  como cargo en esa fecha: si es anterior al último corte entra al pago de
  contado vigente.
- **Confirmación escrita**: el botón "Arrancar de 0" solo se habilita al
  escribir `ARRANCAR` (también lo valida el servidor).
- Al confirmar, en una sola operación (o todo o nada):
  - las **cuotas pendientes** (fecha posterior a hoy) de los financiamientos
    se eliminan;
  - **todos** los movimientos activos se **archivan**: gastos, ingresos,
    abonos, transferencias, saldos iniciales anteriores, cuotas ya cobradas y
    pagos de préstamos. Dejan de verse en todas las listas y de contar en los
    saldos;
  - se **eliminan** los financiamientos y los préstamos (sus cuotas cobradas
    quedan archivadas, desligadas del plan), con el reparto, los reembolsos y
    los avisos a miembros de cada financiamiento;
  - se crean los saldos iniciales nuevos, que son lo **único visible**
    ("Saldo inicial (arranque de 0)").
- Después lleva al Resumen; la página muestra la fecha del último arranque.

## Reglas de negocio

- M8: rechaza sin la confirmación escrita y sin un saldo para cada cuenta y
  tarjeta activa. Las cuentas y tarjetas desactivadas no reciben saldo.
- Se conservan cuentas, tarjetas, bancos, categorías, miembros, el correo
  conectado, las reglas de comercio, los pendientes por confirmar y los tipos
  de cambio.
- El saldo de hoy que se propone para cada tarjeta no incluye el interés de
  cuotas de financiamiento que todavía no llegan (se borra con el plan).
- Los movimientos archivados siguen contando como **historia** (G5): una
  cuenta o tarjeta con movimientos archivados se desactiva, no se elimina.

## Pendiente / fuera de alcance

- No hay forma de ver ni restaurar los movimientos archivados desde la app.

## Historial

- **2026-10-12 (v2.2.0, en desarrollo)** — Primera versión
  (`supabase/Versionamiento/2.2.0/00_fresh_start.sql`).
- **2026-10-14 (v2.3.0, en desarrollo)** — Se borran también el reparto,
  reembolsos y avisos de los financiamientos; los miembros se conservan. El
  saldo propuesto de las tarjetas descuenta el interés de cuotas futuras.
- **2026-10-14 (v2.7.0, en desarrollo)** — Los planes (salario, suscripciones,
  seguros) y las metas de ahorro se conservan; los planes siguen registrando
  desde el día del arranque.
