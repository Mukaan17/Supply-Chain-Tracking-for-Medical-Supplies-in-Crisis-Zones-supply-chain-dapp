import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, QrCode, Package, MapPin, Thermometer, Droplets, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';

export default function PackageTrackerCard({ packageData, onTrackClick, className = '' }) {
  const [qrCodeUrl, setQrCodeUrl] = React.useState(null);

  React.useEffect(() => {
    if (packageData?.id) {
      const trackingUrl = `${window.location.origin}/track/${packageData.id}`;
      QRCode.toDataURL(trackingUrl, { width: 128, margin: 1 }, (err, url) => {
        if (!err) setQrCodeUrl(url);
      });
    }
  }, [packageData?.id]);

  const STATUS_LABELS = {
    0: 'Created',
    1: 'In Transit',
    2: 'Delivered',
  };

  const STATUS_COLORS = {
    0: { bg: 'bg-primary-100', text: 'text-primary-800', border: 'border-primary-200' },
    1: { bg: 'bg-warning-100', text: 'text-warning-800', border: 'border-warning-200' },
    2: { bg: 'bg-success-100', text: 'text-success-800', border: 'border-success-200' },
  };

  const status = packageData?.status ?? 0;
  const statusConfig = STATUS_COLORS[status] || STATUS_COLORS[0];

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (!packageData) return null;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`w-full max-w-md overflow-hidden rounded-2xl border ${statusConfig.border} bg-white shadow-lg ${className}`}
    >
      {/* Top Section - Status Button */}
      <div className="p-4 bg-gradient-to-r from-neutral-50 to-neutral-100">
        <motion.button
          variants={itemVariants}
          onClick={onTrackClick}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-all hover:bg-primary-50 hover:text-primary-700 hover:shadow-sm border border-neutral-200"
        >
          <CheckCircle2 className="h-4 w-4 text-success-500" />
          Show full tracking
        </motion.button>
      </div>

      {/* Package Image Section */}
      <motion.div variants={itemVariants} className="relative flex h-48 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100">
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGZpbGw9IiM5Y2EzYWYiIGN4PSIyMCIgY3k9IjIwIiByPSIxLjUiLz48L2c+PC9zdmc+')] opacity-20"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className={`w-20 h-20 ${statusConfig.bg} rounded-2xl flex items-center justify-center shadow-lg border-2 ${statusConfig.border}`}>
            <Package className={`w-10 h-10 ${statusConfig.text}`} />
          </div>
          <div className="text-center">
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Package</div>
            <div className="text-lg font-bold text-neutral-900">#{packageData.id}</div>
          </div>
        </div>
      </motion.div>

      {/* Details Section */}
      <div className="p-6 bg-white">
        {/* Status Badge */}
        <motion.div variants={itemVariants} className="mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border} text-sm font-semibold`}>
            <div className={`w-2 h-2 rounded-full ${status === 0 ? 'bg-primary-500' : status === 1 ? 'bg-warning-500' : 'bg-success-500'}`}></div>
            {STATUS_LABELS[status]}
          </div>
        </motion.div>

        {/* Title */}
        <motion.h2 variants={itemVariants} className="text-2xl font-bold tracking-tight text-neutral-900 mb-2">
          {packageData.description || 'Medical Supply Package'}
        </motion.h2>

        {/* Metadata Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3 mb-6">
          {packageData.temperature !== undefined && (
            <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg">
              <Thermometer className="w-4 h-4 text-neutral-600" />
              <div>
                <div className="text-xs text-neutral-500">Temperature</div>
                <div className="text-sm font-semibold text-neutral-900">{packageData.temperature}°C</div>
              </div>
            </div>
          )}
          {packageData.humidity !== undefined && (
            <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg">
              <Droplets className="w-4 h-4 text-neutral-600" />
              <div>
                <div className="text-xs text-neutral-500">Humidity</div>
                <div className="text-sm font-semibold text-neutral-900">{packageData.humidity}%</div>
              </div>
            </div>
          )}
          {packageData.location && (
            <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg col-span-2">
              <MapPin className="w-4 h-4 text-neutral-600" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-neutral-500">Location</div>
                <div className="text-sm font-semibold text-neutral-900 truncate">{packageData.location}</div>
              </div>
            </div>
          )}
          {packageData.alertLevel !== undefined && packageData.alertLevel > 0 && (
            <div className="flex items-center gap-2 p-2 bg-danger-50 rounded-lg col-span-2 border border-danger-200">
              <AlertTriangle className="w-4 h-4 text-danger-600" />
              <div>
                <div className="text-xs text-danger-600 font-medium">Alert Level</div>
                <div className="text-sm font-semibold text-danger-800">
                  {packageData.alertLevel === 1 ? 'Warning' : 'Critical'}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Package Info and QR Code */}
        <div className="flex items-end justify-between pt-4 border-t border-neutral-200">
          <motion.div variants={itemVariants} className="space-y-1">
            <p className="text-xs text-neutral-500 font-medium">Package Number</p>
            <p className="font-mono text-sm font-semibold text-neutral-900">{packageData.id}</p>
            {packageData.createdAt && (
              <p className="text-xs text-neutral-500">
                {new Date(packageData.createdAt * 1000).toLocaleDateString()}
              </p>
            )}
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="rounded-lg border-2 border-neutral-200 p-2 bg-white shadow-sm"
          >
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center bg-neutral-100 rounded">
                <QrCode className="h-8 w-8 text-neutral-400" />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

