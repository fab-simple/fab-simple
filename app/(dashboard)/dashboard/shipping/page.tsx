'use client';

import React, { useState, useMemo } from 'react';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useGlobalProject } from '@/hooks/useGlobalProject';
import { ShippingLoad } from '@/lib/shipping-types';
import { DEMO_SHIPPING_LOADS } from '@/lib/shipping-demo-data';
import { generateShippingBolPdf } from '@/lib/reports/shipping-bol-pdf';
import { ShippingKPIs } from '@/components/shipping/ShippingKPIs';
import { LoadBuilderModal } from '@/components/shipping/LoadBuilderModal';
import { LoadDetailModal } from '@/components/shipping/LoadDetailModal';
import { ShipLoadModal } from '@/components/shipping/ShipLoadModal';
import { ReceiveLoadModal } from '@/components/shipping/ReceiveLoadModal';
import {
  Plus,
  FileDown,
  Truck,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Eye,
  ShieldCheck,
  Building2,
  Calendar,
} from 'lucide-react';

export default function ShippingPage() {
  const { selectedProjectId } = useGlobalProject();

  // Local state for loads (initialized with realistic Texas steel demo data)
  const [loads, setLoads] = useState<ShippingLoad[]>(DEMO_SHIPPING_LOADS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderLoad, setBuilderLoad] = useState<ShippingLoad | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<ShippingLoad | null>(null);

  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [shipModalLoad, setShipModalLoad] = useState<ShippingLoad | null>(null);

  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveModalLoad, setReceiveModalLoad] = useState<ShippingLoad | null>(null);

  // Filter loads based on search & global project filter
  const filteredLoads = useMemo(() => {
    return loads.filter((load) => {
      // Global project filter match (if selected)
      if (selectedProjectId && load.project_id && load.project_id !== selectedProjectId) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && load.status !== statusFilter) {
        return false;
      }

      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return (
          (load.ticket_number && load.ticket_number.toLowerCase().includes(query)) ||
          (load.project_name && load.project_name.toLowerCase().includes(query)) ||
          (load.carrier_name && load.carrier_name.toLowerCase().includes(query)) ||
          (load.driver_name && load.driver_name.toLowerCase().includes(query)) ||
          (load.destination_name && load.destination_name.toLowerCase().includes(query)) ||
          (load.items || []).some((it) => (it.mark || it.assembly_mark || '').toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [loads, selectedProjectId, statusFilter, searchTerm]);

  // Handlers
  const handleSaveLoad = (savedLoad: ShippingLoad) => {
    const exists = loads.some((l) => l.id === savedLoad.id);
    if (exists) {
      setLoads(loads.map((l) => (l.id === savedLoad.id ? savedLoad : l)));
    } else {
      setLoads([savedLoad, ...loads]);
    }
  };

  const handleShipConfirm = (shippedLoad: ShippingLoad) => {
    setLoads(loads.map((l) => (l.id === shippedLoad.id ? shippedLoad : l)));
    if (selectedLoad && selectedLoad.id === shippedLoad.id) {
      setSelectedLoad(shippedLoad);
    }
  };

  const handleReceiveConfirm = (receivedLoad: ShippingLoad) => {
    setLoads(loads.map((l) => (l.id === receivedLoad.id ? receivedLoad : l)));
    if (selectedLoad && selectedLoad.id === receivedLoad.id) {
      setSelectedLoad(receivedLoad);
    }
  };

  const handleOpenDetail = (load: ShippingLoad) => {
    setSelectedLoad(load);
    setIsDetailOpen(true);
  };

  const handleOpenEdit = (load: ShippingLoad) => {
    setBuilderLoad(load);
    setIsDetailOpen(false);
    setIsBuilderOpen(true);
  };

  // DataTable columns definition
  const columns: Column<ShippingLoad>[] = [
    {
      key: 'ticket_number',
      label: 'Ticket # / BOL',
      mono: true,
      render: (r) => (
        <div>
          <strong className="text-white font-mono">{r.ticket_number}</strong>
          <div className="text-[10px] text-slate-400">
            {new Date(r.created_at).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'project',
      label: 'Project & Job',
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-200">{r.project_name}</div>
          <div className="text-[10px] text-slate-400">Job #{r.job_number}</div>
        </div>
      ),
    },
    {
      key: 'carrier',
      label: 'Carrier & Driver',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-300">{r.carrier_name || 'In-House'}</div>
          <div className="text-[10px] text-slate-400">
            {r.driver_name ? `${r.driver_name} (${r.truck_number || 'Truck'})` : r.trailer_type}
          </div>
        </div>
      ),
    },
    {
      key: 'destination',
      label: 'Destination',
      render: (r) => (
        <div className="max-w-[180px] truncate">
          <div className="text-slate-300 text-xs font-medium truncate">{r.destination_name}</div>
          {r.destination_contact && (
            <div className="text-[10px] text-slate-500 truncate">Attn: {r.destination_contact}</div>
          )}
        </div>
      ),
    },
    {
      key: 'pieces',
      label: 'Pieces',
      align: 'right',
      mono: true,
      render: (r) => {
        const pcs = r.total_pieces ?? (r.items || []).reduce((acc, it) => acc + (it.qty_on_load ?? it.quantity ?? 1), 0);
        return <span className="font-bold text-white">{pcs} pcs</span>;
      },
    },
    {
      key: 'weight',
      label: 'Load Weight',
      align: 'right',
      mono: true,
      render: (r) => {
        const wtLbs =
          r.net_weight_lbs ||
          (r.items || []).reduce((acc, it) => acc + Number(it.total_weight_lbs), 0);
        const tons = (wtLbs / 2000).toFixed(2);
        return (
          <div>
            <div className="font-bold text-emerald-400 font-mono">{wtLbs.toLocaleString()} lbs</div>
            <div className="text-[10px] text-slate-400">{tons} tons</div>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        let badgeStyle = 'bg-slate-800 text-slate-300';
        if (r.status === 'DELIVERED')
          badgeStyle = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30';
        else if (r.status === 'SHIPPED')
          badgeStyle = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
        else if (r.status === 'READY_TO_SHIP')
          badgeStyle = 'bg-amber-500/10 text-amber-400 border border-amber-500/30';

        return (
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}>
            {r.status.replace(/_/g, ' ')}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleOpenDetail(r)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            title="Inspect Load"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => generateShippingBolPdf(r)}
            className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-semibold rounded-lg transition flex items-center gap-1"
            title="Download BOL PDF"
          >
            <FileDown className="w-3.5 h-3.5" /> BOL PDF
          </button>

          {r.status === 'READY_TO_SHIP' && (
            <button
              onClick={() => {
                setShipModalLoad(r);
                setIsShipModalOpen(true);
              }}
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition flex items-center gap-1 shadow"
            >
              <Truck className="w-3.5 h-3.5" /> Ship
            </button>
          )}

          {r.status === 'SHIPPED' && (
            <button
              onClick={() => {
                setReceiveModalLoad(r);
                setIsReceiveModalOpen(true);
              }}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg transition flex items-center gap-1 shadow"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Receive
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageWrapper title="Shipping Tickets & Dispatch">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-7 h-7 text-blue-500" />
            Shipping Tickets &amp; Bill of Lading
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Texas structural steel heavy haul dispatch • Select → Review → Generate → Print → Ship → Receive
          </p>
        </div>

        <button
          onClick={() => {
            setBuilderLoad(null);
            setIsBuilderOpen(true);
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Create Shipping Load
        </button>
      </div>

      {/* KPI Dashboard Stats Bar */}
      <ShippingKPIs loads={loads} />

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search BOL #, mark, project, driver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="BUILDING">Building / Draft</option>
            <option value="READY_TO_SHIP">Ready to Ship</option>
            <option value="SHIPPED">Shipped / In Transit</option>
            <option value="DELIVERED">Delivered &amp; Signed</option>
          </select>
        </div>
      </div>

      {/* Main Shipping Loads DataTable */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <DataTable
          data={filteredLoads}
          columns={columns}
          loading={false}
          error={null}
          empty={{
            title: 'No shipping loads found',
            subtitle: 'Click "Create Shipping Load" above to build a new dispatch load ticket.',
          }}
          rowKey={(r) => r.id}
          onRowClick={(r) => handleOpenDetail(r)}
        />
      </div>

      {/* Interactive Modals */}
      <LoadBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        onSave={handleSaveLoad}
        initialLoad={builderLoad}
      />

      <LoadDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        load={selectedLoad}
        onOpenShipModal={(loadToShip) => {
          setIsDetailOpen(false);
          setShipModalLoad(loadToShip);
          setIsShipModalOpen(true);
        }}
        onOpenReceiveModal={(loadToReceive) => {
          setIsDetailOpen(false);
          setReceiveModalLoad(loadToReceive);
          setIsReceiveModalOpen(true);
        }}
        onEditLoad={handleOpenEdit}
      />

      <ShipLoadModal
        isOpen={isShipModalOpen}
        onClose={() => setIsShipModalOpen(false)}
        load={shipModalLoad}
        onConfirmShip={handleShipConfirm}
      />

      <ReceiveLoadModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        load={receiveModalLoad}
        onConfirmReceive={handleReceiveConfirm}
      />
    </PageWrapper>
  );
}
