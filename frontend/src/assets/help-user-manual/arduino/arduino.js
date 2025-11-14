// Image index for installing-dependencies help topic
// Import each image and export both named exports and a default array
import ardimg1 from './1.png';
import ardimg2 from './2.png';
import ardimg3 from './3.png';
import ardimg4 from './4.png';
import ardimg5 from './5.png';
import ardimg6 from './6.png';

// Named exports for direct import
export { ardimg1, ardimg2, ardimg3, ardimg4, ardimg5, ardimg6};

// Default export: ordered array (useful for numeric indexing)
const images = [ardimg1, ardimg2, ardimg3, ardimg4, ardimg5, ardimg6];
export default images;

// Optional mapping by filename (useful if callers want an object)
export const imagesMap = {
    '1.png': ardimg1,
    '2.png': ardimg2,
    '3.png': ardimg3,
    '4.png': ardimg4,
    '5.png': ardimg5,
    '6.png': ardimg6,
};

