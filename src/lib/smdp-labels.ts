/**
 * SMDP Status → Support-Friendly Labels
 * Maps raw TelliSIM SMDP states to human-readable labels for customer support.
 *
 * Raw states from TelliSIM API (GET /v3/sims/{iccid}/smdp-info):
 *   "BPP Installation" — eSIM profile downloaded and installed via Bootstrap Provisioning
 *   "Enable"           — eSIM is switched on from device settings
 *   "Disable"          — eSIM is turned off via device settings
 *   "Delete"           — eSIM profile completely removed from device
 */

export interface SmdpLabel {
  label: string;
  description: string;
  severity: "success" | "info" | "warning" | "error";
}

const SMDP_LABELS: Record<string, SmdpLabel> = {
  "BPP Installation": {
    label: "Profile Downloaded",
    description: "The eSIM profile was downloaded and installed onto the customer's device",
    severity: "info",
  },
  "Enable": {
    label: "eSIM Turned On",
    description: "The customer switched on this eSIM in their device settings. It can now connect to the network.",
    severity: "success",
  },
  "Disable": {
    label: "eSIM Turned Off",
    description: "The customer switched off this eSIM in device settings. It is temporarily inactive but not removed.",
    severity: "warning",
  },
  "Delete": {
    label: "eSIM Removed",
    description: "The eSIM profile was permanently deleted from the device. Customer needs to re-download.",
    severity: "error",
  },
};

export function getSmdpLabel(rawState?: string): SmdpLabel {
  if (!rawState) {
    return {
      label: "Not Yet Downloaded",
      description: "The eSIM has not been downloaded to any device yet",
      severity: "warning",
    };
  }
  return SMDP_LABELS[rawState] || {
    label: rawState,
    description: "Unknown profile status",
    severity: "info",
  };
}

/**
 * Get a support-friendly label for a plan attachment state.
 */
export function getPlanStateLabel(rawState?: string): { label: string; description: string; severity: "success" | "info" | "warning" | "error" } {
  switch (rawState) {
    case "ACTIVE":
    case "ENABLED":
      return { label: "Active", description: "Plan is currently active and usable", severity: "success" };
    case "EXPIRED":
      return { label: "Expired", description: "Plan validity period has ended", severity: "error" };
    case "PENDING_FOR_FIRST_USE":
      return { label: "Waiting for Activation", description: "Plan is ready but hasn't been used yet. Activates on first data session.", severity: "warning" };
    case "PENDING":
    case "CREATED":
      return { label: "Being Provisioned", description: "Plan is being set up by the provider", severity: "info" };
    case "ASSIGNED":
      return { label: "Assigned", description: "Plan has been assigned but not yet activated", severity: "info" };
    case "SUSPENDED":
      return { label: "Suspended", description: "Plan was suspended by the provider. Escalate to carrier operations.", severity: "error" };
    default:
      return { label: rawState || "Unknown", description: "Status not recognized", severity: "info" };
  }
}
