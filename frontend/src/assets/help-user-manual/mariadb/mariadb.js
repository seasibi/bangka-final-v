import mdbimg1 from './1.png';
import mdbimg2 from './2.png';
import mdbimg3 from './3.png';
import mdbimg4 from './4.png';
import mdbimg5 from './5.png';
import mdbimg6 from './6.png';
import mdbimg7 from './7.png';
import mdbimg8 from './8.png';
import mdbimg9 from './9.png';
import mdbimg10 from './10.png';

// Named exports for direct import
export { mdbimg1, mdbimg2, mdbimg3, mdbimg4, mdbimg5, mdbimg6, mdbimg7, mdbimg8, mdbimg9, mdbimg10 };

// Default export: ordered array (useful for numeric indexing)
const images = [ mdbimg1, mdbimg2, mdbimg3, mdbimg4, mdbimg5, mdbimg6, mdbimg8, mdbimg9, mdbimg10 ];
export default images;

// Optional mapping by filename (useful if callers want an object)
export const imagesMap = {
    '1.png': mdbimg1,
    '2.png': mdbimg2,
    '3.png': mdbimg3,
    '4.png': mdbimg4,
    '5.png': mdbimg5,
    '6.png': mdbimg6,
    '7.png': mdbimg7,
    '8.png': mdbimg8,
    '9.png': mdbimg9,
    '10.png': mdbimg10,
};

