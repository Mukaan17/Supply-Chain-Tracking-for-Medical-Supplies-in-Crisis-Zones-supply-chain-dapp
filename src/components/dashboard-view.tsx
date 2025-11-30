import {
    Package,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Thermometer,
    Circle,
    Warehouse,
    Truck,
    Building2,
  } from "lucide-react";
  import { StatCardSkeleton } from "./SkeletonLoader";
  import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
  } from "recharts";
  
  interface DashboardStats {
    totalShipments: number;
    inTransit: number;
    delivered: number;
    delayed: number;
  }
  
  interface DashboardViewProps {
    stats: DashboardStats;
    recentShipments: any[];
    onViewShipment: (id: string) => void;
    isLoading?: boolean;
  }
  
  export function DashboardView({
    stats,
    recentShipments,
    onViewShipment,
    isLoading = false,
  }: DashboardViewProps) {
    // Calculate percentage changes from previous day
    const calculatePercentageChange = (todayCount: number, yesterdayCount: number): string => {
      if (yesterdayCount === 0) {
        if (todayCount === 0) return "0%";
        // If we have data today but none yesterday, show as new
        return `+${Math.min(todayCount * 100, 999)}%`; // Cap at 999% to avoid huge numbers
      }
      const change = ((todayCount - yesterdayCount) / yesterdayCount) * 100;
      const sign = change >= 0 ? "+" : "";
      return `${sign}${Math.round(change)}%`;
    };

    // Get today's and yesterday's timestamps (start of day in UTC)
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    
    const todayStartTimestamp = Math.floor(todayStart.getTime() / 1000);
    const yesterdayStartTimestamp = Math.floor(yesterdayStart.getTime() / 1000);
    const todayEndTimestamp = todayStartTimestamp + 86400; // 24 hours later

    // Filter shipments by date
    const todayShipments = recentShipments.filter(s => {
      if (!s.createdAtTimestamp) return false;
      return s.createdAtTimestamp >= todayStartTimestamp && s.createdAtTimestamp < todayEndTimestamp;
    });

    const yesterdayShipments = recentShipments.filter(s => {
      if (!s.createdAtTimestamp) return false;
      const yesterdayEndTimestamp = yesterdayStartTimestamp + 86400;
      return s.createdAtTimestamp >= yesterdayStartTimestamp && s.createdAtTimestamp < yesterdayEndTimestamp;
    });

    // Calculate today's metrics
    const todayTotal = todayShipments.length;
    const todayInTransit = todayShipments.filter(s => s.status === "In Transit").length;
    const todayDelivered = todayShipments.filter(s => s.status === "Delivered").length;

    // Calculate yesterday's metrics
    const yesterdayTotal = yesterdayShipments.length;
    const yesterdayInTransit = yesterdayShipments.filter(s => s.status === "In Transit").length;
    const yesterdayDelivered = yesterdayShipments.filter(s => s.status === "Delivered").length;
    
    // Calculate alerts for today and yesterday
    const calculateAlerts = (shipmentList: any[]) => {
      return shipmentList.filter(s => {
        // Check for alerts: past expected date, temperature violations, etc.
        if (s.status === 'In Transit' && s.expectedDate) {
          const expected = new Date(s.expectedDate);
          const now = new Date();
          if (expected < now) return true;
        }
        // Temperature violations (outside 2-8°C range for medical supplies)
        if (s.temperature !== undefined && s.temperature !== null) {
          if (s.temperature < 2 || s.temperature > 8) return true;
        }
        return false;
      }).length;
    };
    
    const todayAlerts = calculateAlerts(todayShipments);
    const yesterdayAlerts = calculateAlerts(yesterdayShipments);

    // Calculate percentage changes
    const totalChange = calculatePercentageChange(todayTotal, yesterdayTotal);
    const inTransitChange = calculatePercentageChange(todayInTransit, yesterdayInTransit);
    const deliveredChange = calculatePercentageChange(todayDelivered, yesterdayDelivered);
    const alertsChange = calculatePercentageChange(todayAlerts, yesterdayAlerts);

    // Generate chart data from recent shipments
    const hasShipments = recentShipments.length > 0;
    const chartData = [
      { name: "Mon", shipments: 0 },
      { name: "Tue", shipments: 0 },
      { name: "Wed", shipments: 0 },
      { name: "Thu", shipments: 0 },
      { name: "Fri", shipments: 0 },
      { name: "Sat", shipments: 0 },
      { name: "Sun", shipments: 0 },
    ];

    // Group shipments by day of week based on creation timestamp from blockchain
    if (hasShipments) {
      recentShipments.forEach((shipment) => {
        let date: Date | null = null;
        
        // Use the raw timestamp if available (from blockchain)
        if (shipment.createdAtTimestamp) {
          date = new Date(shipment.createdAtTimestamp * 1000); // Convert from Unix timestamp
        } else if (shipment.createdAt) {
          // Fallback: try to parse createdAt string
          const parsed = new Date(shipment.createdAt);
          if (!isNaN(parsed.getTime())) {
            date = parsed;
          }
        }

        if (date && !isNaN(date.getTime())) {
          const dayOfWeek = date.getDay();
          const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const dayName = dayNames[dayOfWeek];
          const dayIndex = chartData.findIndex((d) => d.name === dayName);
          if (dayIndex !== -1) {
            chartData[dayIndex].shipments += 1;
          }
        }
      });
    }
  
    // Generate temperature data from recent shipments
    // Get shipments with temperature data, sorted by lastUpdatedAt (most recent first)
    const shipmentsWithTemp = recentShipments
      .filter(s => s.temperature !== undefined && s.temperature !== null)
      .sort((a, b) => (b.lastUpdatedAt || 0) - (a.lastUpdatedAt || 0));

    // Calculate current average temperature for display
    const hasTemperatureData = shipmentsWithTemp.length > 0;
    const currentTemp = hasTemperatureData
      ? shipmentsWithTemp.reduce((sum, s) => sum + (s.temperature || 0), 0) / shipmentsWithTemp.length
      : 0;

    // Generate temperature chart data - only if we have actual data
    const temperatureData: Array<{ time: string; temp: number }> = [];
    
    if (hasTemperatureData) {
      // Use actual temperature readings, grouped by time of day
      const now = new Date();
      const timeSlots = [
        { label: "00:00", hoursAgo: 24 },
        { label: "04:00", hoursAgo: 20 },
        { label: "08:00", hoursAgo: 16 },
        { label: "12:00", hoursAgo: 12 },
        { label: "16:00", hoursAgo: 8 },
        { label: "20:00", hoursAgo: 4 },
      ];

      timeSlots.forEach(slot => {
        const slotTime = now.getTime() - (slot.hoursAgo * 60 * 60 * 1000);
        const slotEndTime = slotTime + (4 * 60 * 60 * 1000); // 4 hour window
        
        // Find shipments updated within this time slot
        const readingsInSlot = shipmentsWithTemp.filter(s => {
          if (!s.lastUpdatedAt) return false;
          const updateTime = s.lastUpdatedAt * 1000; // Convert to milliseconds
          return updateTime >= slotTime && updateTime < slotEndTime;
        });

        // Calculate average temperature for this slot
        let avgTemp = currentTemp; // Default to current average
        if (readingsInSlot.length > 0) {
          const temps = readingsInSlot
            .map(s => s.temperature)
            .filter((t): t is number => t !== undefined && t !== null);
          if (temps.length > 0) {
            avgTemp = temps.reduce((sum, t) => sum + t, 0) / temps.length;
          }
        }

        temperatureData.push({
          time: slot.label,
          temp: Math.round(avgTemp * 10) / 10, // Round to 1 decimal
        });
      });
    } else {
      // Show empty time slots when no data
      const timeSlots = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"];
      timeSlots.forEach(time => {
        temperatureData.push({ time, temp: 0 });
      });
    }
  
    const statCards = [
      {
        label: "Total Shipments",
        value: stats.totalShipments,
        icon: Package,
        color: "blue",
        change: totalChange,
      },
      {
        label: "In Transit",
        value: stats.inTransit,
        icon: TrendingUp,
        color: "cyan",
        change: inTransitChange,
      },
      {
        label: "Delivered",
        value: stats.delivered,
        icon: CheckCircle2,
        color: "green",
        change: deliveredChange,
      },
      {
        label: "Alerts",
        value: stats.delayed,
        icon: AlertTriangle,
        color: "orange",
        change: alertsChange,
      },
    ];
  
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
  
    const getColorClass = (color: string) => {
      const colors = {
        blue: "bg-blue-500/10 text-blue-400",
        cyan: "bg-cyan-500/10 text-cyan-400",
        green: "bg-green-500/10 text-green-400",
        orange: "bg-orange-500/10 text-orange-400",
        purple: "bg-purple-500/10 text-purple-400",
      };
      return colors[color as keyof typeof colors] || colors.blue;
    };
  
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h2 className="text-white mb-1">
            Supply Chain Dashboard
          </h2>
          <p className="text-slate-400 text-sm">
            Monitor and track your medical supply shipments in
            real-time
          </p>
        </div>
  
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" role="region" aria-label="Dashboard statistics">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))
          ) : (
            statCards.map((stat) => {
            const Icon = stat.icon;
            // Determine if change is positive, negative, or neutral
            const changeStr = stat.change.replace('%', '');
            const changeValue = parseFloat(changeStr.replace(/[+-]/g, ''));
            const isPositive = changeStr.startsWith('+') && changeValue > 0;
            const isNegative = changeStr.startsWith('-') || changeValue < 0;
            const isNeutral = changeValue === 0 || stat.change === '0%';
            const changeColorClass = isPositive 
              ? "text-green-400 bg-green-500/10" 
              : isNegative 
              ? "text-red-400 bg-red-500/10"
              : "text-slate-400 bg-slate-500/10";
            
            return (
              <div key={stat.label} className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`p-2.5 rounded-lg ${getColorClass(stat.color)}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs ${changeColorClass} px-2 py-1 rounded`}>
                    {stat.change}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-white mb-1">
                    {stat.value}
                  </p>
                  <p className="text-sm text-slate-400">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          }))}
        </div>
  
        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shipment Volume */}
          <div className="card p-6">
            <div className="mb-6">
              <h3 className="text-white mb-1">Shipment Volume</h3>
              <p className="text-sm text-slate-400">
                Weekly shipment trends
              </p>
            </div>
            {hasShipments ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={12}
                  />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "2px solid #334155",
                    borderRadius: "8px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                    padding: "8px 12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
                  }}
                  cursor={{ fill: "#334155" }}
                />
                <Bar
                  dataKey="shipments"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-slate-500">
                <div className="text-center">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No shipment data available</p>
                  <p className="text-xs mt-1 text-slate-600">
                    Create packages to start tracking shipment volume
                  </p>
                </div>
              </div>
            )}
          </div>
  
          {/* Temperature Monitoring */}
          <div className="card p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white mb-1">
                    Temperature Monitoring
                  </h3>
                  <p className="text-sm text-slate-400">
                    Cold chain compliance (PKG-045)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-cyan-400">
                  <Thermometer className="w-4 h-4" />
                  <span className="text-sm">
                    {hasTemperatureData ? `${currentTemp.toFixed(1)}°C` : 'No data'}
                  </span>
                </div>
              </div>
            </div>
            {hasTemperatureData ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={temperatureData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                  />
                  <XAxis
                    dataKey="time"
                    stroke="#94a3b8"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    domain={[0, 8]}
                  />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "2px solid #334155",
                    borderRadius: "8px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                    padding: "8px 12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
                  }}
                  cursor={{ fill: "#334155" }}
                />
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={{ fill: "#22d3ee", r: 4 }}
                />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-slate-500">
                <div className="text-center">
                  <Thermometer className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No temperature data available</p>
                  <p className="text-xs mt-1 text-slate-600">
                    Create packages to start tracking temperature
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
  
        {/* Recent Shipments */}
        <div className="card">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-white">Recent Shipments</h3>
            <p className="text-sm text-slate-400 mt-1">
              Latest updates from your supply chain
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Shipment ID</th>
                  <th>Description</th>
                  <th>Origin → Destination</th>
                  <th>Status</th>
                  <th>Last Update</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentShipments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <p className="text-slate-500">No shipments found</p>
                    </td>
                  </tr>
                ) : (
                  recentShipments.slice(0, 5).map((shipment) => (
                    <tr
                      key={shipment.id}
                      className="hover:bg-slate-800/50 transition-colors"
                    >
                      <td>
                        <span className="font-mono text-blue-400">
                          {shipment.id}
                        </span>
                      </td>
                      <td>
                        <span className="text-slate-300">
                          {shipment.description}
                        </span>
                      </td>
                      <td>
                        <div className="text-sm">
                          <span className="text-slate-400">
                            {shipment.origin}
                          </span>
                          <span className="text-slate-600 mx-2">
                            →
                          </span>
                          <span className="text-slate-400">
                            {shipment.destination}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs ${getStatusColor(shipment.status)}`}
                          role="status"
                          aria-label={`Status: ${shipment.status}`}
                        >
                          {getStatusIcon(shipment.status)}
                          <span>{shipment.status}</span>
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Clock className="w-3.5 h-3.5" />
                          {shipment.lastUpdate}
                        </div>
                      </td>
                      <td>
                      <button
                        onClick={() =>
                          onViewShipment(shipment.id)
                        }
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 rounded px-2 py-1"
                        aria-label={`View details for ${shipment.id}`}
                      >
                        View Details →
                      </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

