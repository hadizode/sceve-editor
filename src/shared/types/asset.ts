// ============ Asset (shared image library) ============
export interface Asset {
  id: string;
  name: string;
  url: string;           // data URL or external URL
  tags: string[];
  createdAt: string;
}
