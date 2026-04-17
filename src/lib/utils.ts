/**
 * Utilidades para optimización de recursos y manejo de imágenes
 */

/**
 * Comprime una imagen en el cliente usando Canvas para ahorrar espacio en Firebase Storage
 * y reducir el consumo de transferencia de datos.
 */
export const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Error al comprimir imagen'));
          },
          'image/jpeg',
          quality
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Genera un hash simple para una imagen basado en su nombre y tamaño
 * Sirve para evitar procesar la misma imagen con Gemini dos veces.
 */
export const getImageHash = (file: File): string => {
  return `${file.name}-${file.size}-${file.lastModified}`;
};
