'use client';

import React, { useState } from 'react';
import { ShippingLoad } from '@/lib/shipping-types';
import { generateShippingBolPdf } from '@/lib/reports/shipping-bol-pdf';
import { X, Truck, Scale, FileText, CheckCircle } from 'lucide-react';

interface ShipLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  load: ShippingLoad | null;
  onConfirmShip: (updatedLoad: ShippingLoad) => void;
}

export function ShipLoadModal({
  isOpen,
  onClose,
  load,
  onConfirmShip,
}: ShipLoadModalProps) {
  if (!isOpen || !load) return null;

  const [driverName, setDriverName] = useState(load.driver_name || 'Marcus Vance');
  const [driverPhone, setDriverPhone] = useState(load.driver_phone || '(512) 555-3390');
  const [truckNumber, setTruckNumber] = useState(load.truck_number || 'TK-882');
  const [trailerNumber, setTrailerNumber] = useState(load.trailer_number || 'TR-48-FLAT-01');

  // Scale weights
  const defaultNet = (load.items || []).reduce((acc, it) => acc + Number(it.total_weight_lbs), 0);
  const [tareWeight, setTareWeight] = useState(load.tare_weight_lbs || 32100);
  const [grossWeight, setGrossWeight] = useState(load.gross_weight_lbs || 32100 + defaultNet);

  const netWeight = grossWeight - tareWeight;

  const handleShip = () => {
    const shippedLoad: ShippingLoad = {
      ...load,
      status: 'SHIPPED',
      shipped_at: new Date().toISOString(),
      driver_name: driverName,
      driver_phone: driverPhone,
      truck_number: truckNumber,
      trailer_number: trailerNumber,
      gross_weight_lbs: grossWeight,
      tare_weight_lbs: tareWeight,
      net_weight_lbs: netWeight,
    };

    onConfirmShip(shippedLoad);
    generateShippingBolPdf(shippedLoad);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Dispatch Load for Shipping</h3>
              <p className="text-xs text-slate-400">
                Ticket <span className="font-mono text-white">{load.ticket_number}</span> • Release to Transit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs text-slate-300">
          {/* Driver & Equipment Form */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Driver Full Name</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Driver Cell Phone</label>
              <input
                type="text"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Tractor Truck #</label>
              <input
                type="text"
                value={truckNumber}
                onChange={(e) => setTruckNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Trailer #</label>
              <input
                type="text"
                value={trailerNumber}
                onChange={(e) => setTrailerNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono font-bold"
              />
            </div>
          </div>

          {/* Scale Weight Measurements */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-indigo-400" /> Yard Scale Ticket Weights
            </h4>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-500 text-[10px]">Tare (Empty Lbs)</label>
                <input
                  type="number"
                  value={tareWeight}
                  onChange={(e) => setTareWeight(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-500 text-[10px]">Gross (Loaded Lbs)</label>
                <input
                  type="number"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-500 text-[10px]">Net Loaded Lbs</label>
                <div className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-emerald-400 font-mono font-bold text-sm">
                  {netWeight.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-[11px] flex items-center gap-2">
            <FileText className="w-4 h-4 shrink-0 text-blue-400" />
            <span>
              Clicking &quot;Confirm Dispatch&quot; will mark status as <strong>SHIPPED</strong> and automatically generate the official PDF Bill of Lading.
            </span>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleShip}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <Truck className="w-4 h-4" /> Confirm Dispatch & Print BOL
          </button>
        </div>
      </div>
    </div>
  );
}
