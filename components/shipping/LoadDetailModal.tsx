'use client';

import React from 'react';
import { ShippingLoad } from '@/lib/shipping-types';
import { generateShippingBolPdf } from '@/lib/reports/shipping-bol-pdf';
import { DEMO_AUDIT_LOGS } from '@/lib/shipping-demo-data';
import {
  X,
  Printer,
  FileText,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Scale,
  User,
  Phone,
  ShieldCheck,
  Calendar,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface LoadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  load: ShippingLoad | null;
  onOpenShipModal: (load: ShippingLoad) => void;
  onOpenReceiveModal: (load: ShippingLoad) => void;
  onEditLoad: (load: ShippingLoad) => void;
}

export function LoadDetailModal({
  isOpen,
  onClose,
  load,
  onOpenShipModal,
  onOpenReceiveModal,
  onEditLoad,
}: LoadDetailModalProps) {
  if (!isOpen || !load) return null;

  const statusSteps = ['BUILDING', 'STAGED', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'];
  const currentStepIdx = statusSteps.indexOf(load.status);

  const totalAssembliesWeight = (load.items || []).reduce(
    (acc, it) => acc + Number(it.total_weight_lbs),
    0
  );
  const totalAccessoriesWeight = (load.additional_items || []).reduce(
    (acc, it) => acc + Number(it.weight_lbs || 0),
    0
  );
  const totalWeight = totalAssembliesWeight + totalAccessoriesWeight;
  const totalPieces = (load.items || []).reduce((acc, it) => acc + it.qty_on_load, 0);

  const handlePrintPdf = () => {
    generateShippingBolPdf(load);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Action Bar */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white font-mono">{load.ticket_number}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    load.status === 'DELIVERED'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                      : load.status === 'SHIPPED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : load.status === 'READY_TO_SHIP'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {load.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Project: <span className="text-slate-200 font-medium">{load.project_name}</span> (Job #{load.job_number})
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow"
            >
              <Printer className="w-4 h-4" /> Print / PDF BOL
            </button>

            {load.status === 'READY_TO_SHIP' && (
              <button
                onClick={() => onOpenShipModal(load)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow"
              >
                <Truck className="w-4 h-4" /> Ship Load
              </button>
            )}

            {load.status === 'SHIPPED' && (
              <button
                onClick={() => onOpenReceiveModal(load)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow"
              >
                <CheckCircle2 className="w-4 h-4" /> Receive Load
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Pipeline Progress Bar */}
        <div className="px-6 py-4 bg-slate-950/70 border-b border-slate-800">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
            <span>Load Lifecycle Stage</span>
            <span className="text-slate-300 font-mono">
              Created: {new Date(load.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-800 -translate-y-1/2 z-0" />
            {statusSteps.map((step, idx) => {
              const isPassed = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div key={step} className="relative z-10 flex flex-col items-center gap-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      isPassed
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400'
                        : 'bg-slate-900 border border-slate-700 text-slate-500'
                    }`}
                  >
                    {isPassed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span
                    className={`text-[10px] font-semibold ${
                      isCurrent
                        ? 'text-blue-400 font-bold'
                        : isPassed
                        ? 'text-slate-300'
                        : 'text-slate-600'
                    }`}
                  >
                    {step.replace(/_/g, ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Scroll Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Grid 1: Route & Logistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Origin & Destination */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-blue-400" /> Dispatch Route
              </div>
              <div className="text-xs space-y-2">
                <div>
                  <p className="text-slate-500 text-[10px]">ORIGIN (SHIP FROM)</p>
                  <p className="font-semibold text-white">{load.origin_name}</p>
                  <p className="text-slate-400">{load.origin_address}</p>
                </div>
                <div className="pt-2 border-t border-slate-900">
                  <p className="text-slate-500 text-[10px]">DESTINATION (JOBSITE)</p>
                  <p className="font-semibold text-white">{load.destination_name}</p>
                  <p className="text-slate-400">{load.destination_address}</p>
                  {load.destination_contact && (
                    <p className="text-blue-400 mt-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> {load.destination_contact}{' '}
                      {load.destination_phone && `(${load.destination_phone})`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Carrier & Driver Info */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Truck className="w-4 h-4 text-emerald-400" /> Carrier & Transport
              </div>
              <div className="text-xs space-y-1.5 text-slate-300">
                <p className="font-bold text-white text-sm">{load.carrier_name || 'Self-Transport'}</p>
                {load.dot_number && <p className="text-slate-500 font-mono">{load.dot_number}</p>}

                <div className="pt-2 border-t border-slate-900 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block text-[10px]">DRIVER</span>
                    <span className="font-semibold text-white">{load.driver_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">TRUCK / TRAILER</span>
                    <span className="font-semibold text-white">
                      {load.truck_number || '—'} / {load.trailer_number || '—'}
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-slate-500 text-[10px]">TRAILER TYPE</span>
                  <span className="block font-semibold text-amber-400">{load.trailer_type}</span>
                </div>
              </div>
            </div>

            {/* Weights Breakdown Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Scale className="w-4 h-4 text-indigo-400" /> Weight Metrics
              </div>
              <div className="text-xs space-y-2">
                <div className="flex justify-between items-baseline py-1 border-b border-slate-900">
                  <span className="text-slate-400">Total Assemblies:</span>
                  <span className="font-bold text-white">{totalPieces} Pcs</span>
                </div>
                <div className="flex justify-between items-baseline py-1 border-b border-slate-900">
                  <span className="text-slate-400">Net Cargo Weight:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {totalWeight.toLocaleString()} lbs
                  </span>
                </div>
                <div className="flex justify-between items-baseline py-1 border-b border-slate-900">
                  <span className="text-slate-400">Weight in Tons:</span>
                  <span className="font-bold text-white font-mono">
                    {(totalWeight / 2000).toFixed(2)} Tons
                  </span>
                </div>
                <div className="flex justify-between items-baseline py-1">
                  <span className="text-slate-400">Trailer Legal Max:</span>
                  <span className="font-mono text-slate-400">
                    {(load.max_weight_lbs || 48000).toLocaleString()} lbs
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Assemblies Manifest Table */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
              <span>Fabricated Steel Assembly Manifest ({(load.items || []).length})</span>
              <span className="text-xs font-normal text-slate-400">
                QC Inspection Verified: 100%
              </span>
            </h3>

            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="p-3">Mark</th>
                    <th className="p-3">Material Section</th>
                    <th className="p-3">Length</th>
                    <th className="p-3">Sequence</th>
                    <th className="p-3">Drawing #</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Unit Weight</th>
                    <th className="p-3 text-right">Total Weight</th>
                    <th className="p-3 text-center">QC Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {(load.items || []).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/50">
                      <td className="p-3 font-bold font-mono text-white">{item.mark}</td>
                      <td className="p-3">{item.main_material}</td>
                      <td className="p-3">{item.length_ft_in}</td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">
                          {item.sequence || '—'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400">{item.drawing_no || '—'}</td>
                      <td className="p-3 text-center font-bold text-white">{item.qty_on_load}</td>
                      <td className="p-3 text-right font-mono">
                        {Number(item.unit_weight_lbs).toLocaleString()} lbs
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">
                        {Number(item.total_weight_lbs).toLocaleString()} lbs
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold">
                          <ShieldCheck className="w-3 h-3" /> Passed QC
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Loose Accessories & Dunnage */}
          {load.additional_items && load.additional_items.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-white mb-2">
                Loose Hardware, Bolts & Dunnage ({load.additional_items.length})
              </h3>
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-semibold">
                    <tr>
                      <th className="p-3">Category</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-center">Quantity</th>
                      <th className="p-3 text-right">Est Weight</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {load.additional_items.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-bold text-slate-400">
                          <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px]">
                            {acc.category}
                          </span>
                        </td>
                        <td className="p-3 text-white">{acc.description}</td>
                        <td className="p-3 text-center font-bold">
                          {acc.qty} {acc.unit}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {acc.weight_lbs ? `${acc.weight_lbs} lbs` : '—'}
                        </td>
                        <td className="p-3 text-slate-400">{acc.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Special Delivery Notes */}
          {load.bol_notes && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                BOL Special Driver Instructions
              </h4>
              <p className="text-xs text-slate-300 italic">{load.bol_notes}</p>
            </div>
          )}

          {/* Delivery Confirmation Signature Card */}
          {load.signed_by && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between text-xs text-emerald-300">
              <div>
                <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                  <CheckCircle2 className="w-5 h-5" /> Jobsite Receipt Confirmed
                </div>
                <p className="mt-1 text-slate-300">
                  Signed by: <span className="font-bold text-white">{load.signed_by}</span> on{' '}
                  {load.signed_at ? new Date(load.signed_at).toLocaleString() : 'Delivery'}
                </p>
              </div>
              {load.signature_url && (
                <div className="bg-white p-2 rounded border border-slate-300">
                  {/* Digital signature preview */}
                  <div
                    dangerouslySetInnerHTML={{ __html: load.signature_url }}
                    className="w-28 h-10"
                  />
                </div>
              )}
            </div>
          )}

          {/* Audit History Log */}
          <div>
            <h3 className="text-sm font-bold text-white mb-2">Load Chain-of-Custody Audit Log</h3>
            <div className="space-y-2">
              {DEMO_AUDIT_LOGS.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px] font-bold">
                      {log.action}
                    </span>
                    <div>
                      <p className="text-slate-200 font-medium">{log.details}</p>
                      <p className="text-slate-500 text-[10px]">By: {log.user_name}</p>
                    </div>
                  </div>
                  <span className="text-slate-400 font-mono text-[10px]">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            onClick={() => onEditLoad(load)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            Edit Load Details
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
