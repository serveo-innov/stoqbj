import React from 'react';
import { img_path } from '../../../environment';

interface ImageWithBasePathProps {
  src: string;
  alt?: string;
  className?: string;
  height?: number | string;
  width?: number | string;
  id?: string;
  style?: React.CSSProperties;
}

const ImageWithBasePath: React.FC<ImageWithBasePathProps> = ({
  src,
  alt = '',
  className = '',
  height,
  width,
  id,
  style,
}) => {
  return (
    <img
      src={`${img_path}${src}`}
      alt={alt}
      className={className}
      height={height}
      width={width}
      id={id}
      style={style}
    />
  );
};

export default ImageWithBasePath;
