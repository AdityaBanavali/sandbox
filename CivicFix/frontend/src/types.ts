export interface GpsPoint {
  lat: float;
  lon: float;
}

export interface MetadataResult {
  before_gps: GpsPoint | null;
  after_gps: GpsPoint | null;
  distance_m: number | null;
  before_timestamp: string | null;
  after_timestamp: string | null;
  timestamp_valid: boolean | null;
  phash_before: string | null;
  phash_after: string | null;
  phash_distance: number | null;
  is_duplicate_or_reupload: boolean;
  location_mismatch: boolean;
  flags: string[];
  score: number;
}

export interface VisionResult {
  keypoints_before: number;
  keypoints_after: number;
  good_matches: number;
  inliers: number;
  alignment_succeeded: boolean;
  change_magnitude: number;
  roughness_before: number | null;
  roughness_after: number | null;
  roughness_drop_ratio: number | null;
  flags: string[];
  score: number;
}

export type Verdict = "RESOLVED" | "PARTIALLY_RESOLVED" | "NOT_REPAIRED" | "SUSPICIOUS_SPOOF";

export interface AuditResult {
  verdict: Verdict;
  confidence_score: number;
  defect_detected_before: string;
  status_observed_after: string;
  repair_quality_notes: string;
  requires_field_reinspection: boolean;
  red_flags: string[];
  source: "gemini" | "fallback";
  score: number;
}

export interface TrustBreakdown {
  metadata: number;
  vision: number;
  llm: number;
}

export type TrustStatus = "APPROVED" | "NEEDS_REVIEW" | "REJECTED_FRAUD";

export interface VerifyResponse {
  trust_score: number;
  status: TrustStatus;
  breakdown: TrustBreakdown;
  metadata: MetadataResult;
  vision: VisionResult;
  audit: AuditResult;
  before_image_b64: string | null;
  after_image_b64: string | null;
  aligned_after_image_b64: string | null;
  diff_heatmap_b64: string | null;
  processing_ms: number;
  warnings: string[];
}

export interface DemoFixture {
  id: string;
  label: string;
  description: string;
  expected_status: TrustStatus;
  result: VerifyResponse;
}

export type IssueType = "pothole" | "garbage" | "drain" | "other";

type float = number;
