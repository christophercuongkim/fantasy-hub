import * as React from 'react';

export interface FileDropFile {
  name: string;
  /** Bytes. Shown as "80.3 KB". */
  size?: number;
}

/**
 * A drop zone around a native file input: a labelled wait in the zone while uploading,
 * an `ErrorState` in the zone on failure, the chosen file as a row beneath when done.
 * One file.
 */
export interface FileDropProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onError'> {
  /** Same syntax as the input's `accept`: ".pdf", "application/pdf". */
  accept?: string;
  /** Called with the chosen or dropped `File`. */
  onFile?: (file: File) => void;
  /** The chosen file, shown as a row. A `File` works; so does `{ name, size }` from the server. */
  file?: FileDropFile | File | null;
  /** Shows a remove control on the row. */
  onRemove?: () => void;
  /** The zone shows a labelled wait in place of its copy (0021). */
  uploading?: boolean;
  /** The wait's text. Defaults to "Uploading…"; say what is happening: "Reading your résumé…". */
  uploadingLabel?: string;
  /** The zone shows a compact `ErrorState` with this as its title and a Try again. */
  error?: string;
  /** The Try again in the error state. */
  onRetry?: () => void;
  /** The types-and-size line: "PDF up to 5 MB". */
  hint?: string;
  /** Phosphor icon in the zone. Defaults to `upload-simple`; pass `null` for none. */
  icon?: string | null;
  /** The link-coloured verb. Defaults to "Click to upload". */
  action?: string;
  /** The rest of the line. Defaults to "or drag and drop". */
  label?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function FileDrop(props: FileDropProps): JSX.Element;
export declare function formatFileSize(bytes: number): string;
