export interface FileReference {
  path: string;
  content?: string;
  type: 'file' | 'folder';
}

class FileReferenceSystem {
  private projectFiles: Map<string, string[]> = new Map(); // project -> file paths
  private fileContents: Map<string, string> = new Map(); // file path -> content cache

  setProjectFiles(project: string, files: string[]) {
    this.projectFiles.set(project, files);
  }

  getProjectFiles(project: string): string[] {
    return this.projectFiles.get(project) || [];
  }

  setFileContent(filePath: string, content: string) {
    this.fileContents.set(filePath, content);
  }

  getFileContent(filePath: string): string | undefined {
    return this.fileContents.get(filePath);
  }

  parseFileReferences(text: string): { references: string[]; cleanText: string } {
    const regex = /\$([^\s]+)/g;
    const references: string[] = [];
    let match;
    let cleanText = text;

    while ((match = regex.exec(text)) !== null) {
      const filePath = match[1];
      if (!references.includes(filePath)) {
        references.push(filePath);
      }
    }

    return { references, cleanText };
  }

  async readFileContent(filePath: string): Promise<string | null> {
    try {
      // Check cache first
      if (this.fileContents.has(filePath)) {
        return this.fileContents.get(filePath)!;
      }

      // Check if we have permission to read files
      if ('showDirectoryPicker' in window) {
        // For File System Access API, we need to get the directory handle
        // This is a simplified version - in production, you'd store the directory handle
        const content = `[Archivo: ${filePath}]\n(El contenido del archivo se cargaría aquí con permisos del sistema de archivos)`;
        this.fileContents.set(filePath, content);
        return content;
      } else {
        // For webkitdirectory approach, we can't read files directly
        // We can only show the file path
        const content = `[Referencia: ${filePath}]\n(Usa el explorador de archivos para seleccionar la carpeta del proyecto y permitir el acceso a los archivos)`;
        this.fileContents.set(filePath, content);
        return content;
      }
    } catch (error) {
      console.error('Error reading file:', error);
      return null;
    }
  }

  async enrichMessageWithFiles(
    message: string,
    project: string
  ): Promise<{ enrichedMessage: string; fileContents: FileReference[] }> {
    const { references, cleanText } = this.parseFileReferences(message);
    const fileContents: FileReference[] = [];
    let enrichedMessage = cleanText;

    // Get available files for the project
    const availableFiles = this.getProjectFiles(project);

    for (const ref of references) {
      // Check if the reference matches any available file
      const matchingFile = availableFiles.find(f => f.endsWith(ref) || f === ref);
      
      if (matchingFile) {
        const content = await this.readFileContent(matchingFile);
        if (content) {
          fileContents.push({
            path: matchingFile,
            content,
            type: 'file'
          });
          
          // Replace the $reference with the file content in the message
          enrichedMessage = enrichedMessage.replace(
            `$${ref}`,
            `\n\n=== CONTENIDO DE ${matchingFile} ===\n${content}\n=== FIN DE ${matchingFile} ===\n`
          );
        }
      } else {
        // File not found in project
        enrichedMessage = enrichedMessage.replace(
          `$${ref}`,
          `\n[ADVERTENCIA: Archivo "${ref}" no encontrado en el proyecto "${project}"]\n`
        );
      }
    }

    return { enrichedMessage, fileContents };
  }
}

export const fileReferenceSystem = new FileReferenceSystem();