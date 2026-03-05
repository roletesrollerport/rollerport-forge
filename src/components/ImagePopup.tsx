import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Copy, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';

interface ImagePopupProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md';
  onUpload?: (url: string) => void;
  onRemove?: () => void;
  className?: string;
}

export function ImageThumbnail({ src, alt = 'Imagem', size = 'sm', onUpload, onRemove, className = '' }: ImagePopupProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const px = size === 'sm' ? 'h-8 w-8' : 'h-12 w-12';

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpload?.(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCopy = async () => {
    if (!src) return;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast.success('Imagem copiada!');
    } catch {
      // fallback: copy URL
      await navigator.clipboard.writeText(src);
      toast.success('URL da imagem copiada!');
    }
  };

  const handleDownload = () => {
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = alt || 'imagem';
    a.click();
  };

  if (!src && onUpload) {
    return (
      <label className={`cursor-pointer text-muted-foreground hover:text-primary p-1 inline-flex items-center ${className}`}>
        <ImagePlus className="h-4 w-4" />
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </label>
    );
  }

  if (!src) return null;

  return (
    <>
      <div className={`relative inline-flex items-center gap-1 ${className}`}>
        <img
          src={src}
          alt={alt}
          className={`${px} object-cover rounded cursor-pointer border hover:opacity-80 transition-opacity`}
          onClick={() => setPopupOpen(true)}
        />
        {onRemove && (
          <button onClick={onRemove} className="text-destructive hover:text-destructive/80 p-0.5">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{alt}</DialogTitle>
          </DialogHeader>
          <img src={src} alt={alt} className="w-full rounded" />
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
              <Copy className="h-4 w-4" /> Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" /> Baixar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Thumbnail for select option rows - shows small image inline */
export function OptionImage({ src, alt = '' }: { src?: string; alt?: string }) {
  const [popupOpen, setPopupOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <img
        src={src}
        alt={alt}
        className="h-6 w-6 object-cover rounded cursor-pointer border inline-block"
        onClick={(e) => { e.stopPropagation(); setPopupOpen(true); }}
      />
      <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{alt}</DialogTitle></DialogHeader>
          <img src={src} alt={alt} className="w-full rounded" />
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const response = await fetch(src);
                const blob = await response.blob();
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                toast.success('Imagem copiada!');
              } catch { await navigator.clipboard.writeText(src); toast.success('URL copiada!'); }
            }} className="gap-2"><Copy className="h-4 w-4" /> Copiar</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const a = document.createElement('a'); a.href = src; a.download = alt || 'imagem'; a.click();
            }} className="gap-2"><Download className="h-4 w-4" /> Baixar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
