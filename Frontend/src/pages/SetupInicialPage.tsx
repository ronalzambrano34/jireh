import { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Coins, CreditCard, MapPin, Package, Percent, UserPlus } from 'lucide-react';
import {
  crearCuentaMetodoPago,
  crearMetodoPago,
  crearOperador,
  crearOferta,
  crearPaqueteSaldo,
  crearProvinciaServicio,
  crearPuntoRecogida,
  guardarConfiguracion,
} from '../api/client';
import {
  listarMetodosPagoDedup,
  listarProvinciasServicioDedup,
  obtenerEstadoConfiguracionInicialDedup,
} from '../api/dedupedReads';
import { FloatingToast } from '../components/FloatingToast';
import { FloatingSelect } from '../components/FloatingSelect';
import { PageLoader } from '../components/PageLoader';
import { PasswordField } from '../components/PasswordField';
import { PhoneInput } from '../components/PhoneInput';
import { useCatalogoMonedasPago } from '../hooks/useMonedasPago';
import { isAbortError, useAbortableEffect } from '../hooks/useAbortableEffect';
import type { ConfiguracionInicialEstado, MetodoPago, ProvinciaServicio } from '../types/api';
import { MONEDAS_PAGO_CONFIG_KEY, banderaAutomaticaMoneda, banderaMoneda, guardarCatalogoMonedasPagoLocal, monedasPagoActivas, nombreMoneda, normalizarCatalogoMonedasPago, normalizarMoneda, type MonedaPagoConfig } from '../utils/monedas';
import { SetupActions, SetupCardHeader, SetupHero, SetupSteps, type SetupStep } from './setup/SetupLayout';
import './setup/SetupInicialPage.css';

const permisosPorRol: Record<string, string[]> = {
  consultor: ['pedidos:ver', 'clientes:ver', 'contactos:ver'],
  operador: ['pedidos:ver', 'pedidos:crear', 'pedidos:gestionar', 'clientes:ver', 'clientes:crear', 'clientes:gestionar', 'contactos:ver', 'contactos:gestionar', 'reportes:ver'],
  admin: ['pedidos:ver', 'clientes:ver', 'contactos:ver', 'operadores:ver', 'operadores:crear', 'operadores:editar', 'operadores:desactivar', 'reportes:ver', 'empresa:control_total', 'pedidos:gestionar', 'clientes:gestionar', 'configuracion:gestionar'],
};

function esMetodoEfectivo(nombre: string) {
  return nombre.trim().toLowerCase() === 'efectivo';
}

