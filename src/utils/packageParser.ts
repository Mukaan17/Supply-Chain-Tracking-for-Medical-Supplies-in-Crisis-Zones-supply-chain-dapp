/**
 * Utility to parse package description strings into structured data
 * The description format is: "Description | Category: X | Quantity: Y | Origin: Z | ..."
 */

export interface ParsedPackage {
  id: string;
  description: string;
  category?: string;
  origin?: string;
  destination?: string;
  quantity?: string;
  temperature?: number; // Temperature from blockchain (int8)
  temperatureString?: string; // Temperature from description parsing
  expectedDate?: string;
  handler?: string;
  notes?: string;
  owner: string;
  status: string;
  createdAt: string;
  createdAtTimestamp?: number; // Raw timestamp for date calculations
  lastUpdate: string;
  lastUpdatedAt?: number; // Timestamp for sorting
}

const STATUS_MAP: { [key: number]: string } = {
  0: 'Manufacturing',
  1: 'Quality Control',
  2: 'Warehouse',
  3: 'In Transit',
  4: 'Distribution',
  5: 'Delivered',
};

/**
 * Parse a description string into structured fields
 */
export function parseDescription(description: string): {
  description: string;
  category?: string;
  quantity?: string;
  origin?: string;
  destination?: string;
  handler?: string;
  temperature?: string;
  expectedDate?: string;
  notes?: string;
} {
  const parts = description.split(' | ');
  const result: any = {
    description: parts[0] || description,
  };

  parts.slice(1).forEach((part) => {
    const [key, ...valueParts] = part.split(': ');
    const value = valueParts.join(': ').trim();
    
    switch (key.toLowerCase()) {
      case 'category':
        result.category = value;
        break;
      case 'quantity':
        result.quantity = value;
        break;
      case 'origin':
        result.origin = value;
        break;
      case 'destination':
        result.destination = value;
        break;
      case 'handler':
        result.handler = value;
        break;
      case 'temperature':
        result.temperature = value;
        break;
      case 'expected date':
        result.expectedDate = value;
        break;
      case 'notes':
        result.notes = value;
        break;
    }
  });

  return result;
}

/**
 * Convert blockchain package data to UI format
 */
export function formatPackage(
  id: bigint | string | number,
  description: string,
  creator: string,
  currentOwner: string,
  status: number | bigint,
  createdAt: bigint | number | null,
  lastUpdatedAt: bigint | number | null,
  temperature?: bigint | number | null,
): ParsedPackage {
  const packageId = typeof id === 'bigint' ? id.toString() : String(id);
  const statusNum = typeof status === 'bigint' ? Number(status) : Number(status);
  const statusLabel = STATUS_MAP[statusNum] || 'Manufacturing';
  
  const parsed = parseDescription(description);
  
  // Format timestamps
  const formatTimestamp = (timestamp: bigint | number | null): string => {
    if (!timestamp) return 'Unknown';
    const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
    if (ts === 0) return 'Unknown';
    
    const date = new Date(ts * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const createdStr = formatTimestamp(createdAt);
  const updatedStr = formatTimestamp(lastUpdatedAt);
  
  // Convert temperature from blockchain (int8) to number
  let tempValue: number | undefined;
  if (temperature !== undefined && temperature !== null) {
    const temp = typeof temperature === 'bigint' ? Number(temperature) : temperature;
    tempValue = temp;
  }

  const lastUpdatedTimestamp = lastUpdatedAt 
    ? (typeof lastUpdatedAt === 'bigint' ? Number(lastUpdatedAt) : lastUpdatedAt)
    : undefined;

  const createdAtTimestamp = createdAt 
    ? (typeof createdAt === 'bigint' ? Number(createdAt) : createdAt)
    : undefined;

  return {
    id: `MED-2025-${packageId.padStart(3, '0')}`,
    description: parsed.description,
    category: parsed.category || 'pharmaceuticals',
    origin: parsed.origin || 'Unknown',
    destination: parsed.destination || 'Unknown',
    quantity: parsed.quantity || '1 unit',
    temperature: tempValue, // From blockchain
    temperatureString: parsed.temperature, // From description parsing
    expectedDate: parsed.expectedDate,
    handler: parsed.handler,
    notes: parsed.notes,
    owner: currentOwner || creator,
    status: statusLabel,
    createdAt: createdStr,
    createdAtTimestamp: createdAtTimestamp,
    lastUpdate: updatedStr,
    lastUpdatedAt: lastUpdatedTimestamp,
  };
}

