# Pruebas de conectividad

Objetivo: validar que el sistema no duplique acciones, conserva datos visibles y muestra mensajes claros cuando la red es lenta, se corta o no existe.

## Preparacion

- Backend y frontend levantados contra la API real o el entorno que se quiera validar.
- Operador admin y operador normal disponibles.
- Al menos un metodo de pago, punto de recogida, moneda y cuenta de pago activos.
- Una imagen pequena y una imagen grande para probar uploads.
- Probar primero con internet normal para dejar instalada/cacheada la PWA.

## Ejecucion manual

1. Levantar backend y frontend.
2. Abrir la app en Chrome/Edge desde un telefono o desde DevTools desktop.
3. Iniciar sesion con un operador real.
4. Abrir una vez Inicio, Nuevo pedido, Pedidos, Detalle pedido, Reportes y Perfil para dejar cache y estado local.
5. En DevTools > Network seleccionar Slow 3G para la prueba de red lenta.
6. Para modo avion, cortar internet desde el sistema operativo o el telefono, no solo bloquear una URL.
7. En cada escenario revisar consola y red: no debe haber POST/PATCH duplicados para la misma accion.
8. Al terminar, completar la tabla de Registro de resultado con dispositivo, red, resultado y pendientes.

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

## Verificacion por escenario

### Conexion lenta

- Activar Slow 3G.
- Crear un pedido con comprobante.
- Revisar que el boton quede bloqueado mientras carga.
- Confirmar que solo exista un pedido creado.
- Confirmar que el upload muestre progreso o estado de carga.

### Modo avion

- Cargar la PWA una vez con internet.
- Activar modo avion.
- Abrir Inicio y Nuevo pedido.
- Confirmar que Nuevo pedido permite llenar datos y guardar borrador.
- Confirmar que crear pedido, subir archivos y confirmar pagos queden bloqueados con mensaje de sin conexion.

### Corte intermitente

- Iniciar una accion critica.
- Cortar y restaurar internet durante la accion.
- Reintentar manualmente solo si la app lo permite.
- Confirmar que no se dupliquen pedido, archivo, historial ni notificacion.

### Recarga durante operacion

- Llenar Nuevo pedido.
- Recargar la pagina antes de crearlo.
- Confirmar que aparece el modal de pedido incompleto.
- Continuar y verificar que los datos se recuperan.

### Backend apagado

- Detener el backend y mantener internet activo.
- Intentar login, abrir Pedidos y Reportes.
- Confirmar mensaje de servidor apagado o inaccesible.
- Confirmar que los datos visibles previos no desaparecen si una recarga falla.

### Timeout

- Simular respuesta lenta o usar red muy degradada.
- Intentar login, listar pedidos y subir comprobante.
- Confirmar mensaje de timeout.
- Confirmar que el operador puede reintentar manualmente.

### Token vencido

- Invalidar token local o usar un token expirado.
- Recargar vista protegida.
- Confirmar salida controlada y mensaje de sesion vencida.

### Archivo grande

- Intentar subir un archivo mayor al limite configurado.
- Confirmar mensaje de archivo muy grande.
- Confirmar que no se crea registro duplicado de archivo.

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
| 2026-06-30 | cambios locales | Chromium headless/CDP local: Slow 3G, modo avion simulado, recarga offline y reconexion | OK automatizado: PWA cacheada, sesion autenticada precargada, vistas Inicio/Pedidos/Reportes/Perfil cargan en red lenta sin POST/PATCH/PUT/DELETE inesperados, modo avion muestra "Sin conexion", recarga offline conserva shell y sesion cacheada, reconexion recupera navegacion | Repetir en telefono/red real y cubrir cortes durante crear pedido/subir comprobante/acciones criticas |
| 2026-06-29 | 4b4799b + cambios locales | Revision automatizada local | Parcial: build PWA OK, pycompile backend OK, service worker con cache/offline shell, acciones criticas bloqueadas sin conexion, borradores locales, dedupe de mutaciones/uploads/notificaciones e intervalos adaptados por red presentes en codigo | Ejecutar prueba manual real en navegador/dispositivo: Slow 3G, cortes intermitentes, modo avion, recarga durante operacion, backend apagado, timeout, token vencido y archivo grande |