export function SetupInicialPage({
  onComplete,
  onOpenAdmin,
}: {
  onComplete: () => void;
  onOpenAdmin: () => void;
}) {
  const [estado, setEstado] = useState<ConfiguracionInicialEstado | null>(null);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [provincias, setProvincias] = useState<ProvinciaServicio[]>([]);
  const [paso, setPaso] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [provincia, setProvincia] = useState({
    nombre: '',
  });
  const [pago, setPago] = useState({
    metodo_id: '',
    nombre_metodo: 'Pix',
    moneda: 'BRL',
    alias: 'Cuenta principal',
    cuenta: '',
    titular: '',
  });
  const [tasas, setTasas] = useState({
    moneda: 'BRL',
    transferencia: '',
    efectivo: '',
    minimo: '0',
  });
  const [punto, setPunto] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    provincia_id: '',
  });
  const [operador, setOperador] = useState({
    nombre: '',
    telefono: '',
    password: '',
    rol: 'operador',
  });
  const [saldo, setSaldo] = useState({
    nombre: '',
    monto_pago: '',
    moneda: 'BRL',
    saldo_cup: '',
  });
  const [nuevaMoneda, setNuevaMoneda] = useState({ codigo: '', nombre: '', simbolo: '' });
  const catalogoMonedas = useCatalogoMonedasPago();
  const [catalogoMonedasSetup, setCatalogoMonedasSetup] = useState<MonedaPagoConfig[]>(catalogoMonedas);
  const monedas = useMemo(() => monedasPagoActivas(catalogoMonedasSetup), [catalogoMonedasSetup]);

  useEffect(() => {
    setCatalogoMonedasSetup(catalogoMonedas);
  }, [catalogoMonedas]);

  useEffect(() => {
    const monedaDefault = monedas[0];
    if (!monedaDefault) return;
    if (!monedas.includes(pago.moneda)) setPago((current) => ({ ...current, moneda: monedaDefault }));
    if (!monedas.includes(tasas.moneda)) setTasas((current) => ({ ...current, moneda: monedaDefault }));
    if (!monedas.includes(saldo.moneda)) setSaldo((current) => ({ ...current, moneda: monedaDefault }));
  }, [monedas, pago.moneda, saldo.moneda, tasas.moneda]);

  async function cargar(signal?: AbortSignal) {
    setError(null);
    const [estadoData, metodosData, provinciasData] = await Promise.all([
      obtenerEstadoConfiguracionInicialDedup({ signal }),
      listarMetodosPagoDedup(undefined, true, { signal }),
      listarProvinciasServicioDedup(true, { signal }),
    ]);
    const activos = metodosData.filter((item) => item.activo);
    setEstado(estadoData);
    setMetodos(activos);
    const provinciasActivas = provinciasData.filter((item) => item.activo);
    setProvincias(provinciasActivas);
    setPago((current) => ({
      ...current,
      metodo_id: current.metodo_id || (activos[0] ? String(activos[0].id) : ''),
      moneda: current.metodo_id ? current.moneda : activos[0]?.moneda ?? current.moneda,
      nombre_metodo: current.metodo_id ? current.nombre_metodo : activos[0]?.nombre ?? current.nombre_metodo,
    }));
    setPunto((current) => ({
      ...current,
      provincia_id: current.provincia_id || (provinciasActivas[0] ? String(provinciasActivas[0].id) : ''),
    }));
  }

  useAbortableEffect((signal) => {
    cargar(signal).catch((err) => {
      if (!isAbortError(err)) setError(err instanceof Error ? err.message : 'No se pudo revisar la configuracion');
    });
  }, []);

  const pasos = useMemo<SetupStep[]>(() => [
    { titulo: 'Provincias', detalle: 'Zonas donde operas', icon: MapPin, listo: Boolean(estado?.provincias) },
    { titulo: 'Puntos', detalle: 'Puntos de recogida', icon: MapPin, listo: Boolean(estado?.puntos) },
    { titulo: 'Monedas', detalle: 'Monedas de pago', icon: Coins, listo: Boolean(estado?.monedas) },
    { titulo: 'Metodos', detalle: 'Monedas y formas de pago', icon: Banknote, listo: Boolean(estado?.metodos) },
    { titulo: 'Cuentas', detalle: 'Datos para cobrar', icon: CreditCard, listo: Boolean(estado?.cuentas) },
    { titulo: 'Operadores', detalle: 'Usuarios del sistema', icon: UserPlus, listo: Boolean(estado?.operadores) },
    { titulo: 'Tasas', detalle: 'Transferencia y efectivo', icon: Percent, listo: Boolean(estado?.ofertas) },
    { titulo: 'Saldo', detalle: 'Paquete de recarga', icon: Package, listo: Boolean(estado?.paquetes) },
  ], [estado]);

  const metodoSeleccionado = metodos.find((item) => String(item.id) === pago.metodo_id);
  const pagoEnEfectivo = esMetodoEfectivo(metodoSeleccionado?.nombre ?? pago.nombre_metodo);
  const opcionesRolOperador = [
    { value: 'consultor', label: 'Consultor' },
    { value: 'operador', label: 'Operador' },
    { value: 'admin', label: 'Admin' },
  ];
  const setupRequeridoCompleto = Boolean(estado?.provincias && estado?.puntos && estado?.monedas && estado?.metodos && estado?.cuentas && estado?.operadores);

  async function guardarProvincia() {
    if (savingRef.current) return;
    if (!provincia.nombre.trim()) {
      setError('Escribe el nombre de la provincia');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const creada = await crearProvinciaServicio({
        nombre: provincia.nombre.trim(),
        activo: true,
      });
      setProvincia({ nombre: '' });
      setPunto((current) => ({ ...current, provincia_id: String(creada.id) }));
      await cargar();
      setNotice('Provincia guardada');
      setPaso(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la provincia');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function guardarMetodoPago() {
    if (savingRef.current) return;
    if (!pago.nombre_metodo.trim()) {
      setError('Escribe el nombre del metodo de pago');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const metodo = await crearMetodoPago({
        nombre: pago.nombre_metodo.trim(),
        moneda: pago.moneda,
      });
      setPago((current) => ({
        ...current,
        metodo_id: String(metodo.id),
        nombre_metodo: metodo.nombre,
        moneda: metodo.moneda,
      }));
      await cargar();
      setNotice('Metodo de pago guardado');
      setPaso(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el metodo');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function guardarCuentaPago() {
    if (savingRef.current) return;
    const metodoId = Number(pago.metodo_id);
    if (!metodoId) {
      setError('Selecciona o crea un metodo de pago');
      return;
    }
    if (pagoEnEfectivo) {
      setError('El metodo efectivo no usa cuenta. Selecciona otro metodo de pago');
      return;
    }
    if (!pagoEnEfectivo && (!pago.cuenta.trim() || !pago.titular.trim())) {
      setError('Completa la cuenta y el titular');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await crearCuentaMetodoPago(metodoId, {
        alias: pago.alias.trim() || 'Cuenta principal',
        cuenta: pago.cuenta.trim(),
        titular: pago.titular.trim(),
        predeterminada: true,
        activa: true,
      });
      await cargar();
      setPago((current) => ({ ...current, alias: 'Cuenta principal', cuenta: '', titular: '' }));
      setNotice('Cuenta de pago guardada');
      setPaso(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la cuenta');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function guardarTasas() {
    if (savingRef.current) return;
    const transferencia = Number(tasas.transferencia);
    const efectivo = Number(tasas.efectivo);
    if (!(transferencia > 0) && !(efectivo > 0)) {
      setError('Escribe al menos una tasa para continuar');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const minimo = Math.max(0, Number(tasas.minimo) || 0);
      const tareas = [];
      if (transferencia > 0) tareas.push(crearOferta({ servicio: 'transferencia', nombre: `Transferencia ${tasas.moneda}`, tasa: transferencia, minimo_pago: minimo, moneda_pago: tasas.moneda }));
      if (efectivo > 0) tareas.push(crearOferta({ servicio: 'efectivo', nombre: `Efectivo ${tasas.moneda}`, tasa: efectivo, minimo_pago: minimo, moneda_pago: tasas.moneda }));
      await Promise.all(tareas);
      await cargar();
      setNotice('Tasas guardadas');
      setPaso(7);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las tasas');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function guardarPunto() {
    if (savingRef.current) return;
    if (!punto.provincia_id) {
      setError('Selecciona una provincia para el punto');
      return;
    }
    if (!punto.nombre.trim() || !punto.direccion.trim()) {
      setError('Completa nombre y direccion del punto');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await crearPuntoRecogida({
        nombre: punto.nombre.trim(),
        direccion: punto.direccion.trim(),
        telefono: punto.telefono.trim() || undefined,
        provincia_id: punto.provincia_id ? Number(punto.provincia_id) : null,
      });
      await cargar();
      setNotice('Punto de recogida guardado');
      setPaso(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el punto');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function toggleMonedaPago(codigo: string) {
    setCatalogoMonedasSetup((current) => {
      const next = current.map((item) => (item.codigo === codigo ? { ...item, activa: !item.activa } : item));
      return next.some((item) => item.activa) ? next : current;
    });
  }

  function agregarMonedaPago() {
    const codigo = normalizarMoneda(nuevaMoneda.codigo);
    if (!codigo) {
      setError('El codigo de moneda es obligatorio');
      return;
    }
    setCatalogoMonedasSetup((current) => {
      if (current.some((item) => item.codigo === codigo)) return current.map((item) => (item.codigo === codigo ? { ...item, activa: true } : item));
      return normalizarCatalogoMonedasPago([
        ...current,
        {
          codigo,
          nombre: nuevaMoneda.nombre.trim() || nombreMoneda(codigo) || codigo,
          simbolo: nuevaMoneda.simbolo.trim() || undefined,
          bandera: banderaAutomaticaMoneda(codigo),
          activa: true,
        },
      ]);
    });
    setNuevaMoneda({ codigo: '', nombre: '', simbolo: '' });
    setError(null);
  }

  async function guardarMonedasPago() {
    if (savingRef.current) return;
    const normalizado = normalizarCatalogoMonedasPago(catalogoMonedasSetup);
    if (!normalizado.some((item) => item.activa)) {
      setError('Debe quedar al menos una moneda activa');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await guardarConfiguracion({
        clave: MONEDAS_PAGO_CONFIG_KEY,
        valor: JSON.stringify(normalizado),
      });
      const catalogoGuardado = guardarCatalogoMonedasPagoLocal(normalizado);
      setCatalogoMonedasSetup(catalogoGuardado);
      await cargar();
      setNotice('Monedas de pago guardadas');
      setPaso(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las monedas');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function guardarOperador() {
    if (savingRef.current) return;
    if (!operador.nombre.trim() || !operador.telefono.trim() || !operador.password.trim()) {
      setError('Completa nombre, telefono y contraseña del operador');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await crearOperador({
        nombre: operador.nombre.trim(),
        telefono: operador.telefono.trim(),
        password: operador.password.trim(),
        rol: operador.rol,
        permisos: permisosPorRol[operador.rol] ?? permisosPorRol.operador,
      });
      setOperador({ nombre: '', telefono: '', password: '', rol: 'operador' });
      await cargar();
      setNotice('Operador guardado');
      setPaso(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el operador');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function guardarSaldo() {
    if (savingRef.current) return;
    if (!saldo.nombre.trim() || !(Number(saldo.monto_pago) > 0) || !(Number(saldo.saldo_cup) > 0)) {
      setError('Completa el nombre y los montos del paquete');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await crearPaqueteSaldo({
        nombre: saldo.nombre.trim(),
        monto_pago: Number(saldo.monto_pago),
        moneda_pago: saldo.moneda,
        saldo_cup: Number(saldo.saldo_cup),
      });
      await cargar();
      setNotice('Paquete de saldo guardado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el paquete');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function finalizar() {
    if (savingRef.current) return;
    if (!estado?.provincias) {
      setPaso(0);
      setError('Configura al menos una provincia antes de finalizar');
      return;
    }
    if (!estado?.puntos) {
      setPaso(1);
      setError('Configura al menos un punto de recogida antes de finalizar');
      return;
    }
    if (!estado?.monedas) {
      setPaso(2);
      setError('Configura al menos una moneda de pago antes de finalizar');
      return;
    }
    if (!estado?.metodos) {
      setPaso(3);
      setError('Configura al menos un metodo de pago antes de finalizar');
      return;
    }
    if (!estado?.cuentas) {
      setPaso(4);
      setError('Configura al menos una cuenta de cobro antes de finalizar');
      return;
    }
    if (!estado?.operadores) {
      setPaso(5);
      setError('Configura al menos un operador antes de finalizar');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await guardarConfiguracion({ clave: 'setup_inicial_completado', valor: 'true' });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo finalizar la configuracion');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!estado) return <PageLoader label="Revisando configuracion inicial" />;

  return (
    <section className="setup-page app-page-width">
      <SetupHero />

      <div className="setup-layout">
        <SetupSteps steps={pasos} active={paso} onChange={(index) => { setPaso(index); setError(null); setNotice(null); }} />

        <div className="setup-card">
          {error && <FloatingToast onDismiss={() => setError(null)}>{error}</FloatingToast>}
          {notice && <FloatingToast kind="success" onDismiss={() => setNotice(null)}>{notice}</FloatingToast>}

          {paso === 0 && (
            <>
              <SetupCardHeader title="Provincias" description="Agrega las provincias o zonas donde se entregara efectivo." />
              <div className="form-grid">
                <label className="wide">Nombre de provincia<input value={provincia.nombre} onChange={(event) => setProvincia({ nombre: event.target.value })} placeholder="La Habana" /></label>
              </div>
              <SetupActions secondary={estado.provincias ? <button className="ghost-button" type="button" onClick={() => setPaso(1)}>Continuar</button> : undefined} primary={<button className="primary-button" type="button" onClick={() => void guardarProvincia()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar provincia'}</button>} />
            </>
          )}

          {paso === 1 && (
            <>
              <SetupCardHeader title="Puntos de recogida" description="Agrega el lugar donde el destinatario recogera el efectivo." />
              <div className="form-grid">
                <label>Nombre<input value={punto.nombre} onChange={(event) => setPunto((current) => ({ ...current, nombre: event.target.value }))} placeholder="Punto Centro" /></label>
                <label>Provincia<FloatingSelect value={punto.provincia_id} onChange={(value) => setPunto((current) => ({ ...current, provincia_id: value }))} options={[{ value: '', label: provincias.length ? 'Selecciona provincia' : 'Primero crea una provincia' }, ...provincias.map((item) => ({ value: String(item.id), label: item.nombre, icon: <MapPin size={18} /> }))]} align="left" /></label>
                <label className="wide">Direccion<input value={punto.direccion} onChange={(event) => setPunto((current) => ({ ...current, direccion: event.target.value }))} placeholder="Direccion e indicaciones" /></label>
                <label className="wide">Telefono opcional<PhoneInput value={punto.telefono} onChange={(value) => setPunto((current) => ({ ...current, telefono: value }))} defaultCode="+53" pasteTitle="Pegar telefono del punto" /></label>
              </div>
              <SetupActions secondary={estado.puntos ? <button className="ghost-button" type="button" onClick={() => setPaso(2)}>Continuar</button> : undefined} primary={<button className="primary-button" type="button" onClick={() => void guardarPunto()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar punto'}</button>} />
            </>
          )}

          {paso === 2 && (
            <>
              <SetupCardHeader title="Monedas de pago" description="Selecciona las monedas que estaran disponibles para operar." />
              <div className="setup-currency-grid">
                {catalogoMonedasSetup.map((moneda) => (
                  <button className={moneda.activa ? 'setup-currency active' : 'setup-currency'} type="button" key={moneda.codigo} onClick={() => toggleMonedaPago(moneda.codigo)}>
                    <span>{moneda.bandera || banderaMoneda(moneda.codigo)}</span>
                    <strong>{moneda.codigo}</strong>
                    <small>{moneda.nombre || nombreMoneda(moneda.codigo)}</small>
                  </button>
                ))}
              </div>
              <div className="setup-currency-create">
                <input value={nuevaMoneda.codigo} onChange={(event) => setNuevaMoneda((current) => ({ ...current, codigo: event.target.value.toUpperCase() }))} placeholder="Codigo USD" />
                <input value={nuevaMoneda.nombre} onChange={(event) => setNuevaMoneda((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre Dolar estadounidense" />
                <input value={nuevaMoneda.simbolo} onChange={(event) => setNuevaMoneda((current) => ({ ...current, simbolo: event.target.value }))} placeholder="Simbolo $" />
                <button className="ghost-button" type="button" onClick={agregarMonedaPago}>Agregar moneda</button>
              </div>
              <SetupActions secondary={estado.monedas ? <button className="ghost-button" type="button" onClick={() => setPaso(3)}>Continuar</button> : undefined} primary={<button className="primary-button" type="button" onClick={() => void guardarMonedasPago()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar monedas'}</button>} />
            </>
          )}

          {paso === 3 && (
            <>
              <SetupCardHeader title="Metodos de pago" description="Crea la forma de pago y la moneda que usara el cliente." />
              <div className="form-grid">
                <label>Nombre del metodo<input value={pago.nombre_metodo} onChange={(event) => setPago((current) => ({ ...current, nombre_metodo: event.target.value }))} placeholder="Pix, Brou, efectivo..." /></label>
                <label>Moneda<FloatingSelect value={pago.moneda} onChange={(value) => setPago((current) => ({ ...current, moneda: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda, description: nombreMoneda(moneda), icon: banderaMoneda(moneda) }))} align="left" /></label>
              </div>
              <SetupActions secondary={estado.metodos ? <button className="ghost-button" type="button" onClick={() => setPaso(4)}>Continuar</button> : undefined} primary={<button className="primary-button" type="button" onClick={() => void guardarMetodoPago()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar metodo'}</button>} />
            </>
          )}

          {paso === 4 && (
            <>
              <SetupCardHeader title="Cuenta de pago" description="Estos datos aparecen en las instrucciones de pago enviadas al cliente." />
              <div className="form-grid">
                <label className="wide">Metodo de pago
                  <FloatingSelect value={pago.metodo_id} onChange={(value) => { const metodo = metodos.find((item) => String(item.id) === value); setPago((current) => ({ ...current, metodo_id: value, moneda: metodo?.moneda ?? current.moneda, nombre_metodo: metodo?.nombre ?? current.nombre_metodo })); }} options={[{ value: '', label: metodos.length ? 'Selecciona metodo' : 'Primero crea un metodo' }, ...metodos.map((item) => ({ value: String(item.id), label: item.nombre, description: item.moneda, icon: <Banknote size={18} /> }))]} align="left" />
                </label>
                {!pagoEnEfectivo && (
                  <>
                    <label>Alias<input value={pago.alias} onChange={(event) => setPago((current) => ({ ...current, alias: event.target.value }))} placeholder="Cuenta principal" /></label>
                    <label>Cuenta o llave<input value={pago.cuenta} onChange={(event) => setPago((current) => ({ ...current, cuenta: event.target.value }))} placeholder="Numero, email o llave Pix" /></label>
                    <label className="wide">Titular<input value={pago.titular} onChange={(event) => setPago((current) => ({ ...current, titular: event.target.value }))} placeholder="Nombre del titular" /></label>
                  </>
                )}
              </div>
              <SetupActions secondary={estado.cuentas ? <button className="ghost-button" type="button" onClick={() => setPaso(5)}>Continuar</button> : undefined} primary={<button className="primary-button" type="button" onClick={() => void guardarCuentaPago()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cuenta'}</button>} />
            </>
          )}

          {paso === 5 && (
            <>
              <SetupCardHeader title="Operadores" description="Crea los usuarios que podran trabajar dentro del sistema." />
              <div className="form-grid">
                <label>Nombre<input value={operador.nombre} onChange={(event) => setOperador((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre del operador" /></label>
                <label>Telefono<PhoneInput value={operador.telefono} onChange={(value) => setOperador((current) => ({ ...current, telefono: value }))} defaultCode="+55" required pasteTitle="Pegar telefono de acceso" /></label>
                <label>Contraseña<PasswordField value={operador.password} onChange={(event) => setOperador((current) => ({ ...current, password: event.target.value }))} placeholder="Contraseña inicial" autoComplete="new-password" required /></label>
                <label>Rol<FloatingSelect value={operador.rol} onChange={(value) => setOperador((current) => ({ ...current, rol: value }))} options={opcionesRolOperador} align="left" /></label>
              </div>
              <SetupActions secondary={estado.operadores ? <button className="ghost-button" type="button" onClick={() => setPaso(6)}>Continuar</button> : undefined} primary={<button className="primary-button" type="button" onClick={() => void guardarOperador()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar operador'}</button>} />
            </>
          )}

          {paso === 6 && (
            <>
              <SetupCardHeader title="Tasas iniciales" description="Escribe las tasas de los servicios que ofreceras. Puedes dejar uno vacio." />
              <div className="form-grid">
                <label className="wide">Moneda de pago<FloatingSelect value={tasas.moneda} onChange={(value) => setTasas((current) => ({ ...current, moneda: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda, description: nombreMoneda(moneda), icon: banderaMoneda(moneda) }))} align="left" /></label>
                <label>Tasa transferencia<input value={tasas.transferencia} onChange={(event) => setTasas((current) => ({ ...current, transferencia: event.target.value }))} inputMode="decimal" placeholder="Ej. 118" /></label>
                <label>Tasa efectivo<input value={tasas.efectivo} onChange={(event) => setTasas((current) => ({ ...current, efectivo: event.target.value }))} inputMode="decimal" placeholder="Ej. 117" /></label>
                <label className="wide">Pago minimo<input value={tasas.minimo} onChange={(event) => setTasas((current) => ({ ...current, minimo: event.target.value }))} inputMode="decimal" /></label>
              </div>
              <SetupActions secondary={<button className="ghost-button" type="button" onClick={() => setPaso(7)}>Configurar despues</button>} primary={<button className="primary-button" type="button" onClick={() => void guardarTasas()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar tasas'}</button>} />
            </>
          )}

          {paso === 7 && (
            <>
              <SetupCardHeader title="Paquete de saldo" description="Opcional. Define cuanto paga el cliente y cuanto saldo recibe." />
              <div className="form-grid">
                <label className="wide">Nombre<input value={saldo.nombre} onChange={(event) => setSaldo((current) => ({ ...current, nombre: event.target.value }))} placeholder="Recarga 1000 CUP" /></label>
                <label>Monto pago<input value={saldo.monto_pago} onChange={(event) => setSaldo((current) => ({ ...current, monto_pago: event.target.value }))} inputMode="decimal" /></label>
                <label>Moneda<FloatingSelect value={saldo.moneda} onChange={(value) => setSaldo((current) => ({ ...current, moneda: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda, description: nombreMoneda(moneda), icon: banderaMoneda(moneda) }))} align="left" /></label>
                <label className="wide">Saldo CUP<input value={saldo.saldo_cup} onChange={(event) => setSaldo((current) => ({ ...current, saldo_cup: event.target.value }))} inputMode="numeric" /></label>
              </div>
              <SetupActions secondary={<button className="ghost-button" type="button" onClick={() => void finalizar()} disabled={saving}>Finalizar sin saldo</button>} primary={<button className="primary-button" type="button" onClick={() => void guardarSaldo()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar paquete'}</button>} />
            </>
          )}
        </div>
      </div>

      <footer className="setup-footer">
        <button className="ghost-button" type="button" onClick={onOpenAdmin}>Abrir administracion avanzada</button>
        <button className="primary-button" type="button" onClick={() => void finalizar()} disabled={saving || !setupRequeridoCompleto}>Finalizar configuracion</button>
      </footer>
    </section>
  );
}
