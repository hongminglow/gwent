export type DebugFlags = {
  showPlacementZones: boolean;
  showPerf: boolean;
  fastAnimations: boolean;
};

export const debugFlags: DebugFlags = {
  showPlacementZones: import.meta.env.DEV,
  showPerf: false,
  fastAnimations: false,
};
