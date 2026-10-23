export type CompatibilityLevel = "likely" | "check" | "unsupported";

export interface DeviceModel {
  id: string;
  name: string;
  level: CompatibilityLevel;
  note: string;
}

export interface DeviceBrand {
  id: string;
  name: string;
  models: DeviceModel[];
}

/**
 * Illustrative demo data only. It is deliberately conservative and must not be
 * treated as an official compatibility database or a guarantee of eSIM support.
 */
export const deviceBrands: DeviceBrand[] = [
  {
    id: "apple",
    name: "Apple",
    models: [
      {
        id: "iphone-xr-xs-later",
        name: "iPhone XR / XS and later families",
        level: "likely",
        note: "Many models support eSIM, but regional variants and carrier policies differ. Confirm in Settings and with Apple.",
      },
      {
        id: "iphone-se",
        name: "iPhone SE (selected generations)",
        level: "check",
        note: "Support depends on the generation and region. Check the device specification before buying.",
      },
      {
        id: "ipad",
        name: "iPad (cellular models)",
        level: "check",
        note: "Only some cellular iPad models support eSIM. Wi-Fi-only models do not.",
      },
    ],
  },
  {
    id: "samsung",
    name: "Samsung",
    models: [
      {
        id: "galaxy-s20-later",
        name: "Galaxy S20 and later families",
        level: "likely",
        note: "Many recent Galaxy models support eSIM, but some regional models and carrier versions do not.",
      },
      {
        id: "galaxy-fold-flip",
        name: "Galaxy Z Fold / Flip families",
        level: "check",
        note: "Support varies by generation and market. Confirm in the device's SIM settings.",
      },
      {
        id: "galaxy-a",
        name: "Galaxy A series",
        level: "check",
        note: "Selected models only. Do not assume support from the series name.",
      },
    ],
  },
  {
    id: "google",
    name: "Google",
    models: [
      {
        id: "pixel-3-later",
        name: "Pixel 3 and later families",
        level: "likely",
        note: "Many Pixel models support eSIM, but regional availability and carrier support vary.",
      },
      {
        id: "pixel-a",
        name: "Pixel A series",
        level: "check",
        note: "Support varies by generation and market. Check the model specification.",
      },
    ],
  },
  {
    id: "motorola",
    name: "Motorola",
    models: [
      {
        id: "moto-selected",
        name: "Selected Motorola models",
        level: "check",
        note: "eSIM support is model-specific. Search the exact model number in the manufacturer's documentation.",
      },
    ],
  },
  {
    id: "huawei",
    name: "Huawei",
    models: [
      {
        id: "huawei-selected",
        name: "Selected Huawei models",
        level: "check",
        note: "Support varies significantly by model and region. Verify before purchase.",
      },
    ],
  },
  {
    id: "other",
    name: "Another brand",
    models: [
      {
        id: "other-unknown",
        name: "I am not sure",
        level: "check",
        note: "Check the manufacturer's specification for eSIM / eUICC support, then look for an option to add a mobile plan in the device settings.",
      },
    ],
  },
];

export function compatibilityLabel(level: CompatibilityLevel): string {
  switch (level) {
    case "likely":
      return "Likely compatible — verify first";
    case "unsupported":
      return "Not indicated as compatible";
    default:
      return "Check the exact model";
  }
}
