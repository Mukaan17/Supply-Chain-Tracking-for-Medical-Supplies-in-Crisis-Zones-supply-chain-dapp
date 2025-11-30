import {
    Package,
    LayoutDashboard,
    List,
    Plus,
    Settings,
    LogOut,
    Users,
    Bell,
    X,
    CheckCircle2,
    XCircle,
    Info,
    AlertTriangle,
    Search,
    Filter,
  } from "lucide-react";
  import { useState, useRef, useEffect } from "react";
  import { useNotifications } from "../contexts/NotificationContext";
  
  interface NavigationProps {
    walletConnected: boolean;
    walletAddress: string;
    currentView: string;
    onConnectWallet: () => void;
    onNavigate: (view: string) => void;
    onDisconnectWallet?: () => void;
    onSwitchAccount?: () => void;
  }
  
  export function Navigation({
    walletConnected,
    walletAddress,
    currentView,
    onConnectWallet,
    onNavigate,
    onDisconnectWallet,
    onSwitchAccount,
  }: NavigationProps) {
    const [showDropdown, setShowDropdown] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notificationFilter, setNotificationFilter] = useState<'all' | 'success' | 'error' | 'info' | 'warning'>('all');
    const [notificationSearch, setNotificationSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const { notifications, removeNotification, clearAllNotifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

    // Filter notifications
    const filteredNotifications = notifications.filter(n => {
      const matchesFilter = notificationFilter === 'all' || n.type === notificationFilter;
      const matchesSearch = !notificationSearch || 
        n.title.toLowerCase().includes(notificationSearch.toLowerCase()) ||
        (n.description && n.description.toLowerCase().includes(notificationSearch.toLowerCase()));
      return matchesFilter && matchesSearch;
    });

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setShowDropdown(false);
        }
        if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
          setShowNotifications(false);
        }
      };

      if (showDropdown || showNotifications) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [showDropdown, showNotifications]);

    const truncateAddress = (address: string) => {
      if (!address) return "";
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const formatTime = (date: Date) => {
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString();
    };

    const getNotificationIcon = (type: string) => {
      switch (type) {
        case 'success':
          return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        case 'error':
          return <XCircle className="w-4 h-4 text-red-500" />;
        case 'warning':
          return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        default:
          return <Info className="w-4 h-4 text-blue-500" />;
      }
    };

    const handleSwitchAccount = async () => {
      if (onSwitchAccount) {
        try {
          await onSwitchAccount();
          setShowDropdown(false);
        } catch (error) {
          // Error handling is done in App.tsx
          setShowDropdown(false);
        }
      }
    };

    const handleDisconnect = () => {
      if (onDisconnectWallet) {
        onDisconnectWallet();
      }
      setShowDropdown(false);
    };
  
    const navItems = [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
      },
      { id: "packages", label: "All Shipments", icon: List },
      { id: "create", label: "New Shipment", icon: Plus },
    ];
  
    return (
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo and Title */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 bg-blue-600 rounded-lg">
                  <Package
                    className="w-5 h-5 text-white"
                    strokeWidth={2.5}
                  />
                </div>
                <div>
                  <h1 className="text-white text-xl">
                    MediChain
                  </h1>
                  <p className="text-xs text-slate-400">
                    Supply Chain Platform
                  </p>
                </div>
              </div>
  
              {/* Navigation Links */}
              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                        isActive
                          ? "bg-slate-800 text-white"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
  
            {/* Right: Wallet Connection */}
            <div className="flex items-center gap-3">
              {walletConnected && (
                <>
                  {/* Notifications Bell */}
                  <div className="relative" ref={notificationsRef}>
                    <button
                      onClick={() => {
                        setShowNotifications(!showNotifications);
                        if (showNotifications) {
                          markAllAsRead();
                        }
                      }}
                      className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                    >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <>
                          {/* Small red circle indicator */}
                          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900"></span>
                          {/* Badge with count */}
                          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-4.5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        </>
                      )}
                    </button>
                    
                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-96 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50 max-h-[600px] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                          <h3 className="text-sm font-semibold text-white">Notifications</h3>
                          <div className="flex items-center gap-2">
                            {notifications.length > 0 && (
                              <button
                                onClick={clearAllNotifications}
                                className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                                aria-label="Clear all notifications"
                              >
                                Clear all
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Search and Filter */}
                        {notifications.length > 0 && (
                          <div className="px-4 py-3 border-b border-slate-700 space-y-2">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                              <input
                                type="text"
                                placeholder="Search notifications..."
                                value={notificationSearch}
                                onChange={(e) => setNotificationSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                aria-label="Search notifications"
                              />
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {(['all', 'success', 'error', 'warning', 'info'] as const).map((type) => (
                                <button
                                  key={type}
                                  onClick={() => setNotificationFilter(type)}
                                  className={`px-2 py-1 rounded text-xs transition-colors ${
                                    notificationFilter === type
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                  }`}
                                  aria-label={`Filter by ${type}`}
                                >
                                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="overflow-y-auto flex-1">
                          {filteredNotifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-slate-400 text-sm">
                              {notifications.length === 0 ? (
                                <>
                                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <p>No notifications</p>
                                </>
                              ) : (
                                <>
                                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <p>No notifications match your filters</p>
                                  <button
                                    onClick={() => {
                                      setNotificationFilter('all');
                                      setNotificationSearch('');
                                    }}
                                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                                  >
                                    Clear filters
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="py-1">
                              {filteredNotifications.map((notification) => (
                                <div
                                  key={notification.id}
                                  className="px-4 py-3 hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-b-0"
                                  onClick={() => markAsRead(notification.id)}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                      {getNotificationIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium text-white">
                                          {notification.title}
                                        </p>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeNotification(notification.id);
                                          }}
                                          className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                      {notification.description && (
                                        <p className="text-xs text-slate-400 mt-1">
                                          {notification.description}
                                        </p>
                                      )}
                                      <p className="text-xs text-slate-500 mt-1">
                                        {formatTime(notification.timestamp)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Settings Gear */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    
                    {showDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50">
                        <div className="py-1">
                          <button
                            onClick={handleSwitchAccount}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                          >
                            <Users className="w-4 h-4" />
                            <span>Switch Account</span>
                          </button>
                          <div className="border-t border-slate-700 my-1"></div>
                          <button
                            onClick={handleDisconnect}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Disconnect Wallet</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
  
              {!walletConnected ? (
                <button
                  onClick={onConnectWallet}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
                >
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Connect Wallet</span>
                </button>
              ) : (
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border border-slate-700 rounded-md">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-slate-300 font-mono">
                    {truncateAddress(walletAddress)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    );
  }
