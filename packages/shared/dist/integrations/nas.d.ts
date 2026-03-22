/**
 * NAS (Network Attached Storage) File Operations
 *
 * Handles file search, read, and write operations with path boundary enforcement
 * and approval gating for write operations.
 */
export interface FileSearchResult {
    path: string;
    name: string;
    size: number;
    isDirectory: boolean;
    modifiedAt: string;
}
export interface FilePreview {
    path: string;
    name: string;
    size: number;
    modifiedAt: string;
    mimeType?: string;
    preview?: string;
    isBinary: boolean;
    isLarge: boolean;
}
export interface FileWriteResult {
    path: string;
    size: number;
    hash?: string;
    message?: string;
}
export interface DirectoryListPage {
    entries: FileSearchResult[];
    nextCursor: string | null;
    hasMore: boolean;
}
/**
 * Validates that a path is within allowed NAS boundaries
 * Allowed: /nas/shared (read), /nas/users/<userId>/... (read+write)
 */
export declare function validateNasPath(filePath: string, userId: string, write?: boolean): {
    valid: boolean;
    error?: string;
};
/**
 * Search for files matching a pattern
 */
export declare function searchFiles(searchPath: string, pattern: string, userId: string, maxResults?: number): Promise<FileSearchResult[]>;
/**
 * Read file preview (first 8KB for text, base64 for binary)
 */
export declare function readFilePreview(filePath: string, userId: string, maxBytes?: number): Promise<FilePreview>;
/**
 * Read entire file (with size limit)
 */
export declare function readFile(filePath: string, userId: string, maxBytes?: number): Promise<Buffer>;
/**
 * List directory contents
 */
export declare function listDirectory(dirPath: string, userId: string): Promise<FileSearchResult[]>;
/**
 * List directory contents with deterministic pagination.
 */
export declare function listDirectoryPage(dirPath: string, userId: string, limit?: number, cursor?: string): Promise<DirectoryListPage>;
/**
 * Write file (requires approval for user paths)
 */
export declare function writeFile(filePath: string, content: Buffer | string, userId: string, options?: {
    append?: boolean;
    createDirs?: boolean;
}): Promise<FileWriteResult>;
/**
 * Delete file or directory (recursively for dirs)
 */
export declare function deleteFile(filePath: string, userId: string, recursive?: boolean): Promise<{
    message: string;
}>;
/**
 * Get file statistics
 */
export declare function getFileStats(filePath: string, userId: string): Promise<{
    path: string;
    size: number;
    isDirectory: boolean;
    modifiedAt: string;
    createdAt: string;
    isReadable: boolean;
    isWritable: boolean;
}>;
//# sourceMappingURL=nas.d.ts.map