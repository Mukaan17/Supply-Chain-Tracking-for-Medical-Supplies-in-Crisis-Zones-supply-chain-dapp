import React from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, CircleDot, Package, Ship, Warehouse, ClipboardCheck, PackageCheck, Home, Thermometer, MapPin, AlertTriangle } from 'lucide-react';

const STATUS_ICONS = {
  'created': ClipboardCheck,
  'processed': Package,
  'picked': Warehouse,
  'in-transit': Ship,
  'delivered': PackageCheck,
  'received': Home,
  'temperature-update': Thermometer,
  'location-update': MapPin,
  'alert': AlertTriangle,
};

export default function PackageTimeline({ items = [], className = '' }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
      },
    },
  };

  const StatusIcon = ({ status, customIcon }) => {
    if (customIcon) {
      return <>{customIcon}</>;
    }

    const IconComponent = STATUS_ICONS[status?.toLowerCase()] || Circle;

    switch (status) {
      case 'completed':
      case 'delivered':
      case 'received':
        return <Check className="h-4 w-4 text-white" />;
      case 'in-progress':
      case 'in-transit':
        return <CircleDot className="h-4 w-4 text-primary-600" />;
      default:
        if (IconComponent !== Circle) {
          return <IconComponent className="h-4 w-4 text-neutral-400" />;
        }
        return <Circle className="h-4 w-4 text-neutral-300" />;
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className={`rounded-xl border border-neutral-200 bg-white p-6 ${className}`}>
        <p className="text-center text-neutral-500">No timeline data available</p>
      </div>
    );
  }

  return (
    <motion.ol
      className={`relative border-l-2 border-neutral-200 ml-4 ${className}`}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {items.map((item, index) => {
        const isCompleted = item.status === 'completed' || item.status === 'delivered';
        const isInProgress = item.status === 'in-progress' || item.status === 'in-transit';
        const isPending = item.status === 'pending';

        const statusConfig = isCompleted
          ? { bg: 'bg-success-500', ring: 'ring-success-100', text: 'text-success-700' }
          : isInProgress
          ? { bg: 'bg-primary-500', ring: 'ring-primary-100', text: 'text-primary-700' }
          : { bg: 'bg-neutral-300', ring: 'ring-neutral-50', text: 'text-neutral-500' };

        return (
          <motion.li
            key={item.id || index}
            className="mb-8 ml-8 relative"
            variants={itemVariants}
            aria-current={isInProgress ? 'step' : undefined}
          >
            {/* Icon Circle */}
            <span
              className={`absolute -left-5 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-white ${statusConfig.bg} ${statusConfig.ring} shadow-sm`}
            >
              {/* Pulsing animation for in-progress */}
              {isInProgress && (
                <span className="absolute h-full w-full animate-ping rounded-full bg-primary-500/30 opacity-75" />
              )}
              <StatusIcon status={item.status} customIcon={item.icon} />
            </span>

            {/* Content */}
            <div className="flex flex-col pt-1">
              <h3
                className={`font-semibold text-base mb-1 ${
                  isPending ? 'text-neutral-500' : 'text-neutral-900'
                }`}
              >
                {item.title}
              </h3>
              {item.description && (
                <p className="text-sm text-neutral-600 mb-2">{item.description}</p>
              )}
              <time
                className={`text-sm ${
                  isInProgress ? 'font-medium text-primary-700' : 'text-neutral-500'
                }`}
              >
                {item.date}
              </time>
              {item.metadata && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(item.metadata).map(([key, value]) => (
                    <span
                      key={key}
                      className="inline-flex items-center px-2 py-1 rounded-md bg-neutral-100 text-neutral-700 text-xs font-medium"
                    >
                      {key}: {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}

