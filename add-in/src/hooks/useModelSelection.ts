import { useEffect, useState } from "react";
import { useHealth } from "../api/useHealth";

export function useModelSelection() {
  const { data: health, isLoading: modelsLoading } = useHealth();
  const [model, setModel] = useState("");

  useEffect(() => {
    if (!model && health?.defaultModel) setModel(health.defaultModel);
  }, [health, model]);

  return {
    model,
    models: health?.availableModels ?? [],
    modelsLoading,
    setModel,
  };
}
