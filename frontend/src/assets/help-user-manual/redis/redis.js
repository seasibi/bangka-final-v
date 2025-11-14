import rdsimg1 from './1.png';
import rdsimg2 from './2.png';
import rdsimg3 from './3.png';
import rdsimg4 from './4.png';
import rdsimg5 from './5.png';
import rdsimg6 from './6.png';
import rdsimg7 from './7.png';


// Named exports for direct import
export { rdsimg1, rdsimg2, rdsimg3, rdsimg4, rdsimg5, rdsimg6, rdsimg7 };

// Default export: ordered array (useful for numeric indexing)
const images = [ rdsimg1, rdsimg2, rdsimg3, rdsimg4, rdsimg5, rdsimg6, rdsimg7 ];
export default images;

// Optional mapping by filename (useful if callers want an object)
export const imagesMap = {
    '1.png': rdsimg1,
    '2.png': rdsimg2,
    '3.png': rdsimg3,
    '4.png': rdsimg4,
    '5.png': rdsimg5,
    '6.png': rdsimg6,
    '7.png': rdsimg7,
};

