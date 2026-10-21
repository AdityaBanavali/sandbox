import { useState } from "react";
import { verifyFix } from "../api/client";
import { IssueType, VerifyResponse } from "../types";

export function useVerify() {
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);

  const submitVerification = async (
    beforeFile: File,
    afterFile: File,
    issueType: IssueType
  ) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveStep(1); // 1: Checking metadata

    const step2Timer = setTimeout(() => setActiveStep(2), 600); // 2: Aligning images
    const step3Timer = setTimeout(() => setActiveStep(3), 1400); // 3: Auditing with AI

    try {
      const response = await verifyFix(beforeFile, afterFile, issueType);
      setResult(response);
      setError(null);
    } catch (err: any) {
      setError(err.detail || err.message || "An unexpected error occurred during verification.");
      setResult(null);
    } finally {
      clearTimeout(step2Timer);
      clearTimeout(step3Timer);
      setLoading(false);
      setActiveStep(0);
    }
  };

  const setDirectResult = (directResult: VerifyResponse) => {
    setResult(directResult);
    setError(null);
    setLoading(false);
    setActiveStep(0);
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setLoading(false);
    setActiveStep(0);
  };

  return {
    result,
    loading,
    error,
    activeStep,
    submitVerification,
    setDirectResult,
    reset,
  };
}
