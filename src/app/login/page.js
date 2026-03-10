'use client';

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result.error) {
        setError("Credenciales inválidas. Intente nuevamente.");
      } else {
        router.push("/mapa");
        router.refresh();
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">

      {/* Fondo */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/bg-aniatuya.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-900/75 to-slate-950/90" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <div>
          <p className="text-white font-black text-lg tracking-tight leading-none">GeoMuni</p>
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Sistema Municipal GIS</p>
        </div>
        <Link
          href="/inicio"
          className="text-[10px] font-black uppercase text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 px-4 py-2 rounded-xl transition-all"
        >
          ← Inicio
        </Link>
      </header>

      {/* Formulario centrado */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          <div className="text-center mb-8">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] mb-2">Acceso restringido</p>
            <h2 className="text-2xl font-black text-white tracking-tight">Ingresá al sistema</h2>
            <p className="text-slate-400 text-xs mt-1">Personal municipal autorizado</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Correo institucional
              </label>
              <input
                type="email"
                required
                placeholder="usuario@municipio.gov.ar"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-blue-500 focus:bg-slate-800 placeholder:text-slate-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Contraseña
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-blue-500 focus:bg-slate-800 placeholder:text-slate-500 transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 px-4 py-3 rounded-2xl text-xs font-bold text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/40 transition-all active:scale-95 mt-2"
            >
              {loading ? "Verificando..." : "Acceder al sistema"}
            </button>
          </form>

          <p className="text-[9px] text-center text-slate-600 font-bold mt-8 uppercase tracking-tight">
            GeoMuni · Sistema Municipal GIS
          </p>
        </div>
      </div>
    </div>
  );
}
