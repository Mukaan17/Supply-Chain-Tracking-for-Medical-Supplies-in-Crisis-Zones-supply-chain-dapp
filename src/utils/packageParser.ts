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
 * Get category prefix for shipment ID generation
 * Maps category names to short prefixes (e.g., "Pharmaceuticals" -> "PHAR")
 */
function getCategoryPrefix(category?: string): string {
  if (!category) return 'MED'; // Default fallback
  
  const categoryLower = category.toLowerCase().trim();
  
  // Map common category names to prefixes
  const categoryMap: { [key: string]: string } = {
    'pharmaceuticals': 'PHAR',
    'pharmaceutical': 'PHAR',
    'medical equipment': 'EQUIP',
    'equipment': 'EQUIP',
    'medical supplies': 'SUPPLY',
    'supplies': 'SUPPLY',
    'vaccines': 'VACC',
    'vaccine': 'VACC',
    'blood products': 'BLOOD',
    'blood': 'BLOOD',
    'surgical instruments': 'SURG',
    'surgical': 'SURG',
    'diagnostic equipment': 'DIAG',
    'diagnostic': 'DIAG',
    'personal protective equipment': 'PPE',
    'ppe': 'PPE',
    'medications': 'MED',
    'medication': 'MED',
  };
  
  // Check for exact match first
  if (categoryMap[categoryLower]) {
    return categoryMap[categoryLower];
  }
  
  // Check for partial matches
  for (const [key, prefix] of Object.entries(categoryMap)) {
    if (categoryLower.includes(key) || key.includes(categoryLower)) {
      return prefix;
    }
  }
  
  // If no match, generate prefix from first 4 uppercase letters of category
  const words = category.split(/\s+/);
  if (words.length > 1) {
    // Multi-word: take first letter of each word (up to 4)
    return words.slice(0, 4).map(w => w.charAt(0).toUpperCase()).join('');
  } else {
    // Single word: take first 4 uppercase letters
    return category.slice(0, 4).toUpperCase().padEnd(4, 'X');
  }
}

/**
 * Generate shipment ID from category, year, and package ID
 * Format: {CATEGORY_PREFIX}-{YEAR}-{PACKAGE_ID}
 * Example: PHAR-2025-001, EQUIP-2025-042
 */
function generateShipmentId(
  category: string | undefined,
  year: number,
  packageId: string
): string {
  const prefix = getCategoryPrefix(category);
  const paddedId = packageId.padStart(3, '0');
  return `${prefix}-${year}-${paddedId}`;
}

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

  // Extract year from timestamp or use current year as fallback
  const year = createdAtTimestamp 
    ? new Date(createdAtTimestamp * 1000).getFullYear()
    : new Date().getFullYear();
  
  const category = parsed.category || 'pharmaceuticals';

  return {
    id: generateShipmentId(category, year, packageId),
    description: parsed.description,
    category: category,
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

/**
 * Format package from event data (PackageCreated + optional PackageStatusUpdated)
 * This avoids the tuple decoding issue with getPackageDetails
 */
export function formatPackageFromEvents(
  createdEvent: { 
    id: bigint; 
    description: string; 
    creator: string; 
    timestamp: bigint;
  },
  statusUpdate?: { 
    newStatus: number | bigint; 
    timestamp: bigint;
  },
  temperature?: number,
  currentOwner?: string // Current owner from PackageTransferred events, defaults to creator
): ParsedPackage {
  const packageId = createdEvent.id.toString();
  const statusNum = statusUpdate 
    ? (typeof statusUpdate.newStatus === 'bigint' ? Number(statusUpdate.newStatus) : Number(statusUpdate.newStatus))
    : 0; // Default to Manufacturing (0) if no status update
  const statusLabel = STATUS_MAP[statusNum] || 'Manufacturing';
  
  const parsed = parseDescription(createdEvent.description);
  
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

  const createdTimestamp = Number(createdEvent.timestamp);
  const createdStr = formatTimestamp(createdEvent.timestamp);
  
  // Use status update timestamp if available, otherwise use creation timestamp
  const lastUpdatedTimestamp = statusUpdate 
    ? Number(statusUpdate.timestamp)
    : createdTimestamp;
  const updatedStr = formatTimestamp(statusUpdate?.timestamp || createdEvent.timestamp);

  // Extract year from creation timestamp
  const year = createdTimestamp > 0
    ? new Date(createdTimestamp * 1000).getFullYear()
    : new Date().getFullYear();
  
  const category = parsed.category || 'pharmaceuticals';

  return {
    id: generateShipmentId(category, year, packageId),
    description: parsed.description,
    category: category,
    origin: parsed.origin || 'Unknown',
    destination: parsed.destination || 'Unknown',
    quantity: parsed.quantity || '1 unit',
    temperature: temperature, // From TemperatureUpdated events
    temperatureString: parsed.temperature, // From description parsing
    expectedDate: parsed.expectedDate,
    handler: parsed.handler,
    notes: parsed.notes,
    owner: currentOwner || createdEvent.creator, // Use current owner from transfers, or creator if never transferred
    status: statusLabel,
    createdAt: createdStr,
    createdAtTimestamp: createdTimestamp,
    lastUpdate: updatedStr,
    lastUpdatedAt: lastUpdatedTimestamp,
  };
}

