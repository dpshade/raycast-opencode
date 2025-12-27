import { useState, useEffect } from "react";
import { getServerUrl } from "../lib/opencode";
import { homedir } from "os";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface Model {
  id: string;
  providerID: string;
  name: string;
}

export interface Provider {
  id: string;
  name: string;
  models: Record<string, Model>;
}

export interface FavoriteModel {
  providerID: string;
  providerName: string;
  modelID: string;
  modelName: string;
}

export interface ProviderResponse {
  all: Provider[];
  default: Record<string, string>;
}

interface LocalModelConfig {
  recent: Array<{ providerID: string; modelID: string }>;
  favorite: Array<{ providerID: string; modelID: string }>;
}

function getLocalModelConfig(): LocalModelConfig | null {
  const possiblePaths = [
    join(homedir(), ".local", "state", "opencode", "model.json"),
    join(homedir(), "Library", "Application Support", "opencode", "model.json"),
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, "utf-8");
        return JSON.parse(content) as LocalModelConfig;
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [favorites, setFavorites] = useState<FavoriteModel[]>([]);
  const [recentModels, setRecentModels] = useState<FavoriteModel[]>([]);
  const [defaultModel, setDefaultModel] = useState<{ providerID: string; modelID: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProviders() {
      const baseUrl = getServerUrl() || "http://localhost:4096";
      try {
        const response = await fetch(`${baseUrl}/provider`);
        if (!response.ok) {
          throw new Error(`Failed to fetch providers: ${response.statusText}`);
        }
        const data = (await response.json()) as ProviderResponse;
        setProviders(data.all);
        
        const localConfig = getLocalModelConfig();
        
        const resolveFavorites = (
          items: Array<{ providerID: string; modelID: string }> | undefined
        ): FavoriteModel[] => {
          if (!items) return [];
          return items
            .map((item) => {
              const provider = data.all.find((p) => p.id === item.providerID);
              if (!provider || !provider.models[item.modelID]) return null;
              return {
                providerID: item.providerID,
                providerName: provider.name,
                modelID: item.modelID,
                modelName: provider.models[item.modelID].name,
              };
            })
            .filter((x): x is FavoriteModel => x !== null);
        };
        
        const userFavorites = resolveFavorites(localConfig?.favorite);
        const userRecent = resolveFavorites(localConfig?.recent);
        
        setFavorites(userFavorites);
        setRecentModels(userRecent);
        
        if (userFavorites.length > 0) {
          setDefaultModel({ providerID: userFavorites[0].providerID, modelID: userFavorites[0].modelID });
        } else if (userRecent.length > 0) {
          setDefaultModel({ providerID: userRecent[0].providerID, modelID: userRecent[0].modelID });
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    }

    fetchProviders();
  }, []);

  return {
    providers,
    favorites,
    recentModels,
    defaultModel,
    isLoading,
    error,
  };
}
