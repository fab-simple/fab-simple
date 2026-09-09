'use client';

import React from 'react';
import { ShippingLoad } from '@/lib/shipping-types';
import { calculateShippingSummary } from '@/lib/shipping-utils';
import { Truck, Package, CheckCircle2, Clock, Scale, AlertTriangle } from 'lucide-react';

interface ShippingKPIsProps {
  loads: ShippingLoad[];
}

export function ShippingKPIs({ loads }: ShippingKPIsProps) {
  const summary = calculateShippingSummary(loads);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Weight Shipped */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Shipped Weight</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {(summary.totalWeightLbs / 2000).toFixed(1)} <span className="text-sm font-normal text-slate-400">Tons</span>
            </h3>
            <span className="text-xs text-slate-400">({summary.totalWeightLbs.toLocaleString()} lbs)</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{summary.totalPieces.toLocaleString()} total pieces dispatched</p>
        </div>
        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
          <Scale className="w-6 h-6" />
        </div>
      </div>

      {/* Ready to Ship / Staged */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ready to Ship</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-amber-400 tracking-tight">{summary.readyCount}</h3>
            <span className="text-xs text-slate-400">loads staged</span>
          </div>
          <p className="text-xs text-amber-400/80 mt-1">
            {(summary.readyWeightLbs / 2000).toFixed(1)} tons ready in yard
          </p>
        </div>
        <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
          <Clock className="w-6 h-6" />
        </div>
      </div>

      {/* Active Loads in Transit */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">In Transit / Shipped</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-emerald-400 tracking-tight">{summary.shippedCount}</h3>
            <span className="text-xs text-slate-400">active loads</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">On trucks bound for jobsite</p>
        </div>
        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
          <Truck className="w-6 h-6" />
        </div>
      </div>

      {/* Delivered Loads */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Delivered & Signed</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-indigo-400 tracking-tight">{summary.deliveredCount}</h3>
            <span className="text-xs text-slate-400">completed</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Signed by field erectors</p>
        </div>
        <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
          <CheckCircle2 className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
