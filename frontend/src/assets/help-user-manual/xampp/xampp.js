import ximg1 from './1.png';
import ximg2 from './2.png';
import ximg3 from './3.png';
import ximg4 from './4.png';
import ximg5 from './5.png';
import ximg6 from './6.png';
import ximg7 from './7.png';
import ximg8 from './8.png';

// Named exports for direct import
export { ximg1, ximg2, ximg3, ximg4, ximg5, ximg6, ximg7, ximg8 };

// Default export: ordered array (useful for numeric indexing)
const images = [ ximg1, ximg2, ximg3, ximg4, ximg5, ximg6, ximg8 ];
export default images;

// Optional mapping by filename (useful if callers want an object)
export const imagesMap = {
    '1.png': ximg1,
    '2.png': ximg2,
    '3.png': ximg3,
    '4.png': ximg4,
    '5.png': ximg5,
    '6.png': ximg6,
    '7.png': ximg7,
    '8.png': ximg8,
};

