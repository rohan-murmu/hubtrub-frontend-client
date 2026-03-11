import { Image } from 'primereact/image';
import { useState } from 'react';
import './ImageViewer.css';

interface ImageViewerProps {
  src: string;
  alt: string;
  width?: string;
  height?: string;
}

export default function ImageViewer({
  src,
  alt,
  width = '100px',
  height = '100px',
}: ImageViewerProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <div
        className="image-viewer-thumbnail"
        onClick={() => setVisible(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setVisible(true);
          }
        }}
      >
        <img src={src} alt={alt} style={{ width, height }} />
      </div>
      {visible && (
        <Image
          src={src}
          alt={alt}
          preview
          onHide={() => setVisible(false)}
        />
      )}
    </>
  );
}
