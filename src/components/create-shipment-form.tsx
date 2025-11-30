import React, { useState, useEffect } from "react";
import {
  Package,
  MapPin,
  User,
  FileText,
  Thermometer,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useContractAddress } from "../hooks/useContract";
import { getContractABI } from "../config/contracts";
import { Address } from "viem";
import { useToastWithNotifications } from "../hooks/useToastWithNotifications";

interface CreateShipmentFormProps {
  onCreateShipment: (shipment: any) => void;
  walletConnected: boolean;
  onNavigate?: (view: string) => void;
}

export function CreateShipmentForm({
  onCreateShipment,
  walletConnected,
  onNavigate,
}: CreateShipmentFormProps) {
  const toast = useToastWithNotifications();
  const [formData, setFormData] = useState({
    description: "",
    category: "pharmaceuticals",
    origin: "",
    destination: "",
    quantity: "",
    temperature: "",
    expectedDate: "",
    handler: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const contractAddress = useContractAddress();
  const abi = getContractABI();
  const { writeContract, isPending, data: writeData } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: writeData,
  });

  // Validation function
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "description":
        if (!value.trim()) return "Description is required";
        if (value.trim().length < 3) return "Description must be at least 3 characters";
        return "";
      case "origin":
        if (!value.trim()) return "Origin location is required";
        return "";
      case "destination":
        if (!value.trim()) return "Destination is required";
        return "";
      case "quantity":
        if (!value.trim()) return "Quantity is required";
        return "";
      case "temperature":
        if (value && !/^[\d\s\-°Cc]+$/.test(value)) {
          return "Please enter a valid temperature (e.g., 2-8°C)";
        }
        return "";
      case "expectedDate":
        if (value) {
          const date = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (date < today) {
            return "Expected date cannot be in the past";
          }
        }
        return "";
      default:
        return "";
    }
  };

  // Build description string from form data
  const buildDescription = () => {
    const parts: string[] = [];
    if (formData.description) parts.push(formData.description);
    if (formData.category) parts.push(`Category: ${formData.category}`);
    if (formData.quantity) parts.push(`Quantity: ${formData.quantity}`);
    if (formData.origin) parts.push(`Origin: ${formData.origin}`);
    if (formData.destination) parts.push(`Destination: ${formData.destination}`);
    if (formData.handler) parts.push(`Handler: ${formData.handler}`);
    if (formData.temperature) parts.push(`Temperature: ${formData.temperature}`);
    if (formData.expectedDate) parts.push(`Expected Date: ${formData.expectedDate}`);
    if (formData.notes) parts.push(`Notes: ${formData.notes}`);
    return parts.join(" | ");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConnected || !contractAddress) {
      toast.error("Please connect your wallet");
      return;
    }

    // Validate all required fields
    const newErrors: Record<string, string> = {};
    const requiredFields = ["description", "origin", "destination", "quantity"];
    
    requiredFields.forEach((field) => {
      const error = validateField(field, formData[field as keyof typeof formData]);
      if (error) {
        newErrors[field] = error;
      }
    });

    // Validate optional fields if they have values
    if (formData.temperature) {
      const tempError = validateField("temperature", formData.temperature);
      if (tempError) newErrors.temperature = tempError;
    }

    if (formData.expectedDate) {
      const dateError = validateField("expectedDate", formData.expectedDate);
      if (dateError) newErrors.expectedDate = dateError;
    }

    setErrors(newErrors);
    setTouched({
      description: true,
      origin: true,
      destination: true,
      quantity: true,
      temperature: true,
      expectedDate: true,
    });

    if (Object.keys(newErrors).length > 0) {
      toast.error("Please fix the errors in the form");
      return;
    }

    const fullDescription = buildDescription();
    if (!fullDescription || fullDescription.trim().length < 3) {
      toast.error("Please provide at least a description");
      return;
    }

    try {
      writeContract({
        address: contractAddress as Address,
        abi,
        functionName: "createPackage",
        args: [fullDescription],
      });
    } catch (error: any) {
      toast.error("Failed to create shipment: " + (error.message || String(error)));
    }
  };

  // Handle successful transaction
  useEffect(() => {
    if (isConfirmed && writeData) {
      setShowSuccess(true);
      toast.success("Shipment Created Successfully", {
        description: "Your shipment has been registered on the blockchain",
      });

      // Reset form
      setFormData({
        description: "",
        category: "pharmaceuticals",
        origin: "",
        destination: "",
        quantity: "",
        temperature: "",
        expectedDate: "",
        handler: "",
        notes: "",
      });
      setErrors({});
      setTouched({});
    }
  }, [isConfirmed, writeData, toast]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched({
      ...touched,
      [name]: true,
    });

    // Validate on blur
    const error = validateField(name, value);
    if (error) {
      setErrors({
        ...errors,
        [name]: error,
      });
    } else {
      const newErrors = { ...errors };
      delete newErrors[name];
      setErrors(newErrors);
    }
  };

  const isLoading = isPending || isConfirming;

  // Helper function to render field with error
  const renderField = (
    name: string,
    label: string,
    icon: React.ReactNode,
    inputElement: React.ReactElement,
    required = false
  ) => {
    const hasError = touched[name] && errors[name];
    const isValid = touched[name] && !errors[name] && formData[name as keyof typeof formData];

    return (
      <div>
        <label className="block text-sm text-slate-300 mb-2" htmlFor={name}>
          <span className="flex items-center gap-2">
            {icon}
            {label} {required && <span className="text-red-400">*</span>}
          </span>
        </label>
        <div className="relative">
          {React.cloneElement(inputElement as React.ReactElement<any>, {
            id: name,
            name: name,
            onBlur: handleBlur,
            "aria-invalid": hasError ? "true" : "false",
            "aria-describedby": hasError ? `${name}-error` : undefined,
            className: `${(inputElement.props as any).className} ${
              hasError
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : isValid
                ? "border-green-500/50"
                : ""
            }`,
          })}
          {hasError && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
          )}
          {isValid && !hasError && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
          )}
        </div>
        {hasError && (
          <p id={`${name}-error`} className="mt-1 text-sm text-red-400 flex items-center gap-1" role="alert">
            <AlertCircle className="w-4 h-4" />
            {errors[name]}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-white mb-1">Create New Shipment</h2>
        <p className="text-slate-400 text-sm">
          Register a new medical supply shipment on the
          blockchain
        </p>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="mb-6 card p-4 bg-green-500/10 border border-green-500/20 rounded-md">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-green-400 font-semibold mb-1">Shipment Created Successfully!</h3>
                <p className="text-sm text-slate-400 mb-3">
                  Your shipment has been registered on the blockchain. You can view it in the All Shipments tab.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowSuccess(false);
                      if (onNavigate) onNavigate("packages");
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm transition-colors"
                  >
                    View All Shipments
                  </button>
                  <button
                    onClick={() => setShowSuccess(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm transition-colors"
                  >
                    Create Another
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="text-slate-400 hover:text-slate-300 transition-colors"
              aria-label="Close success message"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Transaction Status Banner */}
      {(isPending || isConfirming) && (
        <div className="mb-6 card p-4 bg-blue-500/10 border border-blue-500/20 rounded-md">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <div className="flex-1">
              <p className="text-blue-400 font-semibold">
                {isPending ? "Transaction Pending" : "Confirming Transaction"}
              </p>
              <p className="text-sm text-slate-400">
                {isPending
                  ? "Please confirm the transaction in your wallet"
                  : "Waiting for blockchain confirmation..."}
              </p>
            </div>
            {writeData && (
              <a
                href={`https://sepolia.etherscan.io/tx/${writeData}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 underline"
              >
                View on Etherscan
              </a>
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="card p-6 space-y-6"
        noValidate
        aria-label="Create new shipment form"
      >
        {/* Basic Information */}
        <div>
          <h4 className="text-slate-400 mb-4">
            Basic Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              {renderField(
                "description",
                "Description",
                <Package className="w-4 h-4" />,
                <input
                  type="text"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="e.g., Insulin vials - 500 units"
                  required
                  disabled={!walletConnected || isLoading}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                />,
                true
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2" htmlFor="category">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                disabled={!walletConnected || isLoading}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Select shipment category"
              >
                <option value="pharmaceuticals">
                  Pharmaceuticals
                </option>
                <option value="medical-devices">
                  Medical Devices
                </option>
                <option value="surgical-equipment">
                  Surgical Equipment
                </option>
                <option value="ppe">
                  Personal Protective Equipment
                </option>
                <option value="diagnostics">
                  Diagnostics & Tests
                </option>
              </select>
            </div>

            {renderField(
              "quantity",
              "Quantity",
              <span />,
              <input
                type="text"
                value={formData.quantity}
                onChange={handleChange}
                placeholder="e.g., 500 units"
                required
                disabled={!walletConnected || isLoading}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />,
              true
            )}
          </div>
        </div>

        {/* Shipping Details */}
        <div>
          <h4 className="text-slate-400 mb-4">
            Shipping Details
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderField(
              "origin",
              "Origin Location",
              <MapPin className="w-4 h-4" />,
              <input
                type="text"
                value={formData.origin}
                onChange={handleChange}
                placeholder="e.g., Manufacturing Plant, Boston, MA"
                required
                disabled={!walletConnected || isLoading}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />,
              true
            )}

            {renderField(
              "destination",
              "Destination",
              <MapPin className="w-4 h-4" />,
              <input
                type="text"
                value={formData.destination}
                onChange={handleChange}
                placeholder="e.g., Regional Hospital, New York, NY"
                required
                disabled={!walletConnected || isLoading}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />,
              true
            )}

            <div>
              <label className="block text-sm text-slate-300 mb-2" htmlFor="handler">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Handler/Carrier
                </span>
              </label>
              <input
                id="handler"
                type="text"
                name="handler"
                value={formData.handler}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g., MedEx Logistics"
                disabled={!walletConnected || isLoading}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Handler or carrier name"
              />
            </div>

            {renderField(
              "expectedDate",
              "Expected Delivery Date",
              <Calendar className="w-4 h-4" />,
              <input
                type="date"
                value={formData.expectedDate}
                onChange={handleChange}
                disabled={!walletConnected || isLoading}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            )}
          </div>
        </div>

        {/* Special Requirements */}
        <div>
          <h4 className="text-slate-400 mb-4">
            Special Requirements
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderField(
              "temperature",
              "Temperature Requirements (°C)",
              <Thermometer className="w-4 h-4" />,
              <input
                type="text"
                value={formData.temperature}
                onChange={handleChange}
                placeholder="e.g., 2-8°C"
                disabled={!walletConnected || isLoading}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            )}

            <div className="md:col-span-2">
              <label className="block text-sm text-slate-300 mb-2" htmlFor="notes">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Additional Notes
                </span>
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Add any special handling instructions or compliance notes..."
                rows={3}
                disabled={!walletConnected || isLoading}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 placeholder:text-slate-600 resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Additional notes"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-700">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={!walletConnected || isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              aria-label={!walletConnected ? "Connect wallet to create shipment" : "Create new shipment"}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>{isPending ? "Processing..." : "Confirming..."}</span>
                </>
              ) : walletConnected ? (
                "Create Shipment & Mint NFT"
              ) : (
                "Connect Wallet to Continue"
              )}
            </button>
            {!walletConnected && (
              <div className="group relative">
                <button
                  type="button"
                  disabled
                  className="px-4 py-3 bg-slate-700 text-slate-400 rounded-md cursor-not-allowed"
                  aria-describedby="wallet-tooltip"
                >
                  <span className="sr-only">Why is this disabled?</span>
                  ?
                </button>
                <div
                  id="wallet-tooltip"
                  className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-800 border border-slate-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10"
                  role="tooltip"
                >
                  <p className="text-sm text-slate-300">
                    Please connect your wallet to create a shipment. This action requires blockchain interaction.
                  </p>
                </div>
              </div>
            )}
          </div>
          {walletConnected && (
            <p className="text-xs text-slate-500 mt-3">
              This will create an immutable record on the
              blockchain and mint an NFT representing this
              shipment.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

