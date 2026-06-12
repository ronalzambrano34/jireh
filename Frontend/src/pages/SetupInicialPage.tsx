import { useEffect, useMemo, useState } from 'react';
import { Banknote, Check, ChevronRight, MapPin, Package, Percent, Settings2 } from 'lucide-react';
import {
  crearCuentaMetodoPago,
  crearMetodoPago,
  crearOferta,
  crearPaqueteSaldo,
  crearPuntoRecogida,
  guardarConfiguracion,
  listarMetodosPago,
  listarProvinciasServicio,
  obtenerEstadoConfiguracionInicial,
} from '../api/client';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { FloatingSelect } from '../components/FloatingSelect';
import { PageLoader } from '../components/PageLoader';
import type { ConfiguracionInicialEstado, MetodoPago, ProvinciaServicio } from '../types/api';
import { banderaMoneda, nombreMoneda } from '../utils/monedas';

const monedas = ['BRL', 'UYU', 'USD', 'EUR'];

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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  const [saldo, setSaldo] = useState({
    nombre: '',
    monto_pago: '',
    moneda: 'BRL',
    saldo_cup: '',
  });

  async function cargar() {
    setError(null);
    const [estadoData, metodosData, provinciasData] = await Promise.all([
      obtenerEstadoConfiguracionInicial(),
      listarMetodosPago(undefined, true),
      listarProvinciasServicio(true),
    ]);
    const activos = metodosData.filter((item) => item.activo);
    setEstado(estadoData);
    setMetodos(activos);
    setProvincias(provinciasData.filter((item) => item.activo));
    setPago((current) => ({
      ...current,
      metodo_id: current.metodo_id || (activos[0] ? String(activos[0].id) : ''),
      moneda: activos[0]?.moneda ?? current.moneda,
      nombre_metodo: activos[0]?.nombre ?? current.nombre_metodo,
    }));
    setPunto((current) => ({
      ...current,
      provincia_id: current.provincia_id || (provinciasData.find((item) => item.activo) ? String(provinciasData.find((item) => item.activo)?.id) : ''),
    }));
  }

  useEffect(() => {
    cargar().catch((err) => setError(err instanceof Error ? err.message : 'No se pudo revisar la configuracion'));
  }, []);

  const pasos = useMemo(() => [
    { titulo: 'Cobros', detalle: 'Metodo y cuenta donde paga el cliente', icon: Banknote, listo: Boolean(estado?.cuentas) },
    { titulo: 'Tasas', detalle: 'Transferencia y efectivo', icon: Percent, listo: Boolean(estado?.ofertas) },
    { titulo: 'Efectivo', detalle: 'Punto de recogida', icon: MapPin, listo: Boolean(estado?.puntos) },
    { titulo: 'Saldo', detalle: 'Paquete de recarga', icon: Package, listo: Boolean(estado?.paquetes) },
  ], [estado]);

  const metodoSeleccionado = metodos.find((item) => String(item.id) === pago.metodo_id);
  const pagoEnEfectivo = esMetodoEfectivo(metodoSeleccionado?.nombre ?? pago.nombre_metodo);

  async function guardarCobro() {
    if (!pagoEnEfectivo && (!pago.cuenta.trim() || !pago.titular.trim())) {
      setError('Completa la cuenta y el titular');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let metodoId = Number(pago.metodo_id);
      if (!metodoId) {
        const metodo = await crearMetodoPago({
          nombre: pago.nombre_metodo.trim(),
          moneda: pago.moneda,
        });
        metodoId = metodo.id;
      }
      if (!pagoEnEfectivo) {
        await crearCuentaMetodoPago(metodoId, {
          alias: pago.alias.trim() || 'Cuenta principal',
          cuenta: pago.cuenta.trim(),
          titular: pago.titular.trim(),
          predeterminada: true,
          activa: true,
        });
      }
      await cargar();
      setNotice(pagoEnEfectivo ? 'Metodo de pago en efectivo guardado' : 'Cuenta de cobro guardada');
      setPaso(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la cuenta');
    } finally {
      setSaving(false);
    }
  }

  async function guardarTasas() {
    const transferencia = Number(tasas.transferencia);
    const efectivo = Number(tasas.efectivo);
    if (!(transferencia > 0) && !(efectivo > 0)) {
      setError('Escribe al menos una tasa para continuar');
      return;
    }
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
      setPaso(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las tasas');
    } finally {
      setSaving(false);
    }
  }

  async function guardarPunto() {
    if (!punto.nombre.trim() || !punto.direccion.trim()) {
      setError('Completa nombre y direccion del punto');
      return;
    }
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
      setPaso(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el punto');
    } finally {
      setSaving(false);
    }
  }

  async function guardarSaldo() {
    if (!saldo.nombre.trim() || !(Number(saldo.monto_pago) > 0) || !(Number(saldo.saldo_cup) > 0)) {
      setError('Completa el nombre y los montos del paquete');
      return;
    }
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
      setSaving(false);
    }
  }

  async function finalizar() {
    if (!estado?.cuentas) {
      setPaso(0);
      setError('Configura al menos una cuenta de cobro antes de finalizar');
      return;
    }
    setSaving(true);
    try {
      await guardarConfiguracion({ clave: 'setup_inicial_completado', valor: 'true' });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo finalizar la configuracion');
    } finally {
      setSaving(false);
    }
  }

  if (!estado) return <PageLoader label="Revisando configuracion inicial" />;

  return (
    <section className="setup-page">
      <header className="setup-hero">
        <span><Settings2 size={26} /></span>
        <div>
          <small>Primer inicio</small>
          <h2>Preparemos el sistema para recibir pedidos</h2>
          <p>Completa lo que utiliza tu negocio. Puedes volver y cambiarlo desde Administracion.</p>
        </div>
      </header>

      <div className="setup-layout">
        <nav className="setup-steps" aria-label="Pasos de configuracion">
          {pasos.map((item, index) => {
            const Icon = item.icon;
            return (
              <button key={item.titulo} type="button" className={paso === index ? 'active' : ''} onClick={() => { setPaso(index); setError(null); setNotice(null); }}>
                <span className={item.listo ? 'setup-step-icon done' : 'setup-step-icon'}>{item.listo ? <Check size={18} /> : <Icon size={18} />}</span>
                <span><strong>{item.titulo}</strong><small>{item.detalle}</small></span>
                <ChevronRight size={17} />
              </button>
            );
          })}
        </nav>

        <div className="setup-card">
          {error && <DismissibleNotice className="notice error" role="alert" onDismiss={() => setError(null)}>{error}</DismissibleNotice>}
          {notice && <DismissibleNotice className="notice" onDismiss={() => setNotice(null)}>{notice}</DismissibleNotice>}

          {paso === 0 && (
            <>
              <header><h3>Metodo y cuenta de cobro</h3><p>Estos datos aparecen en las instrucciones de pago enviadas al cliente.</p></header>
              <div className="form-grid">
                {metodos.length > 0 ? (
                  <label className="wide">Metodo existente
                    <FloatingSelect value={pago.metodo_id} onChange={(value) => { const metodo = metodos.find((item) => String(item.id) === value); setPago((current) => ({ ...current, metodo_id: value, moneda: metodo?.moneda ?? current.moneda })); }} options={metodos.map((item) => ({ value: String(item.id), label: item.nombre, description: item.moneda, icon: <Banknote size={18} /> }))} align="left" />
                  </label>
                ) : (
                  <>
                    <label>Nombre del metodo<input value={pago.nombre_metodo} onChange={(event) => setPago((current) => ({ ...current, nombre_metodo: event.target.value }))} placeholder="Pix, Brou, efectivo..." /></label>
                    <label>Moneda<FloatingSelect value={pago.moneda} onChange={(value) => setPago((current) => ({ ...current, moneda: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda, description: nombreMoneda(moneda), icon: banderaMoneda(moneda) }))} align="left" /></label>
                  </>
                )}
                {!pagoEnEfectivo && (
                  <>
                    <label>Alias<input value={pago.alias} onChange={(event) => setPago((current) => ({ ...current, alias: event.target.value }))} placeholder="Cuenta principal" /></label>
                    <label>Cuenta o llave<input value={pago.cuenta} onChange={(event) => setPago((current) => ({ ...current, cuenta: event.target.value }))} placeholder="Numero, email o llave Pix" /></label>
                    <label className="wide">Titular<input value={pago.titular} onChange={(event) => setPago((current) => ({ ...current, titular: event.target.value }))} placeholder="Nombre del titular" /></label>
                  </>
                )}
              </div>
              <button className="primary-button" type="button" onClick={() => void guardarCobro()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar y continuar'}</button>
            </>
          )}

          {paso === 1 && (
            <>
              <header><h3>Tasas iniciales</h3><p>Escribe las tasas de los servicios que ofrecerás. Puedes dejar uno vacío.</p></header>
              <div className="form-grid">
                <label className="wide">Moneda de pago<FloatingSelect value={tasas.moneda} onChange={(value) => setTasas((current) => ({ ...current, moneda: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda, description: nombreMoneda(moneda), icon: banderaMoneda(moneda) }))} align="left" /></label>
                <label>Tasa transferencia<input value={tasas.transferencia} onChange={(event) => setTasas((current) => ({ ...current, transferencia: event.target.value }))} inputMode="decimal" placeholder="Ej. 118" /></label>
                <label>Tasa efectivo<input value={tasas.efectivo} onChange={(event) => setTasas((current) => ({ ...current, efectivo: event.target.value }))} inputMode="decimal" placeholder="Ej. 117" /></label>
                <label className="wide">Pago minimo<input value={tasas.minimo} onChange={(event) => setTasas((current) => ({ ...current, minimo: event.target.value }))} inputMode="decimal" /></label>
              </div>
              <div className="setup-actions"><button className="ghost-button" type="button" onClick={() => setPaso(2)}>Configurar despues</button><button className="primary-button" type="button" onClick={() => void guardarTasas()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar tasas'}</button></div>
            </>
          )}

          {paso === 2 && (
            <>
              <header><h3>Entrega de efectivo</h3><p>Agrega el lugar donde el destinatario recogerá el efectivo.</p></header>
              <div className="form-grid">
                <label>Nombre<input value={punto.nombre} onChange={(event) => setPunto((current) => ({ ...current, nombre: event.target.value }))} placeholder="Punto Centro" /></label>
                <label>Provincia<FloatingSelect value={punto.provincia_id} onChange={(value) => setPunto((current) => ({ ...current, provincia_id: value }))} options={[{ value: '', label: 'Sin provincia' }, ...provincias.map((item) => ({ value: String(item.id), label: item.nombre, icon: <MapPin size={18} /> }))]} align="left" /></label>
                <label className="wide">Direccion<input value={punto.direccion} onChange={(event) => setPunto((current) => ({ ...current, direccion: event.target.value }))} placeholder="Direccion e indicaciones" /></label>
                <label className="wide">Telefono opcional<input value={punto.telefono} onChange={(event) => setPunto((current) => ({ ...current, telefono: event.target.value }))} inputMode="tel" /></label>
              </div>
              <div className="setup-actions"><button className="ghost-button" type="button" onClick={() => setPaso(3)}>No uso efectivo ahora</button><button className="primary-button" type="button" onClick={() => void guardarPunto()} disabled={saving}>Guardar punto</button></div>
            </>
          )}

          {paso === 3 && (
            <>
              <header><h3>Paquete de saldo</h3><p>Opcional. Define cuánto paga el cliente y cuánto saldo recibe.</p></header>
              <div className="form-grid">
                <label className="wide">Nombre<input value={saldo.nombre} onChange={(event) => setSaldo((current) => ({ ...current, nombre: event.target.value }))} placeholder="Recarga 1000 CUP" /></label>
                <label>Monto pago<input value={saldo.monto_pago} onChange={(event) => setSaldo((current) => ({ ...current, monto_pago: event.target.value }))} inputMode="decimal" /></label>
                <label>Moneda<FloatingSelect value={saldo.moneda} onChange={(value) => setSaldo((current) => ({ ...current, moneda: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda, description: nombreMoneda(moneda), icon: banderaMoneda(moneda) }))} align="left" /></label>
                <label className="wide">Saldo CUP<input value={saldo.saldo_cup} onChange={(event) => setSaldo((current) => ({ ...current, saldo_cup: event.target.value }))} inputMode="numeric" /></label>
              </div>
              <div className="setup-actions"><button className="ghost-button" type="button" onClick={() => void finalizar()} disabled={saving}>Finalizar sin saldo</button><button className="primary-button" type="button" onClick={() => void guardarSaldo()} disabled={saving}>Guardar paquete</button></div>
            </>
          )}
        </div>
      </div>

      <footer className="setup-footer">
        <button className="ghost-button" type="button" onClick={onOpenAdmin}>Abrir administracion avanzada</button>
        <button className="primary-button" type="button" onClick={() => void finalizar()} disabled={saving || !estado.cuentas}>Finalizar configuracion</button>
      </footer>
    </section>
  );
}
