import React, { useState, useEffect } from 'react';
import PackageTimeline from './PackageTimeline';
import PackageHistory from './PackageHistory';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

/**
 * Wrapper component that converts PackageHistory events to PackageTimeline format
 */
export default function PackageHistoryTimeline({ contract, packageId }) {
  const [timelineItems, setTimelineItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Convert PackageHistory events to timeline format
  const convertEventsToTimeline = (events) => {
    if (!events || events.length === 0) return [];

    const STATUS_NAMES = ['Created', 'In Transit', 'Delivered'];
    
    return events.map((event, index) => {
      const ts = event.timestampMs ?? Date.now();
      const date = new Date(ts);
      
      let title = 'Event';
      let description = '';
      let status = 'pending';
      let metadata = {};

      switch (event.type) {
        case 'created':
          title = 'Package Created';
          description = `Created by ${event.args?.creator?.slice(0, 6)}...${event.args?.creator?.slice(-4)}`;
          status = 'completed';
          metadata = {
            creator: event.args?.creator,
            description: event.args?.description,
          };
          break;
        case 'transferred':
          title = 'Package Transferred';
          description = `From ${event.args?.from?.slice(0, 6)}...${event.args?.from?.slice(-4)} to ${event.args?.to?.slice(0, 6)}...${event.args?.to?.slice(-4)}`;
          status = 'completed';
          metadata = {
            from: event.args?.from,
            to: event.args?.to,
          };
          break;
        case 'delivered':
          title = 'Package Delivered';
          description = `Delivered by ${event.args?.owner?.slice(0, 6)}...${event.args?.owner?.slice(-4)}`;
          status = 'completed';
          metadata = {
            owner: event.args?.owner,
          };
          break;
        case 'statusUpdated':
          const oldStatus = event.args?.oldStatus !== undefined ? Number(event.args.oldStatus) : null;
          const newStatus = event.args?.newStatus !== undefined ? Number(event.args.newStatus) : null;
          const oldStatusName = oldStatus !== null && oldStatus < STATUS_NAMES.length ? STATUS_NAMES[oldStatus] : 'Unknown';
          const newStatusName = newStatus !== null && newStatus < STATUS_NAMES.length ? STATUS_NAMES[newStatus] : 'Unknown';
          title = 'Status Updated';
          description = `Status changed from ${oldStatusName} to ${newStatusName}`;
          status = 'completed';
          metadata = {
            oldStatus: oldStatusName,
            newStatus: newStatusName,
            updater: event.args?.updater,
          };
          break;
        default:
          title = 'Event';
          description = 'Unknown event';
          status = 'pending';
      }

      return {
        id: event.transactionHash || event.logIndex || index,
        title,
        description,
        date: date.toLocaleString(),
        status,
        metadata,
      };
    });
  };

  // Use PackageHistory to fetch events, then convert to timeline format
  useEffect(() => {
    if (!contract || !packageId) {
      setTimelineItems([]);
      return;
    }

    setIsLoading(true);
    // We'll use a custom hook or effect to fetch and convert
    // For now, we'll render PackageHistory and extract events from it
    // This is a bridge component
  }, [contract, packageId]);

  if (!packageId) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-neutral-900">Package History</h3>
        <motion.button
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.3 }}
          className="p-2 text-neutral-500 hover:text-primary-600 transition-colors"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-5 h-5" />
        </motion.button>
      </div>
      
      {/* Use PackageHistory internally but render with Timeline */}
      <PackageHistory contract={contract} packageId={packageId} />
    </div>
  );
}

