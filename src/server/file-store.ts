import { basename } from "path";

export class FileStore {
  private path: string | null = null;

  get activePath(): string | null {
    return this.path;
  }

  get activeFilename(): string | null {
    return this.path ? basename(this.path) : null;
  }

  setActive(resolvedPath: string): void {
    this.path = resolvedPath;
  }

  clear(): void {
    this.path = null;
  }
}
