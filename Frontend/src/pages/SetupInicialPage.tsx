import { useEffect, useMemo, useState } from 'react';
import { Banknote, MapPin, Package, Percent } from 'lucide-react';
import {
  crearCuentaMetodoPago,
  crearMetodoPago,
  crearOferta,
  crearPaqueteSaldo,
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
import { PhoneInput } from '../components/PhoneInput';
import { isAbortError, useAbortableEffect } from '../hooks/useAbortableEffect';
import type { ConfiguracionInicialEstado, MetodoPago, ProvinciaServicio } from '../types/api';
import { banderaMoneda, nombreMoneda } from '../utils/monedas';
import { SetupActions, SetupCardHeader, SetupHero, SetupSteps, type SetupStep } from './setup/SetupLayout';
import './setup/SetupInicialPage.css';

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

  useAbortableEffect((signal) => {
    cargar(signal).catch((err) => {
      if (!isAbortError(err)) setError(err instanceof Error ? err.message : 'No se pudo revisar la configuracion');
    });
  }, []);

  const pasos = useMemo<SetupStep[]>(() => [
    { titulo: 'Cobros', detalle: 'Metodo y cuenta donde paga el cliente', icon: Banknote, listo: Boolean(estado?.cuentas) },
    { titulo: 'Tasas', detalle: 'Transferencia y efectivo', icon: Percent, listo: Boolean(estado?.ofertas) },
    { titulo: 'Efectivo', detalle: 'Punto de recogida', icon: MapPin, listo: Boolean(estado?.puntos) },
    { titulo: 'Saldo', detalle: 'Paquete de recarga', icon: Package, listo: Boolean(estado?.paquetes) },
  ], [estado]);

  const metodoSeleccionado = metodos.find((item) => String(item.id) === pago.metodo_id);
  const pagoEnEfectivo = esMetodoEfectivo(metodoSeleccionado?.nombre ?? pago.nombre_metodo);

  async function guardarCobro() {
    if (saving) return;
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
    if (saving) return;
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
    if (saving) return;
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
    if (saving) return;
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
    if (saving) return;
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
    <section className="setup-page app-page-width">
      <SetupHero />

      <div className="setup-layout">
        <SetupSteps steps={pasos} active={paso} onChange={(index) => { setPaso(index); setError(null); setNotice(null); }} />

        <div className="setup-card">
          {error && <FloatingToast onDismiss={() => setError(null)}>{error}</FloatingToast>}
          {notice && <FloatingToast kind="success" onDismiss={() => setNotice(null)}>{notice}</FloatingToast>}

          {paso === 0 && (
            <>
              <SetupCardHeader title="Metodo y cuenta de cobro" description="Estos datos aparecen en las instrucciones de pago enviadas al cliente." />
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
              <SetupCardHeader title="Tasas iniciales" description="Escribe las tasas de los servicios que ofreceras. Puedes dejar uno vacio." />
              <div className="form-grid">
                <label className="wide">Moneda de pago<FloatingSelect value={tasas.moneda} onChange={(value) => setTasas((current) => ({ ...current, moneda: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda, description: nombreMoneda(moneda), icon: banderaMoneda(moneda) }))} align="left" /></label>
                <label>Tasa transferencia<input value={tasas.transferencia} onChange={(event) => setTasas((current) => ({ ...current, transferencia: event.target.value }))} inputMode="decimal" placeholder="Ej. 118" /></label>
                <label>Tasa efectivo<input value={tasas.efectivo} onChange={(event) => setTasas((current) => ({ ...current, efectivo: event.target.value }))} inputMode="decimal" placeholder="Ej. 117" /></label>
                <label className="wide">Pago minimo<input value={tasas.minimo} onChange={(event) => setTasas((current) => ({ ...current, minimo: event.target.value }))} inputMode="decimal" /></label>
              </div>
              <SetupActions secondary={<button className="ghost-button" type="button" onClick={() => setPaso(2)}>Configurar despues</button>} primary={<button className="primary-button" type="button" onClick={() => void guardarTasas()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar tasas'}</button>} />
            </>
          )}

          {paso === 2 && (
            <>
              <SetupCardHeader title="Entrega de efectivo" description="Agrega el lugar donde el destinatario recogera el efectivo." />
              <div className="form-grid">
                <label>Nombre<input value={punto.nombre} onChange={(event) => setPunto((current) => ({ ...current, nombre: event.target.value }))} placeholder="Punto Centro" /></label>
                <label>Provincia<FloatingSelect value={punto.provincia_id} onChange={(value) => setPunto((current) => ({ ...current, provincia_id: value }))} options={[{ value: '', label: 'Sin provincia' }, ...provincias.map((item) => ({ value: String(item.id), label: item.nombre, icon: <MapPin size={18} /> }))]} align="left" /></label>
                <label className="wide">Direccion<input value={punto.direccion} onChange={(event) => setPunto((current) => ({ ...current, direccion: event.target.value }))} placeholder="Direccion e indicaciones" /></label>
                <label className="wide">Telefono opcional<PhoneInput value={punto.telefono} onChange={(value) => setPunto((current) => ({ ...current, telefono: value }))} defaultCode="+53" pasteTitle="Pegar telefono del punto" /></label>
              </div>
              <SetupActions secondary={<button className="ghost-button" type="button" onClick={() => setPaso(3)}>No uso efectivo ahora</button>} primary={<button className="primary-button" type="button" onClick={() => void guardarPunto()} disabled={saving}>Guardar punto</button>} />
            </>
          )}

          {paso === 3 && (
            <>
              <SetupCardHeader title="Paquete de saldo" description="Opcional. Define cuanto paga el cliente y cuanto saldo recibe." />
              <div className="form-grid">
                <label className="wide">Nombre<input value={saldo.nombre} onChange={(event) => setSaldo((current) => ({ ...current, nombre: event.target.value }))} placeholder="Recarga 1000 CUP" /></label>
                <label>Monto pago<input value={saldo.monto_pago} onChange={(event) => setSaldo((current) => ({ ...current, monto_pago: event.target.value }))} inputMode="decimal" /></label>
                <label>Moneda<FloatingSelect value={saldo.moneda} onChange={(value) => setSaldo((current) => ({ ...current, moneda: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda, description: nombreMoneda(moneda), icon: banderaMoneda(moneda) }))} align="left" /></label>
                <label className="wide">Saldo CUP<input value={saldo.saldo_cup} onChange={(event) => setSaldo((current) => ({ ...current, saldo_cup: event.target.value }))} inputMode="numeric" /></label>
              </div>
              <SetupActions secondary={<button className="ghost-button" type="button" onClick={() => void finalizar()} disabled={saving}>Finalizar sin saldo</button>} primary={<button className="primary-button" type="button" onClick={() => void guardarSaldo()} disabled={saving}>Guardar paquete</button>} />
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
