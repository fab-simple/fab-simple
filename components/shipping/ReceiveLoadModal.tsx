'use client';

import React, { useState } from 'react';
import { ShippingLoad } from '@/lib/shipping-types';
import { X, CheckCircle2, AlertTriangle, PenTool } from 'lucide-react';

interface ReceiveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  load: ShippingLoad | null;
  onConfirmReceive: (updatedLoad: ShippingLoad) => void;
}

export function ReceiveLoadModal({
  isOpen,
  onClose,
  load,
  onConfirmReceive,
}: ReceiveLoadModalProps) {
  if (!isOpen || !load) return null;

  const [receivedBy, setReceivedBy] = useState(load.destination_contact || 'Dave Miller');
  const [condition, setCondition] = useState<'COMPLETE' | 'PARTIAL' | 'DAMAGED'>('COMPLETE');
  const [notes, setNotes] = useState('All assemblies received on site in good condition.');
  const [signatureText, setSignatureText] = useState(load.destination_contact || 'Dave Miller');

  const handleConfirm = () => {
    // Generate simple SVG data URL for signature if text provided
    const svgSig = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50"><text x="10" y="30" font-family="cursive" font-size="20" fill="%230f172a">${encodeURIComponent(
      signatureText
    )}</text></svg>`;

    const receivedLoad: ShippingLoad = {
      ...load,
      status: condition === 'PARTIAL' ? 'PARTIAL_DELIVERED' : 'DELIVERED',
      delivered_at: new Date().toISOString(),
      signed_by: receivedBy,
      signed_at: new Date().toISOString(),
      signature_url: svgSig,
      bol_notes: notes ? `${load.bol_notes || ''}\n[Receipt Note]: ${notes}` : load.bol_notes,
    };

    onConfirmReceive(receivedLoad);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Confirm Jobsite Delivery</h3>
              <p className="text-xs text-slate-400">
                Ticket <span className="font-mono text-white">{load.ticket_number}</span> • Receiver Sign-Off
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
          <div>
            <label className="block text-slate-400 mb-1">Receiver Name / Title</label>
            <input
              type="text"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Delivery Condition</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCondition('COMPLETE')}
                className={`py-2 px-3 rounded-lg border font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                  condition === 'COMPLETE'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> 100% Complete
              </button>

              <button
                type="button"
                onClick={() => setCondition('PARTIAL')}
                className={`py-2 px-3 rounded-lg border font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                  condition === 'PARTIAL'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <AlertTriangle className="w-4 h-4" /> Partial Delivery
              </button>

              <button
                type="button"
                onClick={() => setCondition('DAMAGED')}
                className={`py-2 px-3 rounded-lg border font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                  condition === 'DAMAGED'
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <AlertTriangle className="w-4 h-4" /> Damaged Item
              </button>
            </div>
          </div>

          {/* Digital Signature Pad Input */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <label className="block text-slate-400 text-[11px] font-bold flex items-center gap-1.5">
              <PenTool className="w-4 h-4 text-blue-400" /> Digital Sign-Off / Approval Name
            </label>
            <input
              type="text"
              value={signatureText}
              onChange={(e) => setSignatureText(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white font-semibold italic text-sm"
              placeholder="Type your legal full name as signature"
            />
            <div className="bg-white/5 p-3 rounded border border-dashed border-slate-700 flex items-center justify-center">
              <span className="font-serif italic text-lg text-slate-300">
                {signatureText || 'Digital Signature Preview'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Receipt Notes / Unloading Details</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
            />
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
            onClick={handleConfirm}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <CheckCircle2 className="w-4 h-4" /> Sign & Mark Received
          </button>
        </div>
      </div>
    </div>
  );
}
