import { useEffect, useState } from 'react';
import { isStaticHosting, requestApi } from '../utils/api';

interface ModelStatus { id: string; hasApiKey: boolean }
export function useShaheenModels() {
  const [models, setModels] = useState<ModelStatus[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (isStaticHosting) return;
    const controller = new AbortController();
    requestApi<{ models: ModelStatus[] }>('/api/models', { signal: controller.signal })
      .then((data) => {
        if (!Array.isArray(data.models) || !data.models.every((model) => model &&
          typeof model.id === 'string' && typeof model.hasApiKey === 'boolean')) throw new Error('Invalid models response');
        if (!controller.signal.aborted) setModels(data.models);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  return { models, failed, isUnavailable: (id: string) => isStaticHosting || models?.find((model) => model.id === id)?.hasApiKey === false };
}
