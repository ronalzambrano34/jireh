# Pruebas de conectividad

Objetivo: validar que el sistema no duplique acciones, conserva datos visibles y muestra mensajes claros cuando la red es lenta, se corta o no existe.

## Preparacion

- Backend y frontend levantados contra la API real o el entorno que se quiera validar.
- Operador admin y operador normal disponibles.
- Al menos un metodo de pago, punto de recogida, moneda y cuenta de pago activos.
- Una imagen pequena y una imagen grande para probar uploads.
- Probar primero con internet normal para dejar instalada/cacheada la PWA.

## Matriz de pruebas

| Escenario | Condicion | Flujo | Resultado esperado |
| --- | --- | --- | --- |
| Conexion lenta | DevTools Network: Slow 3G o 3G real | Login, abrir Pedidos, crear pedido, subir comprobante | No hay peticiones dobles, hay loading/progreso, no se borran datos si falla una recarga |
| Modo avion | Sin conexion desde el sistema operativo | Abrir PWA, entrar a Inicio, Nuevo pedido, Detalle pedido, Pedidos | La app abre si estaba cacheada, acciones criticas quedan bloqueadas, se muestra "Sin internet" |
| Corte intermitente | Activar/desactivar red durante una accion | Crear pedido, confirmar pago, tomar, liberar, transferir, cancelar, finalizar | No se duplican pedidos, historial, archivos ni notificaciones |
| Recarga durante operacion | Recargar pagina en medio de crear/confirmar/finalizar | Nuevo pedido con datos cargados, vista de pago, detalle pedido | Se conserva el ultimo estado valido o borrador; no se ejecuta dos veces la misma accion |
| Servidor apagado | Backend detenido con internet activo | Login, cargar pedidos, abrir detalle, reportes | Mensaje concreto de servidor inaccesible, datos visibles previos no desaparecen |
| Timeout | Red muy lenta o API demorando mas del limite | Login, listar pedidos, subir comprobante | Mensaje concreto de timeout y boton disponible para reintentar manualmente |
| Token vencido | Token invalido o expirado | Recargar app y abrir vista protegida | Mensaje de sesion vencida y salida controlada |
| Archivo grande | Subir archivo mayor al limite configurado | Foto perfil, comprobante, promociones/metodos de pago | Mensaje de archivo muy grande sin iniciar subida duplicada |

## Flujos criticos

- Crear pedido de transferencia.
- Crear pedido de efectivo.
- Crear pedido de saldo.
- Crear pedido de divisa.
- Crear pedido de otros.
- Confirmar pago.
- Tomar pedido.
- Liberar pedido.
- Transferir pedido.
- Cancelar pedido.
- Finalizar pedido con comprobante.
- Finalizar pedido sin comprobante.
- Reenviar mensaje operativo a WhatsApp.

## Checklist de cierre

- [ ] No se crean pedidos duplicados al doble tap, recarga o reconexion.
- [ ] No se sube dos veces el mismo comprobante/documento.
- [ ] No se duplican registros de historial.
- [ ] No se duplican notificaciones al reconectar.
- [ ] Las acciones que modifican datos se bloquean sin conexion.
- [ ] Las lecturas pueden reintentarse sin cambiar datos.
- [ ] La PWA abre sin internet despues de haberse cargado una vez.
- [ ] Los datos visibles no desaparecen si falla una recarga.
- [ ] Los borradores de nuevo pedido permiten continuar despues de cerrar/recargar.
- [ ] Los mensajes distinguen: sin internet, servidor apagado, timeout, sesion vencida y archivo grande.
- [ ] Los uploads muestran progreso, error y reintento manual.
- [ ] En red lenta no hay refresh agresivo ni perdida de estado.

## Registro de resultado

| Fecha | Version/commit | Dispositivo/red | Resultado | Pendiente |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
