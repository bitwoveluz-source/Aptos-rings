import React from 'react';
import { Box } from '@chakra-ui/react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src: string;
          'ar': boolean;
          'ar-modes'?: string;
          'camera-controls'?: boolean;
          'auto-rotate'?: boolean;
          'shadow-intensity'?: string | number;
          'environment-image'?: string;
          'exposure'?: string | number;
          'poster'?: string;
          'ar-status'?: string;
          'ar-scale'?: string;
          'ios-src'?: string;
          'quick-look-browsers'?: string;
          'ar-placement'?: string;
        },
        HTMLElement
      >;
    }
  }
}

interface ARModelViewerProps {
  modelUrl: string;
  posterUrl?: string;
  width?: string | number;
  height?: string | number;
}

const ARModelViewer: React.FC<ARModelViewerProps> = ({ 
  modelUrl, 
  posterUrl,
  width = '100%',
  height = '400px'
}) => {
  return (
    <Box width={width} height={height}>
      <model-viewer
        src={modelUrl}
        ios-src={modelUrl}
        poster={posterUrl}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        auto-rotate
        ar-scale="fixed"
        ar-placement="floor"
        shadow-intensity="1"
        exposure="1"
        environment-image="neutral"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent',
        }}
      >
        <div className="ar-prompt" slot="ar-prompt">
          👆 Tap to view in your space
        </div>
      </model-viewer>
    </Box>
  );
};

export default ARModelViewer;