import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, MessageCircle, X } from 'lucide-react';

interface ImagePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  title?: string;
}

export default function ImagePreviewModal({ open, onOpenChange, imageSrc, title }: ImagePreviewModalProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `${title || 'imagem'}.png`;
    link.click();
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `Confira a imagem da peça${title ? ` (${title})` : ''}: ${imageSrc.startsWith('http') ? imageSrc : ''}`
    );
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            {title || 'Visualização da Peça'}
          </DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-2">
          <div className="rounded-lg overflow-hidden border bg-muted/20 flex items-center justify-center">
            <img
              src={imageSrc}
              alt={title || 'Peça'}
              className="w-full max-h-[50vh] object-contain"
            />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2 text-xs">
            <Download className="h-4 w-4" /> Salvar Imagem
          </Button>
          <Button onClick={handleWhatsApp} className="flex-1 gap-2 text-xs bg-green-600 hover:bg-green-700 text-white">
            <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
