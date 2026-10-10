export interface Settings {
  playbackRate: number;
  playbackRateAdjustmentStepSize: number;
  rememberPlaybackRate: boolean;
  rememberVolumeLevel: boolean;
  volumeAdjustmentStepSize: number;
  volumeLevel: number;
}

export const DEFAULTS: Settings = {
  playbackRate: 1,
  playbackRateAdjustmentStepSize: 0.25,
  rememberPlaybackRate: true,
  rememberVolumeLevel: true,
  volumeAdjustmentStepSize: 0.1,
  volumeLevel: 1,
};
