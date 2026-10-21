import { DemoFixture, IssueType, VerifyResponse } from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function requestWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new ApiError(408, "Request timed out after 60 seconds.");
    }
    throw new ApiError(0, err.message || "Failed to connect to CivicFix AI server. Please check if backend is running.");
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyFix(
  beforeFile: File,
  afterFile: File,
  issueType: IssueType = "pothole"
): Promise<VerifyResponse> {
  const formData = new FormData();
  formData.append("before_image", beforeFile);
  formData.append("after_image", afterFile);
  formData.append("issue_type", issueType);

  const response = await requestWithTimeout(`${API_BASE_URL}/api/v1/verify-fix`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = "Verification failed";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}

export async function getDemoFixtures(): Promise<DemoFixture[]> {
  const response = await requestWithTimeout(`${API_BASE_URL}/api/v1/demo-fixtures`, {
    method: "GET",
  }, 10000);

  if (!response.ok) {
    let errorDetail = "Failed to load demo fixtures";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}

export async function getDemoFixtureById(id: string): Promise<DemoFixture> {
  const response = await requestWithTimeout(`${API_BASE_URL}/api/v1/demo-fixtures/${encodeURIComponent(id)}`, {
    method: "GET",
  }, 10000);

  if (!response.ok) {
    let errorDetail = `Fixture '${id}' not found`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}
