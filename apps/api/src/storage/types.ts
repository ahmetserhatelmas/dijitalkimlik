export type StoredObject = {
  path: string;
  size: number;
  contentType: string;
};

export type FileMetadata = {
  size: number;
  contentType: string;
};

export interface StorageProvider {
  readonly name: "memory" | "supabase";
  uploadFile(input: { path: string; body: Uint8Array; contentType: string }): Promise<StoredObject>;
  deleteFile(path: string): Promise<void>;
  getSignedUrl(input: { path: string; expiresInSeconds: number }): Promise<string>;
  getFileMetadata(path: string): Promise<FileMetadata | null>;
  checkFileExists(path: string): Promise<boolean>;
  readFile(path: string): Promise<{ body: Uint8Array; contentType: string } | null>;
}
