'use client';

import React, { useState } from 'react';
import {
  ShippingLoad,
  ShippingLoadItem,
  ShippingAdditionalItem,
  ShippingCarrier,
  ShippingTrailer,
} from '@/lib/shipping-types';
import {
  generateTicketNumber,
  calculateLoadTotals,
  checkLoadReadiness,
} from '@/lib/shipping-utils';
import {
  DEMO_CARRIERS,
  DEMO_TRAILERS,
  DEMO_AVAILABLE_ASSEMBLIES,
} from '@/lib/shipping-demo-data';
import {
  X,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Truck,
  Package,
  Layers,
  ChevronRight,
  ChevronLeft,
  FileText,
  Scale,
} from 'lucide-react';

interface LoadBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (load: ShippingLoad) => void;
  initialLoad?: ShippingLoad | null;
}

export function LoadBuilderModal({
  isOpen,
  onClose,
  onSave,
  initialLoad,
}: LoadBuilderModalProps) {
  const [step, setStep] = useState<'SETUP' | 'ASSEMBLIES' | 'ACCESSORIES' | 'REVIEW'>('SETUP');

  // Header & Carrier Setup
  const [ticketNumber, setTicketNumber] = useState(
    initialLoad?.ticket_number || generateTicketNumber()
  );
  const [projectName, setProjectName] = useState(
    initialLoad?.project_name || 'Austin High School Expansion'
  );
  const [jobNumber, setJobNumber] = useState(initialLoad?.job_number || '2024-001');

  const [originName, setOriginName] = useState(
    initialLoad?.origin_name || 'Apex Taylor Fab Facility'
  );
  const [originAddress, setOriginAddress] = useState(
    initialLoad?.origin_address || '1500 Steel Mill Rd, Taylor, TX 76574'
  );

  const [destName, setDestName] = useState(
    initialLoad?.destination_name || 'Jobsite - Austin High School'
  );
  const [destAddress, setDestAddress] = useState(
    initialLoad?.destination_address || '1715 Cesar Chavez St, Austin, TX 78703'
  );
  const [destContact, setDestContact] = useState(
    initialLoad?.destination_contact || 'Dave Miller (Foreman)'
  );
  const [destPhone, setDestPhone] = useState(initialLoad?.destination_phone || '(512) 555-8821');

  const [carrierName, setCarrierName] = useState(
    initialLoad?.carrier_name || DEMO_CARRIERS[0].name
  );
  const [dotNumber, setDotNumber] = useState(
    initialLoad?.dot_number || DEMO_CARRIERS[0].dot_number
  );
  const [trailerType, setTrailerType] = useState<any>(
    initialLoad?.trailer_type || 'FLATBED'
  );
  const [trailerNumber, setTrailerNumber] = useState(
    initialLoad?.trailer_number || DEMO_TRAILERS[0].trailer_number
  );
  const [maxWeight, setMaxWeight] = useState(initialLoad?.max_weight_lbs || 48000);

  const [bolNotes, setBolNotes] = useState(
    initialLoad?.bol_notes || 'Deliver to North Gate entrance. Unload with crane.'
  );

  // Load Assembly Items
  const [selectedItems, setSelectedItems] = useState<ShippingLoadItem[]>(
    initialLoad?.items || [
      {
        id: 'item-new-1',
        load_id: 'temp',
        mark: 'B-201',
        qty_on_load: 4,
        unit_weight_lbs: 2150,
        total_weight_lbs: 8600,
        main_material: 'W21X44',
        length_ft_in: "30'-0\"",
        finish: 'GRAY_PRIMER',
        sequence: 'SEQ-2',
        drawing_no: 'S-205',
        status: 'BUILDING',
        qc_inspected: true,
      },
      {
        id: 'item-new-2',
        load_id: 'temp',
        mark: 'B-202',
        qty_on_load: 3,
        unit_weight_lbs: 2900,
        total_weight_lbs: 8700,
        main_material: 'W24X55',
        length_ft_in: "32'-6\"",
        finish: 'GRAY_PRIMER',
        sequence: 'SEQ-2',
        drawing_no: 'S-205',
        status: 'BUILDING',
        qc_inspected: true,
      },
    ]
  );

  // Additional Loose Items (Bolts, Paint, Dunnage)
  const [additionalItems, setAdditionalItems] = useState<ShippingAdditionalItem[]>(
    initialLoad?.additional_items || [
      {
        id: 'add-1',
        load_id: 'temp',
        description: '3/4" x 2-1/2" A325 Heavy Hex Bolts',
        qty: 3,
        unit: 'KEGS',
        weight_lbs: 150,
        category: 'BOLTS',
        notes: 'For B-201 field splice',
      },
      {
        id: 'add-2',
        load_id: 'temp',
        description: 'Oak Dunnage Timbers 4x4',
        qty: 6,
        unit: 'PCS',
        weight_lbs: 135,
        category: 'DUNNAGE',
      },
    ]
  );

  // New accessory temp state
  const [newAccDesc, setNewAccDesc] = useState('');
  const [newAccQty, setNewAccQty] = useState(1);
  const [newAccUnit, setNewAccUnit] = useState('KEGS');
  const [newAccCat, setNewAccCat] = useState<'BOLTS' | 'TOUCHUP_PAINT' | 'DUNNAGE' | 'ANCHOR_RODS' | 'HARDWARE'>('BOLTS');
  const [newAccWt, setNewAccWt] = useState(50);

  if (!isOpen) return null;

  // Calculate live totals
  const totals = calculateLoadTotals(selectedItems, additionalItems, maxWeight);
  const readiness = checkLoadReadiness(selectedItems);

  // Available assemblies to add
  const handleAddAssembly = (asm: typeof DEMO_AVAILABLE_ASSEMBLIES[0]) => {
    const existing = selectedItems.find((i) => i.mark === asm.mark);
    if (existing) {
      setSelectedItems(
        selectedItems.map((i) => {
          if (i.mark === asm.mark) {
            const nextQty = (i.qty_on_load ?? 0) + 1;
            const unitWt = i.unit_weight_lbs ?? asm.unit_weight_lbs;
            return {
              ...i,
              qty_on_load: nextQty,
              total_weight_lbs: nextQty * unitWt,
            };
          }
          return i;
        })
      );
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          id: `item-${Date.now()}-${Math.random()}`,
          load_id: 'temp',
          assembly_id: asm.id,
          mark: asm.mark,
          qty_on_load: 1,
          unit_weight_lbs: asm.unit_weight_lbs,
          total_weight_lbs: asm.unit_weight_lbs,
          main_material: asm.main_material,
          length_ft_in: asm.length_ft_in,
          finish: asm.finish,
          sequence: asm.sequence,
          drawing_no: asm.drawing_no,
          status: 'BUILDING',
          qc_inspected: asm.qc_inspected,
        },
      ]);
    }
  };

  const handleUpdateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setSelectedItems(selectedItems.filter((i) => i.id !== id));
      return;
    }
    setSelectedItems(
      selectedItems.map((i) => {
        if (i.id === id) {
          const unitWt = i.unit_weight_lbs ?? (i.total_weight_lbs && i.qty_on_load ? i.total_weight_lbs / i.qty_on_load : 0);
          return {
            ...i,
            qty_on_load: qty,
            total_weight_lbs: qty * unitWt,
          };
        }
        return i;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems(selectedItems.filter((i) => i.id !== id));
  };

  const handleAddAccessory = () => {
    if (!newAccDesc.trim()) return;
    setAdditionalItems([
      ...additionalItems,
      {
        id: `acc-${Date.now()}`,
        load_id: 'temp',
        description: newAccDesc,
        qty: newAccQty,
        unit: newAccUnit,
        weight_lbs: newAccWt,
        category: newAccCat,
      },
    ]);
    setNewAccDesc('');
    setNewAccQty(1);
    setNewAccWt(50);
  };

  const handleRemoveAccessory = (id: string) => {
    setAdditionalItems(additionalItems.filter((a) => a.id !== id));
  };

  const handleCarrierSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    setCarrierName(selectedName);
    const found = DEMO_CARRIERS.find((c) => c.name === selectedName);
    if (found) {
      setDotNumber(found.dot_number || '');
    }
  };

  const handleSave = () => {
    const newLoad: ShippingLoad = {
      id: initialLoad?.id || `load-${Date.now()}`,
      ticket_number: ticketNumber,
      project_name: projectName,
      job_number: jobNumber,
      status: initialLoad?.status || 'BUILDING',
      created_at: initialLoad?.created_at || new Date().toISOString(),

      origin_name: originName,
      origin_address: originAddress,

      destination_name: destName,
      destination_address: destAddress,
      destination_contact: destContact,
      destination_phone: destPhone,

      carrier_name: carrierName,
      dot_number: dotNumber,
      trailer_number: trailerNumber,
      trailer_type: trailerType,

      max_weight_lbs: maxWeight,
      net_weight_lbs: totals.totalWeightLbs,

      bol_notes: bolNotes,

      items: selectedItems,
      additional_items: additionalItems,
    };

    onSave(newLoad);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {initialLoad ? 'Edit Shipping Load' : 'Create New Shipping Load'}
                </h2>
                <p className="text-xs text-slate-400">
                  Ticket #{ticketNumber} • Simple 3-Step Load Dispatch Builder
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Progress */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep('SETUP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${step === 'SETUP'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
            >
              <span className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center text-[10px]">
                1
              </span>
              Setup & Carrier
            </button>

            <ChevronRight className="w-4 h-4 text-slate-600" />

            <button
              onClick={() => setStep('ASSEMBLIES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${step === 'ASSEMBLIES'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
            >
              <span className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center text-[10px]">
                2
              </span>
              Assemblies ({selectedItems.length})
            </button>

            <ChevronRight className="w-4 h-4 text-slate-600" />

            <button
              onClick={() => setStep('ACCESSORIES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${step === 'ACCESSORIES'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
            >
              <span className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center text-[10px]">
                3
              </span>
              Loose Hardware ({additionalItems.length})
            </button>

            <ChevronRight className="w-4 h-4 text-slate-600" />

            <button
              onClick={() => setStep('REVIEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${step === 'REVIEW'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
            >
              <span className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center text-[10px]">
                4
              </span>
              Review & BOL
            </button>
          </div>

          {/* Live Weight Capacity Badge */}
          <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <Scale className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Total Weight:</span>
            <span
              className={`font-bold ${(totals.isOverweight ?? totals.is_overweight) ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}
            >
              {(totals.totalWeightLbs ?? totals.net_weight_lbs ?? 0).toLocaleString()} / {maxWeight.toLocaleString()} lbs
            </span>
            <span className="text-slate-500">({(totals.weightPercentage ?? totals.utilization_pct ?? 0).toFixed(0)}%)</span>
          </div>
        </div>

        {/* Step Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: SETUP & CARRIER */}
          {step === 'SETUP' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    BOL Ticket Number
                  </label>
                  <input
                    type="text"
                    value={ticketNumber}
                    onChange={(e) => setTicketNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Project / Job
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* Origin & Destination */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Ship From (Origin)
                  </h4>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Facility Name</label>
                    <input
                      type="text"
                      value={originName}
                      onChange={(e) => setOriginName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Address</label>
                    <input
                      type="text"
                      value={originAddress}
                      onChange={(e) => setOriginAddress(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Ship To (Destination / Jobsite)
                  </h4>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Jobsite Location</label>
                    <input
                      type="text"
                      value={destName}
                      onChange={(e) => setDestName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Address</label>
                    <input
                      type="text"
                      value={destAddress}
                      onChange={(e) => setDestAddress(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Site Contact</label>
                      <input
                        type="text"
                        value={destContact}
                        onChange={(e) => setDestContact(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Contact Phone</label>
                      <input
                        type="text"
                        value={destPhone}
                        onChange={(e) => setDestPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Carrier Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Freight Carrier
                  </label>
                  <select
                    value={carrierName}
                    onChange={handleCarrierSelect}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {DEMO_CARRIERS.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Trailer Type
                  </label>
                  <select
                    value={trailerType}
                    onChange={(e) => setTrailerType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="FLATBED">Flatbed (48 ft)</option>
                    <option value="STEP_DECK">Step Deck (53 ft)</option>
                    <option value="LOWBOY">Lowboy Heavy Haul</option>
                    <option value="RGN">RGN (Removable Gooseneck)</option>
                    <option value="HOT_SHOT">Hot Shot Truck</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Max Legal Weight Limit (Lbs)
                  </label>
                  <input
                    type="number"
                    value={maxWeight}
                    onChange={(e) => setMaxWeight(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT ASSEMBLIES */}
          {step === 'ASSEMBLIES' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-2">Available Staged Assemblies</h3>
                <p className="text-xs text-slate-400 mb-3">
                  Click to add assemblies ready in the yard to this shipment load:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {DEMO_AVAILABLE_ASSEMBLIES.map((asm) => {
                    const isAdded = selectedItems.some((i) => i.mark === asm.mark);
                    return (
                      <div
                        key={asm.id}
                        onClick={() => handleAddAssembly(asm)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${isAdded
                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm font-mono text-white">{asm.mark}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">
                              {asm.sequence}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {asm.main_material} • {asm.length_ft_in}
                          </p>
                          <p className="text-xs text-slate-500">
                            {asm.unit_weight_lbs.toLocaleString()} lbs/ea • {asm.bay_location}
                          </p>
                        </div>
                        <Plus className={`w-5 h-5 ${isAdded ? 'text-blue-400' : 'text-slate-500'}`} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Assemblies List */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3">
                  Assemblies Loaded on BOL ({selectedItems.length})
                </h3>
                {selectedItems.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-500 text-sm">
                    No assemblies added to this load yet. Click assemblies above.
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-semibold">
                        <tr>
                          <th className="p-3">Assembly Mark</th>
                          <th className="p-3">Material & Length</th>
                          <th className="p-3">Sequence</th>
                          <th className="p-3 text-center">Qty on Load</th>
                          <th className="p-3 text-right">Unit Wt</th>
                          <th className="p-3 text-right">Total Wt</th>
                          <th className="p-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {selectedItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-900/50">
                            <td className="p-3 font-bold font-mono text-white">{item.mark}</td>
                            <td className="p-3">
                              {item.main_material} ({item.length_ft_in})
                            </td>
                            <td className="p-3">{item.sequence || '—'}</td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min={1}
                                value={item.qty_on_load}
                                onChange={(e) => handleUpdateQty(item.id, Number(e.target.value))}
                                className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-bold text-white"
                              />
                            </td>
                            <td className="p-3 text-right font-mono">
                              {(item.unit_weight_lbs ?? item.weight_lbs ?? 0).toLocaleString()} lbs
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">
                              {(item.total_weight_lbs ?? 0).toLocaleString()} lbs
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1 text-slate-500 hover:text-red-400 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: LOOSE ACCESSORIES */}
          {step === 'ACCESSORIES' && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white">Add Loose Accessory / Hardware</h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="e.g. 3/4 A325 Structural Bolt Kegs"
                      value={newAccDesc}
                      onChange={(e) => setNewAccDesc(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Category</label>
                    <select
                      value={newAccCat}
                      onChange={(e) => setNewAccCat(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                    >
                      <option value="BOLTS">Bolts / Fasteners</option>
                      <option value="TOUCHUP_PAINT">Touch-up Paint</option>
                      <option value="DUNNAGE">Oak Dunnage</option>
                      <option value="ANCHOR_RODS">Anchor Rods</option>
                      <option value="HARDWARE">Miscellaneous</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Qty & Unit</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={1}
                        value={newAccQty}
                        onChange={(e) => setNewAccQty(Number(e.target.value))}
                        className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white text-center font-bold"
                      />
                      <input
                        type="text"
                        value={newAccUnit}
                        onChange={(e) => setNewAccUnit(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleAddAccessory}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Accessories List */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-semibold">
                    <tr>
                      <th className="p-3">Category</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-center">Quantity</th>
                      <th className="p-3 text-right">Est Weight</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {additionalItems.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-bold text-slate-400">
                          <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px]">
                            {acc.category}
                          </span>
                        </td>
                        <td className="p-3 text-white font-medium">{acc.description}</td>
                        <td className="p-3 text-center font-bold">
                          {acc.qty} {acc.unit}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {acc.weight_lbs ? `${acc.weight_lbs} lbs` : '—'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleRemoveAccessory(acc.id)}
                            className="p-1 text-slate-500 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & BOL GENERATION */}
          {step === 'REVIEW' && (
            <div className="space-y-6">
              {/* Readiness Alerts */}
              {!readiness.isReady ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-300 text-xs">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold mb-1">Staging / QC Attention Required:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {readiness.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-300 text-xs">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <h4 className="font-bold">Load Ready for Shipping Dispatch!</h4>
                    <p className="text-emerald-400/80">
                      All assemblies inspected, legal weight limits satisfied.
                    </p>
                  </div>
                </div>
              )}

              {/* Summary Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px] border-b border-slate-800 pb-2">
                    BOL Summary
                  </h4>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Ticket #:</span>
                    <span className="font-mono text-white font-bold">{ticketNumber}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Carrier:</span>
                    <span className="text-white">{carrierName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Trailer:</span>
                    <span className="text-white">
                      {trailerNumber} ({trailerType})
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Destination:</span>
                    <span className="text-white">{destName}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px] border-b border-slate-800 pb-2">
                    Weight Breakdown
                  </h4>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Total Assemblies:</span>
                    <span className="font-bold text-white">{(totals.totalPieces ?? totals.total_pieces ?? 0)} Pcs</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Net Loaded Weight:</span>
                    <span className="font-bold font-mono text-emerald-400">
                      {(totals.totalWeightLbs ?? totals.net_weight_lbs ?? 0).toLocaleString()} lbs (
                      {(((totals.totalWeightLbs ?? totals.net_weight_lbs ?? 0)) / 2000).toFixed(2)} tons)
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Max Capacity:</span>
                    <span className="font-mono text-slate-400">
                      {maxWeight.toLocaleString()} lbs
                    </span>
                  </div>
                </div>
              </div>

              {/* BOL Special Instructions */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Special BOL Delivery Notes / Driver Instructions
                </label>
                <textarea
                  rows={3}
                  value={bolNotes}
                  onChange={(e) => setBolNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div>
            {step !== 'SETUP' && (
              <button
                onClick={() => {
                  if (step === 'REVIEW') setStep('ACCESSORIES');
                  else if (step === 'ACCESSORIES') setStep('ASSEMBLIES');
                  else if (step === 'ASSEMBLIES') setStep('SETUP');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>

            {step !== 'REVIEW' ? (
              <button
                onClick={() => {
                  if (step === 'SETUP') setStep('ASSEMBLIES');
                  else if (step === 'ASSEMBLIES') setStep('ACCESSORIES');
                  else if (step === 'ACCESSORIES') setStep('REVIEW');
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1 shadow-lg shadow-blue-600/20"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                <FileText className="w-4 h-4" /> Save & Generate Load BOL
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
