// ============ Studio slice: assets (image library) ============
import type { StateCreator } from 'zustand';
import type { Asset } from '../../shared/types';
import type { StudioState } from './state';

export interface AssetsSlice {
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
  uploadAssets: (files: FileList) => Promise<void>;
}

export const createAssetsSlice: StateCreator<StudioState, [], [], AssetsSlice> =
  (set, get) => ({
    addAsset: (asset) => {
      set(state => ({ assets: { ...state.assets, [asset.id]: asset } }));
    },

    removeAsset: (id) => {
      set(state => {
        const newAssets = { ...state.assets };
        delete newAssets[id];
        return { assets: newAssets };
      });
    },

    uploadAssets: async (files) => {
      const fileArray = Array.from(files);
      const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));

      for (const file of imageFiles) {
        const reader = new FileReader();
        reader.onload = () => {
          const asset: Asset = {
            id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            url: reader.result as string,
            tags: [],
            createdAt: new Date().toISOString(),
          };
          get().addAsset(asset);
        };
        reader.readAsDataURL(file);
      }
    },
  });
