import { useState } from "react";
import {
  Search,
  Filter,
  Download,
  Clock,
  MapPin,
  X,
  Package,
  RefreshCw,
  Circle,
  CheckCircle2,
  AlertTriangle,
  Warehouse,
  Truck,
  Building2,
} from "lucide-react";
import { TableSkeleton } from "./SkeletonLoader";

interface ShipmentsListProps {
  shipments: any[];
  onViewDetails: (id: string) => void;
  onRefresh?: () => void;
  lastUpdated?: Date;
  isLoading?: boolean;
}

export function ShipmentsList({
  shipments,
  onViewDetails,
  onRefresh,
  lastUpdated,
  isLoading = false,
}: ShipmentsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Manufacturing":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "Quality Control":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "Warehouse":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "In Transit":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "Distribution":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "Delivered":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Manufacturing":
        return <Circle className="w-3 h-3" />;
      case "Quality Control":
        return <AlertTriangle className="w-3 h-3" />;
      case "Warehouse":
        return <Warehouse className="w-3 h-3" />;
      case "In Transit":
        return <Truck className="w-3 h-3" />;
      case "Distribution":
        return <Building2 className="w-3 h-3" />;
      case "Delivered":
        return <CheckCircle2 className="w-3 h-3" />;
      default:
        return <Circle className="w-3 h-3" />;
    }
  };

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  const filteredShipments = shipments.filter((shipment) => {
    const matchesSearch =
      shipment.id
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      shipment.description
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      shipment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    // Get shipments to export (filtered results)
    const dataToExport = filteredShipments;

    // Create CSV headers
    const headers = [
      "Shipment ID",
      "Description",
      "Category",
      "Origin",
      "Destination",
      "Quantity",
      "Temperature Requirements",
      "Expected Date",
      "Handler/Carrier",
      "Current Owner",
      "Status",
      "Created At",
      "Last Updated",
      "Notes",
    ];

    // Create CSV rows
    const rows = dataToExport.map((shipment) => [
      shipment.id || "",
      shipment.description || "",
      shipment.category || "",
      shipment.origin || "",
      shipment.destination || "",
      shipment.quantity || "",
      shipment.temperature || "",
      shipment.expectedDate || "",
      shipment.handler || "",
      shipment.owner || "",
      shipment.status || "",
      shipment.createdAt || "",
      shipment.lastUpdate || "",
      shipment.notes || "",
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => {
          // Escape commas and quotes in cell values
          const cellStr = String(cell || "");
          if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(",")
      ),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filename = `shipments_export_${timestamp}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-white mb-1">All Shipments</h2>
          <p className="text-slate-400 text-sm">
            Manage and track all medical supply shipments
          </p>
          {lastUpdated && (
            <p className="text-xs text-slate-500 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-md transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh shipments data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-md transition-colors text-sm"
            aria-label="Export shipments to CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Data</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by ID or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 placeholder:text-slate-600 transition-colors"
              aria-label="Search shipments"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="pl-10 pr-8 py-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 appearance-none cursor-pointer transition-colors"
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                <option value="Manufacturing">
                  Manufacturing
                </option>
                <option value="Quality Control">
                  Quality Control
                </option>
                <option value="Warehouse">Warehouse</option>
                <option value="In Transit">In Transit</option>
                <option value="Distribution">
                  Distribution
                </option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {(searchTerm || statusFilter !== "all") && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-700">
            <span className="text-xs text-slate-500">Active filters:</span>
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-xs">
                Search: "{searchTerm}"
                <button
                  onClick={() => setSearchTerm("")}
                  className="hover:text-blue-300 transition-colors"
                  aria-label="Remove search filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-xs">
                Status: {statusFilter}
                <button
                  onClick={() => setStatusFilter("all")}
                  className="hover:text-blue-300 transition-colors"
                  aria-label="Remove status filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
              }}
              className="text-xs text-slate-400 hover:text-slate-300 transition-colors underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Showing <span className="font-semibold text-slate-300">{filteredShipments.length}</span> of{" "}
          <span className="font-semibold text-slate-300">{shipments.length}</span> shipments
          {filteredShipments.length !== shipments.length && (
            <span className="ml-2 text-slate-500">
              ({shipments.length - filteredShipments.length} hidden by filters)
            </span>
          )}
        </p>
      </div>

      {/* Shipments Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto -mx-6 sm:mx-0">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton rows={5} />
            </div>
          ) : (
            <table className="w-full" role="table" aria-label="Shipments list">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Shipment ID</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Category</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Route</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Last Update</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 px-6">
                    <div className="flex flex-col items-center justify-center">
                      <Package className="w-12 h-12 text-slate-600 mb-4 opacity-50" />
                      <p className="text-slate-400 font-medium mb-2">
                        {shipments.length === 0 ? "No shipments found" : "No shipments match your filters"}
                      </p>
                      <p className="text-sm text-slate-500">
                        {shipments.length === 0
                          ? "Create your first shipment to get started"
                          : "Try adjusting your search or filter criteria"}
                      </p>
                      {searchTerm || statusFilter !== "all" ? (
                        <button
                          onClick={() => {
                            setSearchTerm("");
                            setStatusFilter("all");
                          }}
                          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                        >
                          Clear Filters
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shipment) => (
                  <tr
                    key={shipment.id}
                    className="hover:bg-slate-800/50 transition-colors border-b border-slate-800/50"
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-blue-400 text-sm">
                        {shipment.id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-slate-300 font-medium">
                          {shipment.description}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {shipment.quantity}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 md:hidden">
                          {shipment.category}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-slate-400 text-sm capitalize">
                        {shipment.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-slate-400 text-xs truncate">
                            {shipment.origin}
                          </p>
                          <p className="text-slate-600 text-xs">
                            ↓
                          </p>
                          <p className="text-slate-400 text-xs truncate">
                            {shipment.destination}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs whitespace-nowrap ${getStatusColor(shipment.status)}`}
                        role="status"
                        aria-label={`Status: ${shipment.status}`}
                      >
                        {getStatusIcon(shipment.status)}
                        <span>{shipment.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{shipment.lastUpdate}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() =>
                          onViewDetails(shipment.id)
                        }
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 rounded px-2 py-1"
                        aria-label={`View details for ${shipment.id}`}
                      >
                        <span className="hidden sm:inline">View Details →</span>
                        <span className="sm:hidden">View →</span>
                      </button>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

