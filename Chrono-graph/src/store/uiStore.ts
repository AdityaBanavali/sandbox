import { create } from 'zustand'

export interface HoveredBuildingInfo {
  path: string
  touches: number
  lastAuthor: string
  districtName: string
  screenX: number
  screenY: number
}

export interface DistrictStats {
  id: string
  name: string
  color: string
  fileCount: number
  totalTouches: number
  topContributors: { name: string; count: number }[]
  recentFiles: string[]
  centerX: number
  centerZ: number
  width: number
  depth: number
}

export interface CameraTarget {
  target: [number, number, number]
  position: [number, number, number]
  id: number
}

export type AutoPaceOption = null | 15 | 30 | 60

interface UIStoreState {
  isLandingOpen: boolean
  hoveredBuilding: HoveredBuildingInfo | null
  selectedDistrict: DistrictStats | null
  cameraTarget: CameraTarget | null

  // Cinematic & Recording state
  isCinematicMode: boolean
  isRecording: boolean
  recordingStatus: string
  recordingProgress: number
  autoPaceDuration: AutoPaceOption
  isShareModalOpen: boolean
  isRecordModalOpen: boolean
  isHelpOpen: boolean
  flyByTrigger: { target: [number, number, number]; id: number } | null

  // Actions
  setLandingOpen: (open: boolean) => void
  toggleLanding: () => void
  setHoveredBuilding: (info: HoveredBuildingInfo | null) => void
  setSelectedDistrict: (district: DistrictStats | null) => void
  focusCamera: (target: [number, number, number], position: [number, number, number]) => void
  resetCamera: () => void
  setCinematicMode: (enabled: boolean) => void
  toggleCinematicMode: () => void
  setAutoPaceDuration: (duration: AutoPaceOption) => void
  setShareModalOpen: (open: boolean) => void
  setRecordModalOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setRecordingState: (isRecording: boolean, status?: string, progress?: number) => void
  triggerFlyBy: (target: [number, number, number]) => void
}

let nextCameraId = 1
let nextFlyById = 1

export const useUIStore = create<UIStoreState>((set) => ({
  isLandingOpen: false,
  hoveredBuilding: null,
  selectedDistrict: null,
  cameraTarget: null,

  isCinematicMode: false,
  isRecording: false,
  recordingStatus: '',
  recordingProgress: 0,
  autoPaceDuration: 30, // Default 30s auto-pace
  isShareModalOpen: false,
  isRecordModalOpen: false,
  isHelpOpen: false,
  flyByTrigger: null,

  setLandingOpen: (open: boolean) => set({ isLandingOpen: open }),
  toggleLanding: () => set((state) => ({ isLandingOpen: !state.isLandingOpen })),
  setHoveredBuilding: (info) => set({ hoveredBuilding: info }),
  setSelectedDistrict: (district) => set({ selectedDistrict: district }),

  focusCamera: (target, position) => {
    set({
      cameraTarget: {
        target,
        position,
        id: nextCameraId++,
      },
    })
  },

  resetCamera: () => {
    set({
      selectedDistrict: null,
      cameraTarget: {
        target: [0, 0, 0],
        position: [50, 60, 50],
        id: nextCameraId++,
      },
    })
  },

  setCinematicMode: (enabled: boolean) => set({ isCinematicMode: enabled }),
  toggleCinematicMode: () => set((state) => ({ isCinematicMode: !state.isCinematicMode })),
  setAutoPaceDuration: (duration: AutoPaceOption) => set({ autoPaceDuration: duration }),
  setShareModalOpen: (open: boolean) => set({ isShareModalOpen: open }),
  setRecordModalOpen: (open: boolean) => set({ isRecordModalOpen: open }),
  setHelpOpen: (open: boolean) => set({ isHelpOpen: open }),

  setRecordingState: (isRecording: boolean, status = '', progress = 0) =>
    set({ isRecording, recordingStatus: status, recordingProgress: progress }),

  triggerFlyBy: (target: [number, number, number]) =>
    set({ flyByTrigger: { target, id: nextFlyById++ } }),
}))
